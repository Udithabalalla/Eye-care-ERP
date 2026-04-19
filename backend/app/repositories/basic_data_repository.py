from __future__ import annotations

import re
from typing import Optional, Tuple, List

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.basic_data import OtherExpenseTypeModel, LensMasterModel
from app.repositories.base import BaseRepository


class OtherExpenseTypeRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "other_expense_types")

    async def get_by_id(self, expense_type_id: str) -> Optional[OtherExpenseTypeModel]:
        document = await super().get_by_id(expense_type_id)
        return OtherExpenseTypeModel(**document) if document else None

    async def update_by_id(self, expense_type_id: str, update_data: dict) -> bool:
        return await self.update({"_id": ObjectId(expense_type_id)}, update_data)

    async def get_by_name(self, name: str) -> Optional[OtherExpenseTypeModel]:
        document = await self.get_one({"name": re.compile(f"^{re.escape(name)}$", re.IGNORECASE)})
        return OtherExpenseTypeModel(**document) if document else None

    async def list_other_expenses(self, skip: int, limit: int, search: str | None = None, is_active: bool | None = None) -> Tuple[List[OtherExpenseTypeModel], int]:
        filter_query: dict = {}
        if search:
            filter_query["name"] = {"$regex": re.escape(search), "$options": "i"}
        if is_active is not None:
            filter_query["is_active"] = is_active

        documents = await self.get_many(filter=filter_query, skip=skip, limit=limit, sort=[("name", 1)])
        total = await self.count(filter_query)
        return [OtherExpenseTypeModel(**document) for document in documents], total

    async def create_other_expense(self, payload: OtherExpenseTypeModel) -> OtherExpenseTypeModel:
        created = await self.create(payload.model_dump(exclude_none=True))
        return OtherExpenseTypeModel(**created)


class LensMasterRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "lens_master")

    async def get_by_id(self, lens_id: str) -> Optional[LensMasterModel]:
        document = await super().get_by_id(lens_id)
        return LensMasterModel(**document) if document else None

    async def update_by_id(self, lens_id: str, update_data: dict) -> bool:
        return await self.update({"_id": ObjectId(lens_id)}, update_data)

    async def get_by_code(self, lens_code: str) -> Optional[LensMasterModel]:
        document = await self.get_one({"lens_code": re.compile(f"^{re.escape(lens_code)}$", re.IGNORECASE)})
        return LensMasterModel(**document) if document else None

    async def list_lenses(self, skip: int, limit: int, search: str | None = None, is_active: bool | None = None) -> Tuple[List[LensMasterModel], int]:
        filter_query: dict = {}
        if search:
            filter_query["$or"] = [
                {"lens_type": {"$regex": re.escape(search), "$options": "i"}},
                {"color": {"$regex": re.escape(search), "$options": "i"}},
                {"size": {"$regex": re.escape(search), "$options": "i"}},
                {"lens_code": {"$regex": re.escape(search), "$options": "i"}},
            ]
        if is_active is not None:
            filter_query["is_active"] = is_active

        documents = await self.get_many(filter=filter_query, skip=skip, limit=limit, sort=[("lens_type", 1), ("color", 1), ("size", 1)])
        total = await self.count(filter_query)
        return [LensMasterModel(**document) for document in documents], total

    async def create_lens(self, payload: LensMasterModel) -> LensMasterModel:
        created = await self.create(payload.model_dump(exclude_none=True))
        return LensMasterModel(**created)
