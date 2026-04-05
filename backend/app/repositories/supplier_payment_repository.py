from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.supplier_payment import SupplierPaymentModel


class SupplierPaymentRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "supplier_payments")

    async def list_payments(self, skip: int = 0, limit: int = 10, invoice_id: Optional[str] = None) -> Tuple[List[SupplierPaymentModel], int]:
        filter_query = {}
        if invoice_id:
            filter_query["invoice_id"] = invoice_id
        docs = await self.get_many(filter_query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(filter_query)
        return [SupplierPaymentModel(**doc) for doc in docs], total

    async def sum_paid_for_invoice(self, invoice_id: str) -> float:
        result = await self.collection.aggregate([
            {"$match": {"invoice_id": invoice_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_paid"}}}
        ]).to_list(length=1)
        if not result:
            return 0.0
        return float(result[0].get("total", 0))
