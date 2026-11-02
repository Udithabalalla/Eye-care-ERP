import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.settings import settings
from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException
from app.core.security import get_password_hash, verify_password
from app.models.user import UserModel
from app.repositories.signup_request_repository import SignupRequestRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import SignupRequest, SignupStarted
from app.services.audit_service import AuditService
from app.services.email_service import EmailService
from app.utils.constants import UserRole

logger = logging.getLogger(__name__)


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class SignupService:
    """Self sign-up: the person picks a role, and the account is created only after
    they enter the code emailed to them. Codes use the password-reset limits
    (expiry, attempts and resend window)."""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.user_repo = UserRepository(db)
        self.requests = SignupRequestRepository(db)
        self.email_service = EmailService()

    async def start(self, data: SignupRequest) -> SignupStarted:
        if not settings.ALLOW_SELF_SIGNUP:
            raise ForbiddenException("Self-registration is disabled. Ask an administrator to create your account.")
        if data.role == UserRole.ADMIN and not settings.ALLOW_ADMIN_SELF_SIGNUP:
            raise ForbiddenException("Admin accounts can't be created from the sign-up page. Ask an administrator.")

        email = data.email.lower()
        if await self.user_repo.get_by_email(email):
            raise ConflictException("An account with this email already exists. Sign in, or reset your password.")

        now = datetime.now(timezone.utc)
        started = SignupStarted(
            message="We emailed you a 6-digit code. Enter it to finish creating your account.",
            email=email,
            expires_in_minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES,
        )

        pending = await self.requests.get_by_email(email)
        if pending and now - _as_utc(pending["sent_at"]) < timedelta(seconds=settings.PASSWORD_RESET_RESEND_SECONDS):
            # A code went out moments ago; don't send another
            return started

        otp = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES)
        await self.requests.replace({
            "email": email,
            "name": data.name.strip(),
            "role": data.role.value,
            "department": (data.department or "").strip() or None,
            "phone": (data.phone or "").strip() or None,
            "password_hash": get_password_hash(data.password),
            "otp_hash": get_password_hash(otp),
            "attempts": 0,
            "sent_at": now,
            "expires_at": expires_at,
            "created_at": now,
        })
        try:
            await self.email_service.send_signup_otp(email, data.name.strip(), otp, expires_at)
        except Exception:
            await self.requests.delete_for_email(email)
            raise BadRequestException("We couldn't send the confirmation email. Please try again in a few minutes.")
        return started

    async def verify(self, email: str, otp: str) -> UserModel:
        """Check the code and create the account"""
        email = email.lower()
        pending = await self.requests.get_by_email(email)
        if not pending or datetime.now(timezone.utc) > _as_utc(pending["expires_at"]):
            raise BadRequestException("This code has expired. Start again to get a new one.")
        if not verify_password(otp, pending["otp_hash"]):
            attempts = pending.get("attempts", 0) + 1
            if attempts >= settings.PASSWORD_RESET_OTP_MAX_ATTEMPTS:
                await self.requests.delete_for_email(email)
                raise BadRequestException("Too many wrong codes. Start again to get a new one.")
            await self.requests.set_attempts(email, attempts)
            raise BadRequestException("That code isn't right. Check the email and try again.")

        if await self.user_repo.get_by_email(email):
            await self.requests.delete_for_email(email)
            raise ConflictException("An account with this email already exists. Sign in, or reset your password.")

        user = await self.user_repo.create_user(UserModel(
            user_id=f"USR_{uuid.uuid4().hex[:12].upper()}",
            email=email,
            password_hash=pending["password_hash"],
            name=pending["name"],
            role=UserRole(pending["role"]),
            department=pending.get("department"),
            phone=pending.get("phone"),
        ))
        await self.requests.delete_for_email(email)
        await AuditService(self.db).log(user.user_id, "self_signup", "user", user.user_id,
                                        new_value={"email": user.email, "role": user.role.value})
        logger.info("Self sign-up: %s as %s", user.email, user.role.value)
        return user
