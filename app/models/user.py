from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from app.models.common import TimestampModel
from app.utils.constants import UserRole

class UserModel(TimestampModel):
    """User database model"""
    user_id: str = Field(..., description="Unique user identifier")
    email: EmailStr = Field(..., description="User email")
    password_hash: str = Field(..., description="Hashed password")
    name: str = Field(..., description="Full name")
    role: UserRole = Field(..., description="User role")
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
