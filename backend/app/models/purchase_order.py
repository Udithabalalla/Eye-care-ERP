from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.common import TimestampModel


class PurchaseOrderItemModel(BaseModel):
    id: str
    purchase_order_id: str
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)


class PurchaseOrderModel(TimestampModel):
    id: str
    supplier_id: str
    order_date: datetime
    expected_delivery_date: Optional[date] = None
    status: str = Field(default="Draft")
    total_amount: float = Field(default=0, ge=0)
    created_by: str
    items: List[PurchaseOrderItemModel] = Field(default_factory=list)
