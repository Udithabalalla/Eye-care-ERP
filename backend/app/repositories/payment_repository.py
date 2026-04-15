from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.payment import PaymentModel


class PaymentRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "payments")

    async def get_by_payment_id(self, payment_id: str) -> Optional[PaymentModel]:
        record = await self.get_one({"payment_id": payment_id})
        return PaymentModel(**record) if record else None

    async def list_payments(self, skip: int = 0, limit: int = 10, reference_type: Optional[str] = None, reference_id: Optional[str] = None) -> Tuple[List[PaymentModel], int]:
        query = {}
        if reference_type:
            query["reference_type"] = reference_type
        if reference_id:
            query["reference_id"] = reference_id
        records = await self.get_many(filter=query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(query)
        return [PaymentModel(**record) for record in records], total