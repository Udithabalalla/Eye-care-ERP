from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.utils.constants import UserRole

class UserCreate(BaseModel):
    """Schema for creating a user"""
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2)
    role: UserRole
    department: Optional[str] = None
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    """Schema for updating a user"""
    name: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

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

class LoginRequest(BaseModel):
    """Schema for login request"""
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    """Schema for login response"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
