import secrets
import logging
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.core.exceptions import BadRequestException
from app.core.security import get_password_hash, verify_password
from app.models.password_reset import PasswordResetOTPModel
from app.repositories.password_reset_repository import PasswordResetRepository
from app.repositories.user_repository import UserRepository
from app.schemas.password_reset import PasswordResetResponse
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class PasswordResetService:
    """Password reset workflow service"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(db)
        self.reset_repo = PasswordResetRepository(db)
        self.email_service = EmailService()

    @staticmethod
    def _generate_otp() -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    async def request_reset(self, email: str) -> PasswordResetResponse:
        """Create and send a reset OTP for the registered email address"""
        user = await self.user_repo.get_by_email(email)

        if not user or not user.is_active:
            return PasswordResetResponse(message="If the email address is registered, an OTP has been sent.")

        otp = self._generate_otp()
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES)

        otp_record = PasswordResetOTPModel(
            email=user.email,
            user_id=user.user_id,
            otp_hash=get_password_hash(otp),
            expires_at=expires_at,
            attempts=0,
            max_attempts=settings.PASSWORD_RESET_OTP_MAX_ATTEMPTS,
            is_used=False,
            sent_at=now,
        )
        await self.reset_repo.store_otp(otp_record)
        try:
            await self.email_service.send_password_reset_otp(user.email, user.name, otp, expires_at)
        except Exception as exc:
            logger.exception("Password reset OTP send failed for user_id=%s email=%s", user.user_id, user.email)
            await self.reset_repo.delete_for_email(email)
            raise BadRequestException("Unable to send reset OTP. Please try again later.")

        return PasswordResetResponse(message="If the email address is registered, an OTP has been sent.")

    async def confirm_reset(self, email: str, otp: str, new_password: str) -> PasswordResetResponse:
        """Verify the OTP and update the password"""
        user = await self.user_repo.get_by_email(email)
        if not user or not user.is_active:
            raise BadRequestException("Invalid or expired OTP")

        otp_record = await self.reset_repo.get_active_by_email(email)
        if not otp_record:
            raise BadRequestException("Invalid or expired OTP")

        if not verify_password(otp, otp_record.otp_hash):
            attempts = otp_record.attempts + 1
            if attempts >= otp_record.max_attempts:
                await self.reset_repo.delete_for_email(email)
            else:
                await self.reset_repo.increment_attempts(email, attempts)
            raise BadRequestException("Invalid or expired OTP")

        await self.user_repo.update({"email": email}, {"password_hash": get_password_hash(new_password)})
        await self.reset_repo.delete_for_email(email)

        return PasswordResetResponse(message="Password reset successfully")