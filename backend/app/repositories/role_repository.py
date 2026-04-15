from app.repositories.base import BaseRepository
from app.models.role import RoleModel, PermissionModel
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
import uuid


class PermissionRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.permissions

    async def create_permission(self, permission_data: dict) -> PermissionModel:
        """Create a new permission"""
        if not permission_data.get("permission_id"):
            permission_data["permission_id"] = f"PERM_{uuid.uuid4().hex[:12].upper()}"
        
        await self.collection.insert_one(permission_data)
        return PermissionModel(**permission_data)

    async def get_permission(self, permission_id: str) -> Optional[PermissionModel]:
        """Get permission by ID"""
        doc = await self.collection.find_one({"permission_id": permission_id})
        return PermissionModel(**doc) if doc else None

    async def get_by_code(self, code: str) -> Optional[PermissionModel]:
        """Get permission by code"""
        doc = await self.collection.find_one({"code": code})
        return PermissionModel(**doc) if doc else None

    async def list_permissions(self, category: Optional[str] = None, skip: int = 0, limit: int = 100) -> tuple[List[PermissionModel], int]:
        """List permissions with optional category filter"""
        query = {}
        if category:
            query["category"] = category
        
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit)
        docs = await cursor.to_list(None)
        return [PermissionModel(**doc) for doc in docs], total

    async def update_permission(self, permission_id: str, update_data: dict) -> Optional[PermissionModel]:
        """Update permission"""
        result = await self.collection.find_one_and_update(
            {"permission_id": permission_id},
            {"$set": update_data},
            return_document=True
        )
        return PermissionModel(**result) if result else None

    async def delete_permission(self, permission_id: str) -> bool:
        """Delete permission"""
        result = await self.collection.delete_one({"permission_id": permission_id})
        return result.deleted_count > 0


class RoleRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.roles

    async def create_role(self, role_data: dict) -> RoleModel:
        """Create a new role"""
        if not role_data.get("role_id"):
            role_data["role_id"] = f"ROLE_{uuid.uuid4().hex[:12].upper()}"
        
        await self.collection.insert_one(role_data)
        return RoleModel(**role_data)

    async def get_role(self, role_id: str) -> Optional[RoleModel]:
        """Get role by ID"""
        doc = await self.collection.find_one({"role_id": role_id})
        return RoleModel(**doc) if doc else None

    async def get_by_name(self, name: str) -> Optional[RoleModel]:
        """Get role by name"""
        doc = await self.collection.find_one({"name": name})
        return RoleModel(**doc) if doc else None

    async def list_roles(self, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> tuple[List[RoleModel], int]:
        """List roles"""
        query = {} if include_inactive else {"is_active": True}
        
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).skip(skip).limit(limit).sort("name", 1)
        docs = await cursor.to_list(None)
        return [RoleModel(**doc) for doc in docs], total

    async def update_role(self, role_id: str, update_data: dict) -> Optional[RoleModel]:
        """Update role"""
        result = await self.collection.find_one_and_update(
            {"role_id": role_id},
            {"$set": update_data},
            return_document=True
        )
        return RoleModel(**result) if result else None

    async def add_permission_to_role(self, role_id: str, permission_id: str) -> bool:
        """Add permission to role"""
        result = await self.collection.update_one(
            {"role_id": role_id},
            {"$addToSet": {"permission_ids": permission_id}}
        )
        return result.modified_count > 0

    async def remove_permission_from_role(self, role_id: str, permission_id: str) -> bool:
        """Remove permission from role"""
        result = await self.collection.update_one(
            {"role_id": role_id},
            {"$pull": {"permission_ids": permission_id}}
        )
        return result.modified_count > 0

    async def delete_role(self, role_id: str) -> bool:
        """Delete role (soft delete - mark as inactive)"""
        result = await self.collection.update_one(
            {"role_id": role_id },
            {"$set": {"is_active": False}}
        )
        return result.modified_count > 0
