from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date, datetime
from app.utils.constants import PaymentStatus, PaymentMethod
from app.models.invoice import InvoiceItem, InsuranceClaim

class InvoiceCreate(BaseModel):
    """Schema for creating an invoice"""
    patient_id: str
    invoice_date: date
    due_date: date
    items: List[InvoiceItem] = Field(..., min_length=1)
    prescription_id: Optional[str] = None
    appointment_id: Optional[str] = None
    payment_method: Optional[PaymentMethod] = None
    notes: Optional[str] = None

class InvoiceUpdate(BaseModel):
    """Schema for updating an invoice"""
    due_date: Optional[date] = None
    payment_status: Optional[PaymentStatus] = None
    prescription_id: Optional[str] = None
    notes: Optional[str] = None

class PaymentRecord(BaseModel):
    """Schema for recording a payment"""
    amount: float = Field(..., gt=0)
    payment_method: PaymentMethod
    payment_date: date
    transaction_id: Optional[str] = None
    notes: Optional[str] = None

class InvoiceResponse(BaseModel):
    """Schema for invoice response"""
    invoice_id: str
    invoice_number: str
    patient_id: str
    patient_name: str
    patient_phone: str
    patient_email: Optional[EmailStr]
    invoice_date: datetime
    due_date: datetime
    items: List[InvoiceItem]
    subtotal: float
    total_discount: float
    total_tax: float
    total_amount: float
    paid_amount: float
    balance_due: float
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod]
    payment_date: Optional[datetime]
    prescription_id: Optional[str]
    created_by: str
    created_at: datetime
