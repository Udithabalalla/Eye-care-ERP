from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

from app.models.sales_order import SalesOrderItemModel
from app.utils.constants import SalesOrderStatus


class SalesOrderItemCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    total: float = Field(..., ge=0)


class SalesOrderCreate(BaseModel):
    patient_id: str
    prescription_id: Optional[str] = None
    items: List[SalesOrderItemCreate] = Field(default_factory=list, min_length=1)
    status: SalesOrderStatus = SalesOrderStatus.DRAFT


class SalesOrderUpdate(BaseModel):
    prescription_id: Optional[str] = None
    items: Optional[List[SalesOrderItemCreate]] = None
    status: Optional[SalesOrderStatus] = None


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    order_id: str
    order_number: str
    patient_id: str
    prescription_id: Optional[str]
    items: List[SalesOrderItemModel]
    status: SalesOrderStatus
    created_by: str
    created_at: datetime
    updated_at: datetime