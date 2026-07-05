from typing import List, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.user import User
from backend.repositories.user import UserRepository
from backend.services.auth_service import verify_token
from backend.core.config import settings

# OAuth2PasswordBearer scheme definition
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login", auto_error=False)

def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Optional[User]:
    """
    Returns the authenticated user from the JWT token.
    When ENABLE_AUTH=false, returns None (unauthenticated / demo mode).
    When ENABLE_AUTH=true, raises 401 if the token is missing or invalid.
    """
    if not settings.enable_auth:
        return None

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = verify_token(token, expected_type="access")
    if payload is None:
        raise credentials_exception

    email: str = payload.get("email")
    user_id: str = payload.get("user_id")
    if email is None or user_id is None:
        raise credentials_exception

    user_repo = UserRepository(db)
    user = user_repo.get(user_id)
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")

    return user


def require_roles(allowed_roles: List[str]):
    """
    Role-based access control dependency.
    - When ENABLE_AUTH=false: passthrough (all roles permitted).
    - When ENABLE_AUTH=true: enforces that the user has one of the allowed_roles.
    """
    def dependency(current_user: Optional[User] = Depends(get_current_user)):
        # Auth disabled — open access (demo/dev mode)
        if not settings.enable_auth:
            return None
        # Auth enabled but no token was provided (get_current_user would have already raised)
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Check role
        user_role = current_user.role.name if current_user.role else ""
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden. Required role(s): {', '.join(allowed_roles)}"
            )
        return current_user
    return dependency
