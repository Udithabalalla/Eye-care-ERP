from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.supplier_invoice_repository import SupplierInvoiceRepository
from app.repositories.supplier_repository import SupplierRepository
from app.schemas.supplier_invoice import SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse
from app.schemas.responses import PaginatedResponse
from app.models.supplier_invoice import SupplierInvoiceModel
from app.core.exceptions import NotFoundException
from app.utils.helpers import generate_id


class SupplierInvoiceService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SupplierInvoiceRepository(db)
        self.supplier_repo = SupplierRepository(db)

    async def list_supplier_invoices(self, page: int, page_size: int, supplier_id: Optional[str] = None, status: Optional[str] = None):
        skip = (page - 1) * page_size
        invoices, total = await self.repo.list_supplier_invoices(skip=skip, limit=page_size, supplier_id=supplier_id, status=status)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[SupplierInvoiceResponse(**invoice.dict()) for invoice in invoices],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def create_supplier_invoice(self, data: SupplierInvoiceCreate) -> SupplierInvoiceResponse:
        supplier = await self.supplier_repo.get_by_supplier_id(data.supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID {data.supplier_id} not found")
        next_number = await self.repo.count({}) + 1
        invoice_id = generate_id("SINV", next_number)
        invoice = SupplierInvoiceModel(id=invoice_id, **data.dict())
        created = await self.repo.create(invoice.dict())
        return SupplierInvoiceResponse(**created)

    async def update_supplier_invoice(self, invoice_id: str, data: SupplierInvoiceUpdate) -> SupplierInvoiceResponse:
        existing = await self.repo.get_by_invoice_id(invoice_id)
        if not existing:
            raise NotFoundException(f"Supplier invoice {invoice_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update({"id": invoice_id}, update_dict)
        updated = await self.repo.get_by_invoice_id(invoice_id)
        return SupplierInvoiceResponse(**updated.dict())
