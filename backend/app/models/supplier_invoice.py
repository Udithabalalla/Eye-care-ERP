from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from app.models.common import TimestampModel


class SupplierInvoiceModel(TimestampModel):
    id: str
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str
    invoice_date: datetime
    total_amount: float = Field(..., ge=0)
    due_date: Optional[date] = None
    status: str = Field(default="Unpaid")
