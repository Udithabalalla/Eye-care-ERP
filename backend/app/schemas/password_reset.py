from pydantic import BaseModel, EmailStr, Field


class PasswordResetRequest(BaseModel):
    """Request schema for password reset OTP delivery"""
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    """Request schema for OTP verification and password reset"""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


class PasswordResetResponse(BaseModel):
    """Response schema for password reset actions"""
    message: str