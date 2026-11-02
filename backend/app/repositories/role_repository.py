from app.repositories.base import BaseRepository
from app.models.role import RoleModel
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase


class RoleRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "roles")

    async def get_role(self, role_id: str) -> Optional[RoleModel]:
        """Get role by ID"""
        doc = await self.collection.find_one({"role_id": role_id})
        return RoleModel(**doc) if doc else None

    async def list_roles(self, role_ids: List[str]) -> List[RoleModel]:
        """The stored roles among ``role_ids``"""
        cursor = self.collection.find({"role_id": {"$in": role_ids}})
        return [RoleModel(**doc) for doc in await cursor.to_list(None)]

    async def insert_if_missing(self, role: RoleModel) -> bool:
        """Store ``role`` unless a role with its id exists; True if it was added"""
        result = await self.collection.update_one(
            {"role_id": role.role_id},
            {"$setOnInsert": role.model_dump()},
            upsert=True,
        )
        return result.upserted_id is not None

    async def update_role(self, role_id: str, update_data: dict) -> Optional[RoleModel]:
        """Update role"""
        result = await self.collection.find_one_and_update(
            {"role_id": role_id},
            {"$set": {**update_data, "updated_at": self.now_utc()}},
            return_document=True
        )
        return RoleModel(**result) if result else None
