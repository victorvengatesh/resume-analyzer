from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None
    role: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    # Valid roles: Admin | Recruiter | HR | Viewer
    role_name: str = "Viewer"

    @field_validator("role_name")
    @classmethod
    def validate_role(cls, v: str) -> str:
        allowed = {"Admin", "Recruiter", "HR", "Viewer"}
        if v not in allowed:
            raise ValueError(f"role_name must be one of: {', '.join(sorted(allowed))}")
        return v


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    total: int
    users: List[UserResponse]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
