from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date, datetime
import math

from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.patient_repository import PatientRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, PaymentRecord
from app.schemas.responses import PaginatedResponse
from app.models.invoice import InvoiceModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id, date_to_datetime

class InvoiceService:
    """Invoice business logic service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.invoice_repo = InvoiceRepository(db)
        self.patient_repo = PatientRepository(db)
    
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
        # Validate patient exists
        patient = await self.patient_repo.get_by_patient_id(invoice_data.patient_id)
        if not patient:
            raise NotFoundException(f"Patient with ID {invoice_data.patient_id} not found")
        
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
        
        # Save to database
        created_invoice = await self.invoice_repo.create_invoice(invoice_model)
        
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
        payment: PaymentRecord
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
        
        # Convert payment_date to datetime
        payment_date_dt = date_to_datetime(payment.payment_date)
        
        await self.invoice_repo.update_invoice(
            invoice_id,
            {
                "paid_amount": new_paid_amount,
                "balance_due": new_balance,
                "payment_status": payment_status,
                "payment_method": payment.payment_method,
                "payment_date": payment_date_dt,
                "transaction_id": payment.transaction_id
            }
        )
