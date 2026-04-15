from pydantic import ConfigDict, Field
from typing import Optional

from app.models.common import TimestampModel
from app.utils.constants import LedgerTransactionType, LedgerReferenceType, PaymentMethod


class TransactionModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str
    transaction_type: LedgerTransactionType
    reference_type: LedgerReferenceType
    reference_id: str
    amount: float = Field(..., gt=0)
    payment_method: Optional[PaymentMethod] = None
    currency: str = "LKR"
    status: str = Field(default="completed")
    created_by: str