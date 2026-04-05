from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.common import TimestampModel


class SupplierPaymentModel(TimestampModel):
    id: str
    invoice_id: str
    payment_date: datetime
    payment_method: str
    amount_paid: float = Field(..., gt=0)
    notes: Optional[str] = None
