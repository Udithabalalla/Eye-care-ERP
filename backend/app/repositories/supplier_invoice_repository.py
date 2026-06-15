from motor.motor_asyncio import AsyncIOMotorDatabase
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

    async def list_supplier_invoices(self, skip: int = 0, limit: int = 10, supplier_id: Optional[str] = None, status: Optional[str] = None) -> Tuple[List[SupplierInvoiceModel], int]:
        filter_query = {}
        if supplier_id:
            filter_query["supplier_id"] = supplier_id
        if status:
            filter_query["status"] = status

        docs, total = await self.get_many_with_count(filter_query, skip, limit, sort=[("created_at", -1)])
        invoices = [SupplierInvoiceModel(**d) for d in docs]
        return invoices, total

    async def get_many_by_ids(self, invoice_ids: List[str]) -> Dict[str, SupplierInvoiceModel]:
        """Fetch multiple invoices by ID in a single $in query. Returns a dict keyed by invoice id."""
        docs = await self.get_many({"id": {"$in": invoice_ids}}, limit=len(invoice_ids) + 1)
        return {doc["id"]: SupplierInvoiceModel(**doc) for doc in docs}

    async def update_invoice_status(self, invoice_id: str, status: str) -> bool:
        return await self.update({"id": invoice_id}, {"status": status})
