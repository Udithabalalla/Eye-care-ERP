from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

from app.repositories.user_repository import UserRepository
from app.core.security import verify_password, create_access_token
from app.core.exceptions import UnauthorizedException
from app.schemas.user import LoginResponse, UserResponse

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
