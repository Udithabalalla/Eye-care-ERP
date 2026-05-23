from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.quick_intake import QuickIntakeModel


class QuickIntakeRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "quick_intakes")

    async def get_by_intake_id(self, intake_id: str) -> Optional[QuickIntakeModel]:
        doc = await self.get_one({"intake_id": intake_id})
        return QuickIntakeModel(**doc) if doc else None

    async def get_by_id_str(self, id_str: str) -> Optional[QuickIntakeModel]:
        doc = await self.get_by_id(id_str)
        return QuickIntakeModel(**doc) if doc else None

    async def list_intakes(
        self,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
    ) -> Tuple[List[QuickIntakeModel], int]:
        query: dict = {}
        if status:
            query["status"] = status
        if supplier_id:
            query["supplier_id"] = supplier_id

        docs, total = await self.get_many_with_count(query, skip, limit, sort=[("intake_date", -1)])
        return [QuickIntakeModel(**d) for d in docs], total

    async def create_intake(self, data: QuickIntakeModel) -> QuickIntakeModel:
        doc = await self.create(data.dict())
        return QuickIntakeModel(**doc)

    async def update_intake(self, intake_id: str, update_data: dict) -> bool:
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"intake_id": intake_id}, update_data)

    async def delete_draft(self, intake_id: str) -> bool:
        return await self.delete({"intake_id": intake_id, "status": "draft"})

    async def get_next_intake_number(self) -> str:
        year = datetime.now(timezone.utc).year
        count = await self.collection.count_documents({"intake_id": {"$regex": f"^QI-{year}-"}})
        return f"QI-{year}-{str(count + 1).zfill(4)}"
