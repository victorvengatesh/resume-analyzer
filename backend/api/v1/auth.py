from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.schemas.auth import (
    UserCreate, UserResponse, Token, LoginRequest,
    RefreshRequest, ChangePasswordRequest, UserListResponse,
)
from backend.repositories.user import UserRepository, RoleRepository
from backend.repositories.audit_repository import AuditRepository
from backend.models.user import User, Role
from backend.services.auth_service import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    validate_password_strength,
)
from backend.api.v1.dependencies import get_current_user, require_roles

router = APIRouter()

# ─────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────

def ensure_roles_seeded(db: Session):
    """Seed default roles if they do not exist."""
    role_repo = RoleRepository(db)
    defaults = {
        "Admin":     "Full administrative permissions",
        "Recruiter": "Full candidate and resume processing permissions",
        "HR":        "Full candidate evaluation and interview scheduling permissions",
        "Viewer":    "Read-only access to dashboard and candidate list",
    }
    for rname, desc in defaults.items():
        if not role_repo.get_by_name(rname):
            role_repo.create(Role(name=rname, description=desc))


# ─────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    ensure_roles_seeded(db)
    user_repo = UserRepository(db)
    role_repo = RoleRepository(db)

    # Validate password strength
    strength_error = validate_password_strength(user_in.password)
    if strength_error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=strength_error)

    # Check duplicate email
    if user_repo.get_by_email(user_in.email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Resolve role
    role = role_repo.get_by_name(user_in.role_name)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{user_in.role_name}' does not exist. Valid: Admin, Recruiter, HR, Viewer",
        )

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role_id=role.id,
        is_active=True,
    )
    user_repo.create(user)

    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action("USER_REGISTER", user.id, user.email, ip, {"role": role.name})

    return UserResponse(id=user.id, email=user.email, role=role.name,
                        is_active=user.is_active, created_at=user.created_at)


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ensure_roles_seeded(db)
    user_repo = UserRepository(db)

    user = user_repo.get_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is inactive")

    token_data = {"email": user.email, "user_id": user.id, "role": user.role.name}
    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action("USER_LOGIN", user.id, user.email, ip)

    return Token(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/token", response_model=Token, include_in_schema=False)
def login_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """OAuth2 password-flow compatible endpoint for Swagger UI 'Authorize'."""
    ensure_roles_seeded(db)
    user_repo = UserRepository(db)

    user = user_repo.get_by_email(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Account is inactive")

    token_data = {"email": user.email, "user_id": user.id, "role": user.role.name}
    return Token(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=Token)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_data = verify_token(payload.refresh_token, expected_type="refresh")
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = UserRepository(db).get(token_data.get("user_id"))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    new_data = {"email": user.email, "user_id": user.id, "role": user.role.name}
    return Token(
        access_token=create_access_token(new_data),
        refresh_token=create_refresh_token(new_data),
    )


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user:
        ip = request.client.host if request.client else "unknown"
        AuditRepository(db).log_action("USER_LOGOUT", current_user.id, current_user.email, ip)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role.name,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )


@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    strength_error = validate_password_strength(payload.new_password)
    if strength_error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=strength_error)

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()

    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action("PASSWORD_CHANGED", current_user.id, current_user.email, ip)

    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
def forgot_password(email: str, db: Session = Depends(get_db)):
    """
    Forgot-password flow skeleton.
    In production: generate a time-limited reset token, send via email (SMTP/SendGrid/SES).
    Here we acknowledge without revealing whether the email exists (prevents enumeration).
    """
    # Intentionally do NOT expose whether the email exists
    return {
        "message": "If that email is registered, you will receive a reset link shortly.",
        "note": "Email delivery not yet configured. Implement SMTP/SendGrid in auth_service.",
    }


@router.get("/users", response_model=UserListResponse, dependencies=[Depends(require_roles(["Admin"]))])
def list_users(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """Admin-only: list all registered users."""
    user_repo = UserRepository(db)
    users = user_repo.get_all(limit=limit, offset=offset)
    return UserListResponse(
        total=len(users),
        users=[
            UserResponse(
                id=u.id,
                email=u.email,
                role=u.role.name if u.role else "Unknown",
                is_active=u.is_active,
                created_at=u.created_at,
            )
            for u in users
        ],
    )


@router.patch("/users/{user_id}/deactivate", dependencies=[Depends(require_roles(["Admin"]))])
def deactivate_user(user_id: str, request: Request, db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    """Admin-only: deactivate a user account."""
    user_repo = UserRepository(db)
    user = user_repo.get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == (current_user.id if current_user else None):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")
    user.is_active = False
    db.commit()
    ip = request.client.host if request.client else "unknown"
    AuditRepository(db).log_action("USER_DEACTIVATED", current_user.id if current_user else "admin",
                                   current_user.email if current_user else "", ip, {"target_user": user_id})
    return {"message": f"User {user.email} deactivated"}
