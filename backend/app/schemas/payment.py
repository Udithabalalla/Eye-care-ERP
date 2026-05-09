from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime, date

from app.utils.constants import PaymentMethod, LedgerReferenceType


class PaymentCreate(BaseModel):
    amount: float = Field(..., gt=0)
    payment_method: PaymentMethod
    reference_type: LedgerReferenceType
    reference_id: str
    payment_date: date


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    payment_id: str
    amount: float
    payment_method: PaymentMethod
    reference_type: LedgerReferenceType
    reference_id: str
    payment_date: datetime
    created_by: str
    transaction_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime