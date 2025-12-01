from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.user import UserModel

class UserRepository(BaseRepository):
    """User repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "users")
    
    async def get_by_email(self, email: str) -> Optional[UserModel]:
        """Get user by email"""
        user_dict = await self.get_one({"email": email})
        if user_dict:
            return UserModel(**user_dict)
        return None
    
    async def get_by_user_id(self, user_id: str) -> Optional[UserModel]:
        """Get user by user_id"""
        user_dict = await self.get_one({"user_id": user_id})
        if user_dict:
            return UserModel(**user_dict)
        return None
    
    async def create_user(self, user_data: UserModel) -> UserModel:
        """Create a new user"""
        user_dict = user_data.dict()
        created = await self.create(user_dict)
        return UserModel(**created)
    
    async def update_last_login(self, user_id: str):
        """Update user's last login timestamp"""
        await self.update(
            {"user_id": user_id},
            {"last_login": datetime.now(timezone.utc)}
        )
