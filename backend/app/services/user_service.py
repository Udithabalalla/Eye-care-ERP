from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.user_repository import UserRepository
from app.models.user import UserModel
from app.utils.constants import UserRole
from typing import List, Optional
from datetime import datetime
import uuid
import bcrypt


class UserService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.user_repo = UserRepository(db)

    async def get_user(self, user_id: str) -> Optional[UserModel]:
        """Get user by ID"""
        return await self.user_repo.get_by_user_id(user_id)

    async def get_user_by_email(self, email: str) -> Optional[UserModel]:
        """Get user by email"""
        return await self.user_repo.get_by_email(email)

    async def list_users(self, skip: int = 0, limit: int = 100, role: Optional[UserRole] = None) -> tuple[List[UserModel], int]:
        """List users"""
        return await self.user_repo.list_users(skip, limit, role)

    async def create_user(
        self,
        email: str,
        password: str,
        name: str,
        role: UserRole,
        department: Optional[str] = None,
        phone: Optional[str] = None
    ) -> UserModel:
        """Create a new user"""
        # Check if user already exists
        existing = await self.user_repo.get_by_email(email)
        if existing:
            raise ValueError(f"User with email {email} already exists")
        
        # Hash password
        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        
        user_data = UserModel(
            user_id=f"USR_{uuid.uuid4().hex[:12].upper()}",
            email=email,
            password_hash=password_hash,
            name=name,
            role=role,
            department=department,
            phone=phone,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=None
        )
        
        return await self.user_repo.create_user(user_data)

    async def update_user(
        self,
        user_id: str,
        name: Optional[str] = None,
        email: Optional[str] = None,
        role: Optional[UserRole] = None,
        department: Optional[str] = None,
        phone: Optional[str] = None
    ) -> Optional[UserModel]:
        """Update user details"""
        update_data = {}
        if name:
            update_data["name"] = name
        if email:
            # Check if email is already used by another user
            existing = await self.user_repo.get_by_email(email)
            if existing and existing.user_id != user_id:
                raise ValueError(f"Email {email} is already in use")
            update_data["email"] = email
        if role:
            update_data["role"] = role
        if department:
            update_data["department"] = department
        if phone:
            update_data["phone"] = phone
        
        if not update_data:
            return await self.get_user(user_id)
        
        return await self.user_repo.update_user(user_id, update_data)

    async def change_password(self, user_id: str, old_password: str, new_password: str) -> bool:
        """Change user password"""
        user = await self.get_user(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Verify old password
        if not bcrypt.checkpw(old_password.encode(), user.password_hash.encode()):
            raise ValueError("Incorrect password")
        
        # Hash new password
        password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        
        await self.user_repo.update_user(user_id, {"password_hash": password_hash})
        return True

    async def deactivate_user(self, user_id: str) -> bool:
        """Deactivate user"""
        return await self.user_repo.delete_user(user_id)

    async def activate_user(self, user_id: str) -> bool:
        """Activate deactivated user"""
        return await self.user_repo.activate_user(user_id)

    async def reset_password(self, user_id: str, new_password: str) -> bool:
        """Admin reset password"""
        user = await self.get_user(user_id)
        if not user:
            raise ValueError("User not found")
        
        # Hash new password
        password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        
        await self.user_repo.update_user(user_id, {"password_hash": password_hash})
        return True
