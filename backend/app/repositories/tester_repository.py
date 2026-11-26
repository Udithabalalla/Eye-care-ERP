import re
from typing import List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.tester import TesterModel
from app.repositories.base import BaseRepository


class TesterRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "testers")

    async def get_by_id(self, tester_id: str) -> Optional[TesterModel]:
        document = await super().get_by_id(tester_id)
        return TesterModel(**document) if document else None

    async def update_by_id(self, tester_id: str, update_data: dict) -> bool:
        return await self.update({"_id": ObjectId(tester_id)}, update_data)

    async def get_by_name(self, name: str) -> Optional[TesterModel]:
        document = await self.get_one({"name": re.compile(f"^{re.escape(name.strip())}$", re.IGNORECASE)})
        return TesterModel(**document) if document else None

    async def list_testers(self, is_active: bool | None = None) -> List[TesterModel]:
        query: dict = {} if is_active is None else {"is_active": is_active}
        documents = await self.get_many(filter=query, skip=0, limit=500, sort=[("name", 1)])
        return [TesterModel(**document) for document in documents]

    async def create_tester(self, payload: TesterModel) -> TesterModel:
        created = await self.create(payload.model_dump(exclude_none=True, exclude={"id"}))
        return TesterModel(**created)
