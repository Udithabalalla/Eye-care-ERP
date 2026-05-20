import uuid
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import UnauthorizedException, ConflictException
from app.schemas.user import LoginResponse, UserResponse, SignupRequest
from app.models.user import UserModel
from app.config.settings import settings

REFRESH_COLLECTION = 'refresh_tokens'

class AuthService:
    """Authentication service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(db)
    
    async def login(self, email: str, password: str) -> LoginResponse:
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
        
        # Create access token
        access_token = create_access_token(
            data={"sub": user.user_id, "email": user.email, "role": user.role}
        )

        # Create refresh token and persist
        refresh_token = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        await self.user_repo.db[REFRESH_COLLECTION].insert_one({
            "token": refresh_token,
            "user_id": user.user_id,
            "expires_at": expires_at,
        })
        
        # Prepare response
        user_response = UserResponse(**user.dict())
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token,
            user=user_response
        )

    async def register(self, signup_data: SignupRequest) -> LoginResponse:
        """Register a new user and return token"""
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
            role=signup_data.role,
            department=signup_data.department,
            phone=signup_data.phone,
        )

        # Save to database
        created_user = await self.user_repo.create_user(user_model)

        # Create access token
        access_token = create_access_token(
            data={"sub": created_user.user_id, "email": created_user.email, "role": created_user.role}
        )

        # Create refresh token and persist
        refresh_token = uuid.uuid4().hex
        expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        await self.user_repo.db[REFRESH_COLLECTION].insert_one({
            "token": refresh_token,
            "user_id": created_user.user_id,
            "expires_at": expires_at,
        })

        user_response = UserResponse(**created_user.dict())

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token,
            user=user_response
        )

    async def refresh_access_token(self, refresh_token: str) -> str:
        """Validate refresh token and return a new access token"""
        doc = await self.user_repo.db[REFRESH_COLLECTION].find_one({"token": refresh_token})
        if not doc:
            raise UnauthorizedException("Invalid refresh token")
        expires_at = doc.get('expires_at')
        if not expires_at or datetime.now(timezone.utc) > expires_at:
            raise UnauthorizedException("Refresh token expired")
        user = await self.user_repo.get_by_user_id(doc.get('user_id'))
        if not user:
            raise UnauthorizedException("User not found for refresh token")
        # Issue new access token
        new_access = create_access_token({"sub": user.user_id, "email": user.email, "role": user.role})
        return new_access
