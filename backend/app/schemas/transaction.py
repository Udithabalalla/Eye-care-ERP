from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

from app.utils.constants import LedgerTransactionType, LedgerReferenceType, PaymentMethod


class TransactionCreate(BaseModel):
    transaction_type: LedgerTransactionType
    reference_type: LedgerReferenceType
    reference_id: str
    amount: float = Field(..., gt=0)
    payment_method: Optional[PaymentMethod] = None
    currency: str = "LKR"
    status: str = "completed"


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    transaction_id: str
    transaction_type: LedgerTransactionType
    reference_type: LedgerReferenceType
    reference_id: str
    amount: float
    payment_method: Optional[PaymentMethod]
    currency: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime