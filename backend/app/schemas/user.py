from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from app.utils.constants import UserRole

class UserCreate(BaseModel):
    """Schema for an admin creating a user"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2)
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None
    # The admin picked this password, so by default the user replaces it at first sign-in
    must_change_password: bool = True

class UserUpdate(BaseModel):
    """Schema for an admin updating a user; only the fields sent are changed"""
    email: Optional[EmailStr] = None
    name: Optional[str] = Field(None, min_length=2)
    role: Optional[UserRole] = None
    department: Optional[str] = None
    phone: Optional[str] = None

class PasswordResetByAdmin(BaseModel):
    new_password: str = Field(..., min_length=8)
    must_change_password: bool = True

class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8)

class UserPermissionsUpdate(BaseModel):
    """Permissions added to, or taken away from, what the user's role grants"""
    granted: List[str] = Field(default_factory=list)
    revoked: List[str] = Field(default_factory=list)

class UserPermissionsResponse(BaseModel):
    user_id: str
    role: UserRole
    role_permissions: List[str]
    granted: List[str]
    revoked: List[str]
    effective: List[str]

class UserResponse(BaseModel):
    """Schema for user response"""
    user_id: str
    email: EmailStr
    name: str
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime
    must_change_password: bool = False

class AdminUserResponse(UserResponse):
    """What admins see on the Users screen"""
    granted_permissions: List[str] = Field(default_factory=list)
    revoked_permissions: List[str] = Field(default_factory=list)
    active_sessions: int = 0

class CurrentUserResponse(UserResponse):
    """The signed-in user, with what they may do (``["*"]`` for admins)"""
    permissions: List[str] = Field(default_factory=list)

class LoginRequest(BaseModel):
    """Schema for login request"""
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    """Schema for signup/register request"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2)
    role: UserRole = UserRole.STAFF
    department: Optional[str] = None
    phone: Optional[str] = None

class SignupStarted(BaseModel):
    """A code was emailed; the account is created once it is entered"""
    message: str
    email: EmailStr
    expires_in_minutes: int

class SignupVerifyRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class LoginResponse(BaseModel):
    """Schema for login response"""
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str


class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None
