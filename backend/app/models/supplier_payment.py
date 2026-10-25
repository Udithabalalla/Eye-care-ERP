from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from app.models.common import TimestampModel


class SupplierPaymentModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    # An advance is paid against the order before the supplier's invoice exists;
    # it gets the invoice id once that invoice is recorded
    invoice_id: Optional[str] = None
    purchase_order_id: Optional[str] = None
    is_advance: bool = False
    payment_date: datetime
    payment_method: str
    amount_paid: float = Field(..., gt=0)
    reference_number: Optional[str] = None
    notes: Optional[str] = None
