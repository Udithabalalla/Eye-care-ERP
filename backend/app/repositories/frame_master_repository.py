from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.frame_master import FrameMasterModel


class FrameMasterRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "frame_masters")

    async def get_by_master_id(self, frame_master_id: str) -> Optional[FrameMasterModel]:
        doc = await self.get_one({"frame_master_id": frame_master_id, "is_active": True})
        return FrameMasterModel(**doc) if doc else None

    async def get_by_brand_model(self, brand: str, model_code: str) -> Optional[FrameMasterModel]:
        doc = await self.get_one({
            "brand": {"$regex": f"^{brand}$", "$options": "i"},
            "model_code": {"$regex": f"^{model_code}$", "$options": "i"}
        })
        return FrameMasterModel(**doc) if doc else None

    async def list_masters(
        self,
        skip: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        brand: Optional[str] = None,
        category: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> Tuple[List[FrameMasterModel], int]:
        query: dict = {"is_active": True}
        if search:
            query["$or"] = [
                {"brand": {"$regex": search, "$options": "i"}},
                {"model_code": {"$regex": search, "$options": "i"}},
                {"frame_name": {"$regex": search, "$options": "i"}},
            ]
        if brand:
            query["brand"] = {"$regex": f"^{brand}$", "$options": "i"}
        if category:
            query["category"] = category
        if gender:
            query["gender"] = gender

        docs, total = await self.get_many_with_count(query, skip, limit, sort=[("brand", 1), ("model_code", 1)])
        return [FrameMasterModel(**d) for d in docs], total

    async def create_master(self, data: FrameMasterModel) -> FrameMasterModel:
        doc = await self.create(data.dict())
        return FrameMasterModel(**doc)

    async def update_master(self, frame_master_id: str, update_data: dict) -> bool:
        update_data["updated_at"] = datetime.now(timezone.utc)
        return await self.update({"frame_master_id": frame_master_id}, update_data)

    async def get_next_master_number(self) -> int:
        pipeline = [
            {"$project": {"num": {"$toInt": {"$substr": ["$frame_master_id", 3, -1]}}}},
            {"$sort": {"num": -1}},
            {"$limit": 1},
        ]
        result = await self.collection.aggregate(pipeline).to_list(length=1)
        return (result[0]["num"] + 1) if result else 1

    async def get_distinct_brands(self) -> List[str]:
        brands = await self.collection.distinct("brand", {"is_active": True})
        return sorted(brands)
