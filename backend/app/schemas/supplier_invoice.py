from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SupplierInvoiceItemCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    ordered_quantity: int = Field(..., ge=0)
    received_quantity: int = Field(..., ge=0)
    invoice_quantity: int = Field(..., ge=0)
    unit_price: float = Field(..., ge=0)


class SupplierInvoiceItemResponse(SupplierInvoiceItemCreate):
    line_total: float = Field(..., ge=0)
    warnings: List[str] = Field(default_factory=list)


class SupplierInvoiceCreate(BaseModel):
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str = Field(..., min_length=1)
    invoice_date: datetime
    due_date: Optional[datetime] = None
    status: str = "Unpaid"
    total_amount: Optional[float] = Field(default=None, ge=0)
    items: Optional[List[SupplierInvoiceItemCreate]] = None


class SupplierInvoiceUpdate(BaseModel):
    status: Optional[str] = None
    due_date: Optional[datetime] = None


class SupplierInvoiceResponse(BaseModel):
    id: str
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str
    invoice_date: datetime
    total_amount: float
    due_date: Optional[datetime] = None
    status: str
    items: List[SupplierInvoiceItemResponse] = Field(default_factory=list)
    matching_status: str = "Matched"
    matching_issues: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
