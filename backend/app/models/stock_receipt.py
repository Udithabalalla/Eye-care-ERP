from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.models.common import TimestampModel


class StockReceiptItemModel(BaseModel):
    product_id: str
    received_quantity: int
    ordered_quantity: Optional[int] = 0


class StockReceiptModel(TimestampModel):
    id: str
    purchase_order_id: str
    supplier_id: Optional[str] = None
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None
    items: List[StockReceiptItemModel] = []
