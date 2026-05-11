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

        docs, total = await self.get_many_with_count(filter_query, skip, limit, sort=[("created_at", -1)])
        payments = [SupplierPaymentModel(**d) for d in docs]
        return payments, total

    async def sum_paid_for_invoice(self, invoice_id: str) -> float:
        pipeline = [
            {"$match": {"invoice_id": invoice_id}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_paid"}}}
        ]
        res = await self.collection.aggregate(pipeline).to_list(length=1)
        if not res:
            return 0.0
        return float(res[0].get("total", 0.0))
