from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
import re
from datetime import datetime

from app.repositories.base import BaseRepository
from app.models.supplier import SupplierModel


class SupplierRepository(BaseRepository):
    """Repository for suppliers collection"""

    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "suppliers")

    async def get_by_supplier_id(self, supplier_id: str) -> Optional[SupplierModel]:
        s = await self.get_one({"id": supplier_id})
        if s:
            return SupplierModel(**s)
        return None

    async def list_suppliers(
        self,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None,
    ) -> Tuple[List[SupplierModel], int]:
        filter_query = {"is_active": True}

        if search:
            escaped = re.escape(search)
            filter_query["$or"] = [
                {"supplier_name": {"$regex": escaped, "$options": "i"}},
                {"company_name": {"$regex": escaped, "$options": "i"}},
                {"contact_person": {"$regex": escaped, "$options": "i"}},
                {"phone": {"$regex": escaped, "$options": "i"}},
                {"email": {"$regex": escaped, "$options": "i"}},
            ]

        suppliers_dict, total = await self.get_many_with_count(filter_query, skip, limit, sort=[("created_at", -1)])
        suppliers = [SupplierModel(**s) for s in suppliers_dict]
        return suppliers, total

    async def create_supplier(self, supplier: SupplierModel) -> SupplierModel:
        supplier_dict = supplier.model_dump()
        created = await self.create(supplier_dict)
        return SupplierModel(**created)

    async def update_supplier(self, supplier_id: str, update_data: dict) -> bool:
        update_data["updated_at"] = datetime.utcnow()
        return await self.update({"id": supplier_id}, update_data)

    async def delete_supplier(self, supplier_id: str) -> bool:
        # soft delete if possible
        return await self.update({"id": supplier_id}, {"is_active": False})

    async def get_next_supplier_number(self) -> int:
        pipeline = [
            {
                "$project": {
                    "id": 1,
                    "number": {
                        "$toInt": {"$substr": ["$id", 3, -1]}
                    }
                }
            },
            {"$sort": {"number": -1}},
            {"$limit": 1}
        ]
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        if result:
            return result[0]["number"] + 1
        return 1
