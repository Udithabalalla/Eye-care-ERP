from pydantic import ConfigDict, Field
from typing import Optional
from datetime import datetime

from app.models.common import TimestampModel
from app.utils.constants import PaymentMethod, LedgerReferenceType


class PaymentModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    payment_id: str
    amount: float = Field(..., gt=0)
    payment_method: PaymentMethod
    reference_type: LedgerReferenceType
    reference_id: str
    payment_date: datetime
    created_by: str
    transaction_id: Optional[str] = None