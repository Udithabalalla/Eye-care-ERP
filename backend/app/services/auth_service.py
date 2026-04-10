import uuid
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.exceptions import UnauthorizedException, ConflictException
from app.schemas.user import LoginResponse, UserResponse, SignupRequest
from app.models.user import UserModel

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
        
        # Prepare response
        user_response = UserResponse(**user.dict())
        
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
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

        user_response = UserResponse(**created_user.dict())

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=user_response
        )
