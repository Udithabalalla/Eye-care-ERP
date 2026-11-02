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
from app.services.session_service import SessionService

logger = logging.getLogger(__name__)


def _is_network_unreachable(exc: Exception) -> bool:
    """Check nested exceptions for OS-level network unreachable errors."""
    current: Exception | None = exc
    while current is not None:
        if isinstance(current, OSError) and getattr(current, "errno", None) == 101:
            return True
        current = getattr(current, "__cause__", None) or getattr(current, "__context__", None)
    return False


class PasswordResetService:
    """Password reset workflow service"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(db)
        self.reset_repo = PasswordResetRepository(db)
        self.email_service = EmailService()
        self.sessions = SessionService(db)

    @staticmethod
    def _generate_otp() -> str:
        return f"{secrets.randbelow(1_000_000):06d}"

    async def request_reset(self, email: str) -> PasswordResetResponse:
        """Create and send a reset OTP for the registered email address"""
        user = await self.user_repo.get_by_email(email)

        if not user or not user.is_active:
            return PasswordResetResponse(message="If the email address is registered, an OTP has been sent.")

        now = datetime.now(timezone.utc)
        # Don't send another code (or let someone flood the inbox) within the resend window
        existing = await self.reset_repo.get_active_by_email(user.email)
        if existing and existing.sent_at:
            sent_at = existing.sent_at if existing.sent_at.tzinfo else existing.sent_at.replace(tzinfo=timezone.utc)
            if now - sent_at < timedelta(seconds=settings.PASSWORD_RESET_RESEND_SECONDS):
                return PasswordResetResponse(message="If the email address is registered, an OTP has been sent.")

        otp = self._generate_otp()
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
        except Exception:
            # The reply stays the same so it can't reveal which emails are registered;
            # drop the unsent code so asking again isn't blocked by the resend window
            logger.error("Password reset email could not be sent", exc_info=True)
            await self.reset_repo.delete_for_email(user.email)

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

        await self.user_repo.update(
            {"email": email},
            {"password_hash": get_password_hash(new_password), "must_change_password": False},
        )
        await self.reset_repo.delete_for_email(email)
        # Whoever knew the old password is signed out everywhere
        await self.sessions.end_user_sessions(user.user_id, user.user_id)

        return PasswordResetResponse(message="Password reset successfully")