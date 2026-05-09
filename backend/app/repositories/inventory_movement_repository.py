from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.inventory_movement import InventoryMovementModel


class InventoryMovementRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "inventory_movements")

    async def get_by_movement_id(self, movement_id: str) -> Optional[InventoryMovementModel]:
        record = await self.get_one({"movement_id": movement_id})
        return InventoryMovementModel(**record) if record else None

    async def list_movements(self, skip: int = 0, limit: int = 10, product_id: Optional[str] = None, reference_type: Optional[str] = None, reference_id: Optional[str] = None) -> Tuple[List[InventoryMovementModel], int]:
        query = {}
        if product_id:
            query["product_id"] = product_id
        if reference_type:
            query["reference_type"] = reference_type
        if reference_id:
            query["reference_id"] = reference_id
        records = await self.get_many(filter=query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(query)
        return [InventoryMovementModel(**record) for record in records], total