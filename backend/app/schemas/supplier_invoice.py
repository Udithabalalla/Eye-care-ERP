from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class SupplierInvoiceCreate(BaseModel):
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str = Field(..., min_length=1)
    invoice_date: datetime
    total_amount: float = Field(..., ge=0)
    due_date: Optional[date] = None
    status: str = "Unpaid"


class SupplierInvoiceUpdate(BaseModel):
    status: Optional[str] = None
    due_date: Optional[date] = None


class SupplierInvoiceResponse(BaseModel):
    id: str
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str
    invoice_date: datetime
    total_amount: float
    due_date: Optional[date] = None
    status: str
    created_at: datetime
    updated_at: datetime
