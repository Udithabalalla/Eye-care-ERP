from typing import Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.password_reset import PasswordResetOTPModel
from app.repositories.base import BaseRepository


class PasswordResetRepository(BaseRepository):
    """Password reset OTP repository"""

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "password_reset_otps")

    async def get_active_by_email(self, email: str) -> Optional[PasswordResetOTPModel]:
        """Get the latest active OTP for an email address"""
        otp_dict = await self.get_one({
            "email": email,
            "is_used": False,
            "expires_at": {"$gt": self.now_utc()},
        })
        if otp_dict:
            return PasswordResetOTPModel(**otp_dict)
        return None

    async def store_otp(self, otp_data: PasswordResetOTPModel) -> PasswordResetOTPModel:
        """Replace any prior OTP for the same email and store the new one"""
        await self.collection.delete_many({"email": otp_data.email})
        created = await self.create(otp_data.dict())
        return PasswordResetOTPModel(**created)

    async def increment_attempts(self, email: str, attempts: int) -> None:
        """Update failed verification attempts"""
        await self.update({"email": email}, {"attempts": attempts})

    async def mark_used(self, email: str) -> None:
        """Mark an OTP as consumed"""
        await self.update({"email": email}, {"is_used": True, "used_at": self.now_utc()})

    async def delete_for_email(self, email: str) -> None:
        """Remove any OTP records for an email address"""
        await self.collection.delete_many({"email": email})