from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.supplier import SupplierModel


class SupplierRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "suppliers")

    async def get_by_supplier_id(self, supplier_id: str) -> Optional[SupplierModel]:
        supplier = await self.get_one({"id": supplier_id})
        return SupplierModel(**supplier) if supplier else None

    async def list_suppliers(self, skip: int = 0, limit: int = 10, search: Optional[str] = None) -> Tuple[List[SupplierModel], int]:
        filter_query = {}
        if search:
            filter_query["$or"] = [
                {"supplier_name": {"$regex": search, "$options": "i"}},
                {"company_name": {"$regex": search, "$options": "i"}},
                {"contact_person": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
            ]
        docs = await self.get_many(filter_query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(filter_query)
        return [SupplierModel(**doc) for doc in docs], total
