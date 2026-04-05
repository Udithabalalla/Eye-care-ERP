from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.supplier_invoice import SupplierInvoiceModel


class SupplierInvoiceRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "supplier_invoices")

    async def get_by_invoice_id(self, invoice_id: str) -> Optional[SupplierInvoiceModel]:
        invoice = await self.get_one({"id": invoice_id})
        return SupplierInvoiceModel(**invoice) if invoice else None

    async def list_supplier_invoices(self, skip: int = 0, limit: int = 10, supplier_id: Optional[str] = None, status: Optional[str] = None) -> Tuple[List[SupplierInvoiceModel], int]:
        filter_query = {}
        if supplier_id:
            filter_query["supplier_id"] = supplier_id
        if status:
            filter_query["status"] = status
        docs = await self.get_many(filter_query, skip=skip, limit=limit, sort=[("created_at", -1)])
        total = await self.count(filter_query)
        return [SupplierInvoiceModel(**doc) for doc in docs], total

    async def update_invoice_status(self, invoice_id: str, status: str) -> bool:
        return await self.update({"id": invoice_id}, {"status": status})
