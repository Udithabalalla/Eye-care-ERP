import uuid
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import BadRequestException, UnauthorizedException, ConflictException, ForbiddenException
from app.utils.constants import UserRole
from app.schemas.user import LoginResponse, UserResponse, SignupRequest
from app.models.user import UserModel
from app.config.settings import settings
from app.services.session_service import ClientInfo, SessionService, hash_token


def issue_access_token(user: UserModel, session_id: str) -> str:
    return create_access_token(
        data={"sub": user.user_id, "email": user.email, "role": user.role, "sid": session_id}
    )


class AuthService:
    """Authentication service"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(db)
        self.sessions = SessionService(db)

    async def _signed_in(self, user: UserModel, client: Optional[ClientInfo]) -> LoginResponse:
        refresh_token, session_id = await self.sessions.start_session(user.user_id, client)
        return LoginResponse(
            access_token=issue_access_token(user, session_id),
            token_type="bearer",
            refresh_token=refresh_token,
            user=UserResponse(**user.model_dump()),
        )

    async def login(self, email: str, password: str, client: Optional[ClientInfo] = None) -> LoginResponse:
        """Authenticate user and return token"""
        # Get user by email
        user = await self.user_repo.get_by_email(email)

        if not user:
            raise UnauthorizedException("Invalid email or password")

        # Verify password
        if not verify_password(password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")

        # Check if user is active
        if not user.is_active:
            raise UnauthorizedException("Account is deactivated")

        # Update last login
        await self.user_repo.update_last_login(user.user_id)

        return await self._signed_in(user, client)

    async def register(self, signup_data: SignupRequest, client: Optional[ClientInfo] = None) -> LoginResponse:
        """Register a new user and return token"""
        if not settings.ALLOW_SELF_SIGNUP:
            raise ForbiddenException("Self-registration is disabled. Ask an administrator to create your account.")

        # Check if email already exists
        existing_user = await self.user_repo.get_by_email(signup_data.email)
        if existing_user:
            raise ConflictException("A user with this email already exists")

        # Create user model
        user_model = UserModel(
            user_id=f"USR-{uuid.uuid4().hex[:8].upper()}",
            email=signup_data.email,
            password_hash=get_password_hash(signup_data.password),
            name=signup_data.name,
            # Never trust a client-supplied role; admins promote users later
            role=UserRole.STAFF,
            department=signup_data.department,
            phone=signup_data.phone,
        )

        # Save to database
        created_user = await self.user_repo.create_user(user_model)
        return await self._signed_in(created_user, client)

    async def refresh_access_token(self, refresh_token: str) -> str:
        """Validate refresh token and return a new access token"""
        user, session_id = await self.sessions.use_refresh_token(refresh_token)
        return issue_access_token(user, session_id)

    async def logout(self, user: UserModel, session_id: Optional[str], refresh_token: Optional[str] = None) -> None:
        """End the session the request came from (or the one ``refresh_token`` belongs to)"""
        if not session_id and refresh_token:
            doc = await self.sessions.repo.get_by_token_hash(hash_token(refresh_token))
            if doc and doc.get("user_id") == user.user_id:
                session_id = str(doc["_id"])
        if session_id:
            await self.sessions.repo.revoke(session_id, self.sessions._now(), user.user_id)

    async def change_own_password(
        self, user: UserModel, current_password: str, new_password: str, session_id: Optional[str]
    ) -> UserModel:
        """Change the signed-in user's password and sign out their other sessions"""
        if not verify_password(current_password, user.password_hash):
            raise BadRequestException("Current password is incorrect")
        if verify_password(new_password, user.password_hash):
            raise BadRequestException("Choose a password different from the current one")
        updated = await self.user_repo.update_user(user.user_id, {
            "password_hash": get_password_hash(new_password),
            "must_change_password": False,
        })
        await self.sessions.end_user_sessions(user.user_id, user.user_id, keep_session_id=session_id)
        return updated
