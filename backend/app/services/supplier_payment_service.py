from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.supplier_payment_repository import SupplierPaymentRepository
from app.repositories.supplier_invoice_repository import SupplierInvoiceRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.schemas.supplier_payment import SupplierPaymentCreate, SupplierInvoicePaymentCreate, SupplierPaymentResponse
from app.schemas.responses import PaginatedResponse
from app.models.supplier_payment import SupplierPaymentModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id
from app.services.payment_service import PaymentService
from app.schemas.payment import PaymentCreate
from app.utils.constants import LedgerReferenceType, PaymentMethod


class SupplierPaymentService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SupplierPaymentRepository(db)
        self.invoice_repo = SupplierInvoiceRepository(db)
        self.supplier_repo = SupplierRepository(db)
        self.purchase_order_repo = PurchaseOrderRepository(db)
        self.payment_service = PaymentService(db)

    async def _enrich_payment(self, payment_dict: dict) -> SupplierPaymentResponse:
        invoice = await self.invoice_repo.get_by_invoice_id(payment_dict["invoice_id"]) if payment_dict.get("invoice_id") else None
        payment_dict["invoice_number"] = invoice.invoice_number if invoice else None
        if invoice:
            supplier = await self.supplier_repo.get_by_supplier_id(invoice.supplier_id)
            payment_dict["supplier_id"] = invoice.supplier_id
            payment_dict["supplier_name"] = supplier.supplier_name if supplier else None
            payment_dict["purchase_order_id"] = invoice.purchase_order_id
        return SupplierPaymentResponse(**payment_dict)

    async def list_payments(self, page: int, page_size: int, invoice_id: Optional[str] = None, purchase_order_id: Optional[str] = None):
        skip = (page - 1) * page_size
        order_invoice_ids = None
        if purchase_order_id:
            invoices = await self.invoice_repo.get_many({"purchase_order_id": purchase_order_id}, limit=0, projection={"id": 1})
            order_invoice_ids = [inv["id"] for inv in invoices]
        payments, total = await self.repo.list_payments(
            skip=skip, limit=page_size, invoice_id=invoice_id,
            purchase_order_id=purchase_order_id, order_invoice_ids=order_invoice_ids,
        )
        total_pages = math.ceil(total / page_size)

        # Batch-fetch all invoices in one $in query to avoid N+1
        unique_invoice_ids = list({p.invoice_id for p in payments if p.invoice_id})
        invoices_by_id = await self.invoice_repo.get_many_by_ids(unique_invoice_ids)
        # Advances not yet against an invoice name their supplier through the order
        orders_by_id = {}
        for order_id in {p.purchase_order_id for p in payments if p.purchase_order_id and not p.invoice_id}:
            order = await self.purchase_order_repo.get_by_order_id(order_id)
            if order:
                orders_by_id[order_id] = order
        supplier_names: dict[str, Optional[str]] = {}
        supplier_ids = {inv.supplier_id for inv in invoices_by_id.values()} | {o.supplier_id for o in orders_by_id.values()}
        for supplier_id in supplier_ids:
            supplier = await self.supplier_repo.get_by_supplier_id(supplier_id)
            supplier_names[supplier_id] = supplier.supplier_name if supplier else None

        def _make_response(payment: SupplierPaymentModel) -> SupplierPaymentResponse:
            data = payment.dict()
            invoice = invoices_by_id.get(payment.invoice_id) if payment.invoice_id else None
            if invoice:
                data["invoice_number"] = invoice.invoice_number
                data["supplier_id"] = invoice.supplier_id
                data["supplier_name"] = supplier_names.get(invoice.supplier_id)
                data["purchase_order_id"] = invoice.purchase_order_id or payment.purchase_order_id
            elif payment.purchase_order_id in orders_by_id:
                order = orders_by_id[payment.purchase_order_id]
                data["supplier_id"] = order.supplier_id
                data["supplier_name"] = supplier_names.get(order.supplier_id)
            return SupplierPaymentResponse(**data)

        return PaginatedResponse(
            data=[_make_response(p) for p in payments],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def record_payment(self, data: SupplierPaymentCreate, current_user_id: str) -> SupplierPaymentResponse:
        invoice = await self.invoice_repo.get_by_invoice_id(data.invoice_id)
        if not invoice:
            raise NotFoundException(f"Supplier invoice {data.invoice_id} not found")
        total_paid = await self.repo.sum_paid_for_invoice(data.invoice_id)
        remaining_balance = max(0.0, invoice.total_amount - total_paid)
        if data.amount_paid > remaining_balance:
            raise BadRequestException("Payment amount exceeds remaining invoice balance")
        payment_id = generate_id("SPAY", (await self.repo.count({})) + 1)
        payment = SupplierPaymentModel(id=payment_id, purchase_order_id=invoice.purchase_order_id, **data.dict())
        created = await self.repo.create(payment.dict())

        await self.payment_service.create_payment(
            PaymentCreate(
                amount=data.amount_paid,
                payment_method=PaymentMethod(data.payment_method),
                reference_type=LedgerReferenceType.SUPPLIER_INVOICE,
                reference_id=data.invoice_id,
                payment_date=data.payment_date.date(),
            ),
            created_by=current_user_id,
        )

        next_total_paid = total_paid + data.amount_paid
        next_status = "Paid" if next_total_paid >= invoice.total_amount else "Partial"
        await self.invoice_repo.update_invoice_status(data.invoice_id, next_status)

        # If invoice is fully paid and linked to a purchase order, attempt to close the PO
        if next_status == "Paid" and invoice.purchase_order_id:
            try:
                # Import locally to avoid import cycles
                from app.services.purchase_order_service import PurchaseOrderService

                po_service = PurchaseOrderService(self.invoice_repo.db)
                # Attempt to close the purchase order. If transition is invalid (e.g., not Received),
                # PurchaseOrderService.update_status will raise BadRequestException which we ignore here.
                await po_service.update_status(invoice.purchase_order_id, "Closed", updated_by=current_user_id)
            except BadRequestException:
                # PO not in a state that allows closing; ignore
                pass
            except Exception:
                # Do not fail the payment flow for PO close errors; log could be added here
                pass

        created["invoice_number"] = invoice.invoice_number
        return SupplierPaymentResponse(**created)

    # An order can be paid ahead once it's approved, until its invoice arrives
    ADVANCE_STATUSES = ("Approved", "Ordered", "Partially Received", "Received")

    async def record_advance(self, purchase_order_id: str, data: SupplierInvoicePaymentCreate, current_user_id: str) -> SupplierPaymentResponse:
        """Pay a supplier before their invoice — it's counted against the invoice once it's recorded."""
        order = await self.purchase_order_repo.get_by_order_id(purchase_order_id)
        if not order:
            raise NotFoundException(f"Purchase order {purchase_order_id} not found")
        if order.status == "Draft":
            raise BadRequestException("Approve the purchase order before paying for it")
        if order.status not in self.ADVANCE_STATUSES:
            raise BadRequestException(f"{purchase_order_id} is {order.status.lower()}; nothing more can be paid on it")
        invoice = await self.invoice_repo.get_one({"purchase_order_id": purchase_order_id})
        if invoice:
            raise BadRequestException(
                f"The supplier's invoice {invoice['invoice_number']} is in — pay against the invoice instead"
            )

        already = (await self.repo.sum_unapplied_advances([purchase_order_id])).get(purchase_order_id, 0.0)
        remaining = round(max(0.0, order.total_amount - already), 2)
        if data.amount_paid > remaining + 0.005:
            raise BadRequestException(
                f"That's more than the order total — at most {remaining:,.2f} can still be paid in advance"
            )

        payment_id = generate_id("SPAY", (await self.repo.count({})) + 1)
        payment = SupplierPaymentModel(
            id=payment_id,
            invoice_id=None,
            purchase_order_id=purchase_order_id,
            is_advance=True,
            **data.dict(),
        )
        created = await self.repo.create(payment.dict())
        await self.payment_service.create_payment(
            PaymentCreate(
                amount=data.amount_paid,
                payment_method=PaymentMethod(data.payment_method),
                reference_type=LedgerReferenceType.PURCHASE_ORDER,
                reference_id=purchase_order_id,
                payment_date=data.payment_date.date(),
            ),
            created_by=current_user_id,
        )
        created["supplier_id"] = order.supplier_id
        created["supplier_name"] = order.supplier_information.supplier_name if order.supplier_information else None
        return SupplierPaymentResponse(**created)

    async def record_invoice_payment(self, invoice_id: str, data: SupplierInvoicePaymentCreate, current_user_id: str) -> SupplierPaymentResponse:
        payment_data = SupplierPaymentCreate(
            invoice_id=invoice_id,
            payment_date=data.payment_date,
            payment_method=data.payment_method,
            amount_paid=data.amount_paid,
            reference_number=data.reference_number,
            notes=data.notes,
        )
        return await self.record_payment(payment_data, current_user_id)
