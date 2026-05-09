from datetime import datetime
from typing import Optional

from pydantic import EmailStr, Field

from app.models.common import TimestampModel


class PasswordResetOTPModel(TimestampModel):
    """Password reset OTP database model"""
    email: EmailStr = Field(..., description="User email address")
    user_id: str = Field(..., description="User identifier")
    otp_hash: str = Field(..., description="Hashed OTP")
    expires_at: datetime = Field(..., description="OTP expiry timestamp")
    attempts: int = Field(default=0, description="Failed verification attempts")
    max_attempts: int = Field(default=5, description="Maximum allowed attempts")
    is_used: bool = Field(default=False, description="Whether the OTP has been consumed")
    sent_at: Optional[datetime] = None
    used_at: Optional[datetime] = None