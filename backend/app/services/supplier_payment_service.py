from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.supplier_payment_repository import SupplierPaymentRepository
from app.repositories.supplier_invoice_repository import SupplierInvoiceRepository
from app.schemas.supplier_payment import SupplierPaymentCreate, SupplierPaymentResponse
from app.schemas.responses import PaginatedResponse
from app.models.supplier_payment import SupplierPaymentModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id


class SupplierPaymentService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SupplierPaymentRepository(db)
        self.invoice_repo = SupplierInvoiceRepository(db)

    async def list_payments(self, page: int, page_size: int, invoice_id: Optional[str] = None):
        skip = (page - 1) * page_size
        payments, total = await self.repo.list_payments(skip=skip, limit=page_size, invoice_id=invoice_id)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[SupplierPaymentResponse(**payment.dict()) for payment in payments],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def record_payment(self, data: SupplierPaymentCreate) -> SupplierPaymentResponse:
        invoice = await self.invoice_repo.get_by_invoice_id(data.invoice_id)
        if not invoice:
            raise NotFoundException(f"Supplier invoice {data.invoice_id} not found")
        if data.amount_paid > invoice.total_amount:
            raise BadRequestException("Payment amount exceeds invoice total")
        payment_id = generate_id("SPAY", (await self.repo.count({})) + 1)
        payment = SupplierPaymentModel(id=payment_id, **data.dict())
        created = await self.repo.create(payment.dict())

        total_paid = await self.repo.sum_paid_for_invoice(data.invoice_id)
        next_status = "Paid" if total_paid >= invoice.total_amount else "Partial"
        await self.invoice_repo.update_invoice_status(data.invoice_id, next_status)

        return SupplierPaymentResponse(**created)
