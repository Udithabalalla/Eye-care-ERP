from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.transaction import TransactionModel


class TransactionRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "transactions")

    async def get_by_transaction_id(self, transaction_id: str) -> Optional[TransactionModel]:
        record = await self.get_one({"transaction_id": transaction_id})
        return TransactionModel(**record) if record else None

    async def list_transactions(self, skip: int = 0, limit: int = 10, filters: Optional[dict] = None) -> Tuple[List[TransactionModel], int]:
        query = filters or {}
        records = await self.get_many(filter=query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(query)
        return [TransactionModel(**record) for record in records], total