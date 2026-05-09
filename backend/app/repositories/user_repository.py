from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.user import UserModel

class UserRepository(BaseRepository):
    """User repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.users
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
    
    async def list_users(self, skip: int = 0, limit: int = 100, role: Optional[str] = None) -> tuple[List[UserModel], int]:
        """List users with optional role filter"""
        query = {}
        if role:
            query["role"] = role
        
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("name", 1)
        docs = await cursor.to_list(None)
        return [UserModel(**doc) for doc in docs], total

    async def update_user(self, user_id: str, update_data: dict) -> Optional[UserModel]:
        """Update user"""
        result = await self.collection.find_one_and_update(
            {"user_id": user_id},
            {"$set": {**update_data, "updated_at": datetime.utcnow()}},
            return_document=True
        )
        return UserModel(**result) if result else None

    async def delete_user(self, user_id: str) -> bool:
        """Soft delete user (deactivate)"""
        result = await self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def activate_user(self, user_id: str) -> bool:
        """Activate a deactivated user"""
        result = await self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0
    
    async def update_last_login(self, user_id: str):
        """Update user's last login timestamp"""
        await self.update(
            {"user_id": user_id},
            {"last_login": datetime.now(timezone.utc)}
        )
