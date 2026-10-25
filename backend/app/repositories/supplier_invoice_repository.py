from motor.motor_asyncio import AsyncIOMotorDatabase
import re
from datetime import datetime
from typing import Optional, List, Tuple, Dict
from app.repositories.base import BaseRepository
from app.models.supplier_invoice import SupplierInvoiceModel


class SupplierInvoiceRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "supplier_invoices")

    async def get_by_invoice_id(self, invoice_id: str) -> Optional[SupplierInvoiceModel]:
        doc = await self.get_one({"id": invoice_id})
        return SupplierInvoiceModel(**doc) if doc else None

    async def get_by_invoice_number(self, invoice_number: str) -> Optional[SupplierInvoiceModel]:
        doc = await self.get_one({"invoice_number": invoice_number})
        return SupplierInvoiceModel(**doc) if doc else None

    async def list_supplier_invoices(
        self,
        skip: int = 0,
        limit: int = 10,
        supplier_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        matching_supplier_ids: Optional[List[str]] = None,
        overdue_before: Optional[datetime] = None,
    ) -> Tuple[List[SupplierInvoiceModel], int]:
        filter_query: dict = {}
        if supplier_id:
            filter_query["supplier_id"] = supplier_id
        if status:
            filter_query["status"] = status
        if overdue_before:
            # Still owing and past its due date
            filter_query["status"] = {"$ne": "Paid"}
            filter_query["due_date"] = {"$lt": overdue_before}
        if search:
            pattern = {"$regex": re.escape(search), "$options": "i"}
            clauses: list = [{"invoice_number": pattern}, {"purchase_order_id": pattern}]
            if matching_supplier_ids:
                clauses.append({"supplier_id": {"$in": matching_supplier_ids}})
            filter_query["$or"] = clauses

        docs, total = await self.get_many_with_count(filter_query, skip, limit, sort=[("created_at", -1)])
        invoices = [SupplierInvoiceModel(**d) for d in docs]
        return invoices, total

    async def get_many_by_ids(self, invoice_ids: List[str]) -> Dict[str, SupplierInvoiceModel]:
        """Fetch multiple invoices by ID in a single $in query. Returns a dict keyed by invoice id."""
        docs = await self.get_many({"id": {"$in": invoice_ids}}, limit=len(invoice_ids) + 1)
        return {doc["id"]: SupplierInvoiceModel(**doc) for doc in docs}

    async def get_latest_by_purchase_order_ids(self, order_ids: List[str]) -> Dict[str, SupplierInvoiceModel]:
        """The newest supplier invoice for each purchase order, in one query."""
        ids = [oid for oid in set(order_ids) if oid]
        if not ids:
            return {}
        docs = await self.get_many({"purchase_order_id": {"$in": ids}}, limit=0, sort=[("created_at", -1)])
        latest: Dict[str, SupplierInvoiceModel] = {}
        for doc in docs:
            latest.setdefault(doc["purchase_order_id"], SupplierInvoiceModel(**doc))
        return latest

    async def update_invoice_status(self, invoice_id: str, status: str) -> bool:
        return await self.update({"id": invoice_id}, {"status": status})
