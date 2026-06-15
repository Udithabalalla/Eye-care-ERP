from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime

from app.utils.constants import InventoryMovementType, LedgerReferenceType


class InventoryMovementCreate(BaseModel):
    product_id: str
    variant_id: Optional[str] = None
    movement_type: InventoryMovementType
    quantity: int
    reference_type: LedgerReferenceType
    reference_id: str


class InventoryMovementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    movement_id: str
    product_id: str
    variant_id: Optional[str] = None
    movement_type: InventoryMovementType
    quantity: int
    reference_type: LedgerReferenceType
    reference_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime