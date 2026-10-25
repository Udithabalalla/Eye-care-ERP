from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple, Dict
from app.repositories.base import BaseRepository
from app.models.supplier_payment import SupplierPaymentModel


class SupplierPaymentRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "supplier_payments")

    async def list_payments(
        self,
        skip: int = 0,
        limit: int = 10,
        invoice_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        order_invoice_ids: Optional[List[str]] = None,
    ) -> Tuple[List[SupplierPaymentModel], int]:
        filter_query: dict = {}
        if invoice_id:
            filter_query["invoice_id"] = invoice_id
        if purchase_order_id:
            # Advances on the order, plus payments against its invoice (older ones carry only the invoice)
            clauses: list = [{"purchase_order_id": purchase_order_id}]
            if order_invoice_ids:
                clauses.append({"invoice_id": {"$in": order_invoice_ids}})
            filter_query["$or"] = clauses

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

    async def sum_unapplied_advances(self, order_ids: List[str]) -> Dict[str, float]:
        """Advances paid on each order that aren't yet against an invoice."""
        ids = [oid for oid in set(order_ids) if oid]
        if not ids:
            return {}
        pipeline = [
            {"$match": {"purchase_order_id": {"$in": ids}, "is_advance": True, "invoice_id": None}},
            {"$group": {"_id": "$purchase_order_id", "total": {"$sum": "$amount_paid"}}},
        ]
        rows = await self.collection.aggregate(pipeline).to_list(length=None)
        return {row["_id"]: float(row.get("total") or 0.0) for row in rows}

    async def apply_advances_to_invoice(self, purchase_order_id: str, invoice_id: str) -> int:
        """Move an order's open advances onto its newly recorded invoice."""
        return await self.update_many(
            {"purchase_order_id": purchase_order_id, "is_advance": True, "invoice_id": None},
            {"invoice_id": invoice_id},
        )

    async def sum_paid_by_invoice(self, invoice_ids: List[str]) -> Dict[str, float]:
        """Total paid per invoice for many invoices in one query."""
        ids = [iid for iid in set(invoice_ids) if iid]
        if not ids:
            return {}
        pipeline = [
            {"$match": {"invoice_id": {"$in": ids}}},
            {"$group": {"_id": "$invoice_id", "total": {"$sum": "$amount_paid"}}},
        ]
        rows = await self.collection.aggregate(pipeline).to_list(length=None)
        return {row["_id"]: float(row.get("total") or 0.0) for row in rows}
