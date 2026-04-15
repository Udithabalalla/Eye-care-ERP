from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date, datetime
import math

from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.sales_order_repository import SalesOrderRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, PaymentRecord
from app.schemas.responses import PaginatedResponse
from app.models.invoice import InvoiceModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id, date_to_datetime
from app.services.inventory_movement_service import InventoryMovementService
from app.services.audit_service import AuditService
from app.services.payment_service import PaymentService
from app.schemas.payment import PaymentCreate
from app.schemas.inventory_movement import InventoryMovementCreate
from app.utils.constants import InventoryMovementType, LedgerReferenceType

class InvoiceService:
    """Invoice business logic service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.invoice_repo = InvoiceRepository(db)
        self.patient_repo = PatientRepository(db)
        self.product_repo = ProductRepository(db)
        self.sales_order_repo = SalesOrderRepository(db)
        self.inventory_service = InventoryMovementService(db)
        self.audit_service = AuditService(db)
        self.payment_service = PaymentService(db)
    
    async def list_invoices(
        self,
        page: int,
        page_size: int,
        patient_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None
    ) -> PaginatedResponse[InvoiceResponse]:
        """List invoices with filters"""
        skip = (page - 1) * page_size
        
        invoices, total = await self.invoice_repo.list_invoices(
            skip=skip,
            limit=page_size,
            patient_id=patient_id,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
            search=search
        )
        
        total_pages = math.ceil(total / page_size)
        invoice_responses = [InvoiceResponse(**i.dict()) for i in invoices]
        
        return PaginatedResponse(
            data=invoice_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    async def get_invoice(self, invoice_id: str) -> InvoiceResponse:
        """Get invoice by ID"""
        invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        return InvoiceResponse(**invoice.dict())
    
    async def create_invoice(
        self,
        invoice_data: InvoiceCreate,
        current_user_id: str
    ) -> InvoiceResponse:
        """Create a new invoice"""
        # Validate product availability before attempting stock deduction.
        for item in invoice_data.items:
            product = await self.product_repo.get_by_product_id(item.product_id)
            if not product:
                raise NotFoundException(f"Product with ID {item.product_id} not found")
            if not product.is_active:
                raise BadRequestException(f"Product {item.product_name} is inactive")
            if product.current_stock < item.quantity:
                raise BadRequestException(
                    f"Insufficient stock for {product.name}. Available: {product.current_stock}, requested: {item.quantity}"
                )

        # Validate patient exists
        patient = await self.patient_repo.get_by_patient_id(invoice_data.patient_id)
        if not patient:
            raise NotFoundException(f"Patient with ID {invoice_data.patient_id} not found")

        if invoice_data.sales_order_id:
            sales_order = await self.sales_order_repo.get_by_order_id(invoice_data.sales_order_id)
            if not sales_order:
                raise NotFoundException(f"Sales order with ID {invoice_data.sales_order_id} not found")
        
        # Generate invoice ID and number
        next_number = await self.invoice_repo.get_next_invoice_number(datetime.now().year)
        invoice_id = generate_id("INV", int(next_number.split("-")[-1]))
        
        # Calculate totals
        subtotal = sum(item.total for item in invoice_data.items)
        total_discount = sum(item.discount for item in invoice_data.items)
        total_tax = sum(item.tax for item in invoice_data.items)
        total_amount = subtotal
        balance_due = total_amount
        
        # Convert dates to datetime
        invoice_date_dt = date_to_datetime(invoice_data.invoice_date)
        due_date_dt = date_to_datetime(invoice_data.due_date)
        
        # Create invoice model
        invoice_model = InvoiceModel(
            invoice_id=invoice_id,
            invoice_number=next_number,
            patient_name=patient.name,
            patient_phone=patient.phone,
            patient_email=patient.email,
            subtotal=subtotal,
            total_discount=total_discount,
            total_tax=total_tax,
            total_amount=total_amount,
            balance_due=balance_due,
            created_by=current_user_id,
            invoice_date=invoice_date_dt,
            due_date=due_date_dt,
            **invoice_data.dict(exclude={'invoice_date', 'due_date'})
        )
        
        # Deduct stock atomically for all items before invoice save.
        deducted_items = []
        try:
            for item in invoice_data.items:
                ok = await self.product_repo.decrement_stock_atomic(item.product_id, item.quantity)
                if not ok:
                    raise BadRequestException(
                        f"Failed to deduct stock for product {item.product_id}. Stock may have changed, please retry."
                    )
                deducted_items.append((item.product_id, item.quantity))

                await self.inventory_service.create_movement(
                    InventoryMovementCreate(
                        product_id=item.product_id,
                        movement_type=InventoryMovementType.SALE_OUT,
                        quantity=item.quantity,
                        reference_type=LedgerReferenceType.INVOICE,
                        reference_id=invoice_id,
                    ),
                    current_user_id,
                    apply_stock_change=False,
                )

            # Save invoice only after stock deduction succeeds.
            created_invoice = await self.invoice_repo.create_invoice(invoice_model)
        except Exception:
            # Best-effort rollback for already deducted items.
            for product_id, quantity in deducted_items:
                await self.product_repo.increment_stock_atomic(product_id, quantity)
            raise
        
        return InvoiceResponse(**created_invoice.dict())
    
    async def update_invoice(
        self,
        invoice_id: str,
        invoice_data: InvoiceUpdate
    ) -> InvoiceResponse:
        """Update invoice"""
        existing = await self.invoice_repo.get_by_invoice_id(invoice_id)
        if not existing:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        update_dict = invoice_data.dict(exclude_unset=True)
        
        # Convert date fields to datetime
        if 'due_date' in update_dict and update_dict['due_date']:
            update_dict['due_date'] = date_to_datetime(update_dict['due_date'])
        
        if update_dict:
            await self.invoice_repo.update_invoice(invoice_id, update_dict)
        
        updated_invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        return InvoiceResponse(**updated_invoice.dict())
    
    async def record_payment(
        self,
        invoice_id: str,
        payment: PaymentRecord,
        current_user_id: str,
    ):
        """Record a payment for an invoice"""
        invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        new_paid_amount = invoice.paid_amount + payment.amount
        new_balance = invoice.total_amount - new_paid_amount
        
        if new_paid_amount > invoice.total_amount:
            raise BadRequestException("Payment amount exceeds invoice total")
        
        payment_status = "paid" if new_balance == 0 else "partial"
        
        payment_record = await self.payment_service.create_payment(
            PaymentCreate(
                amount=payment.amount,
                payment_method=payment.payment_method,
                reference_type=LedgerReferenceType.INVOICE,
                reference_id=invoice_id,
                payment_date=payment.payment_date,
            ),
            current_user_id=current_user_id,
        )

        payment_date_dt = date_to_datetime(payment.payment_date)

        await self.invoice_repo.update_invoice(
            invoice_id,
            {
                "paid_amount": new_paid_amount,
                "balance_due": new_balance,
                "payment_status": payment_status,
                "payment_method": payment.payment_method,
                "payment_date": payment_date_dt,
                "transaction_id": payment_record.transaction_id,
            }
        )

        await self.audit_service.log(
            current_user_id,
            "invoice_payment_recorded",
            "Invoice",
            invoice_id,
            new_value={"paid_amount": new_paid_amount, "balance_due": new_balance},
        )
