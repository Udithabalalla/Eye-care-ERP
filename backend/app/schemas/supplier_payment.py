from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SupplierPaymentCreate(BaseModel):
    invoice_id: str
    payment_date: datetime
    payment_method: str
    amount_paid: float = Field(..., gt=0)
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class SupplierInvoicePaymentCreate(BaseModel):
    payment_date: datetime
    payment_method: str
    amount_paid: float = Field(..., gt=0)
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class SupplierPaymentResponse(BaseModel):
    id: str
    invoice_id: str
    payment_date: datetime
    payment_method: str
    amount_paid: float
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
