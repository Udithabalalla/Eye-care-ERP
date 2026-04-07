from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PurchaseOrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    items: List[PurchaseOrderItemCreate] = Field(..., min_length=1)


class PurchaseOrderItemResponse(BaseModel):
    id: str
    purchase_order_id: str
    product_id: str
    quantity: int
    unit_cost: float


class PurchaseOrderResponse(BaseModel):
    id: str
    supplier_id: str
    order_date: datetime
    expected_delivery_date: Optional[datetime] = None
    status: str
    total_amount: float
    created_by: str
    items: List[PurchaseOrderItemResponse]
    created_at: datetime
    updated_at: datetime


class ReceiveStockItem(BaseModel):
    product_id: str
    ordered_quantity: int
    received_quantity: int = Field(..., ge=0)


class ReceiveStockRequest(BaseModel):
    items: List[ReceiveStockItem] = Field(..., min_length=1)
