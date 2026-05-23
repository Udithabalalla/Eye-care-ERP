from typing import Optional

from pydantic import ConfigDict, Field

from app.models.common import TimestampModel
from app.utils.constants import InventoryMovementType, LedgerReferenceType


class InventoryMovementModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    movement_id: str
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    movement_type: InventoryMovementType
    quantity: int
    reference_type: LedgerReferenceType
    reference_id: str
    created_by: str