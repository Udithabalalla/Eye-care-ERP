from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import BadRequestException, UnauthorizedException
from app.schemas.user import LoginResponse, UserResponse, SignupRequest, SignupStarted
from app.models.user import UserModel
from app.services.session_service import ClientInfo, SessionService, hash_token
from app.services.signup_service import SignupService


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

    async def register(self, signup_data: SignupRequest) -> SignupStarted:
        """Start a sign-up: email the person a code; nothing is created yet"""
        return await SignupService(self.user_repo.db).start(signup_data)

    async def verify_registration(self, email: str, otp: str, client: Optional[ClientInfo] = None) -> LoginResponse:
        """Create the account once the emailed code checks out, and sign them in"""
        user = await SignupService(self.user_repo.db).verify(email, otp)
        await self.user_repo.update_last_login(user.user_id)
        return await self._signed_in(user, client)

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
