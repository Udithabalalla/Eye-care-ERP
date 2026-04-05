from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
from app.models.common import TimestampModel


class StockReceiptItemModel(BaseModel):
    purchase_order_id: str
    product_id: str
    ordered_quantity: int
    received_quantity: int = Field(..., ge=0)


class StockReceiptModel(TimestampModel):
    id: str
    purchase_order_id: str
    supplier_id: str
    received_by: str
    received_at: datetime
    items: List[StockReceiptItemModel]
