from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

from app.models.sales_order import SalesOrderItemModel
from app.utils.constants import SalesOrderStatus


class SalesOrderItemCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    total: Optional[float] = Field(default=None, ge=0)
    master_data_id: Optional[str] = None
    line_type: Literal["product", "lens", "expense"] = "product"
    track_stock: bool = True


class SalesOrderCreate(BaseModel):
    patient_id: str
    prescription_id: Optional[str] = None
    items: List[SalesOrderItemCreate] = Field(default_factory=list, min_length=1)
    measurements: Optional[Dict[str, Any]] = None
    tested_by: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: SalesOrderStatus = SalesOrderStatus.CONFIRMED


class SalesOrderUpdate(BaseModel):
    prescription_id: Optional[str] = None
    items: Optional[List[SalesOrderItemCreate]] = None
    measurements: Optional[Dict[str, Any]] = None
    tested_by: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[SalesOrderStatus] = None


class SalesOrderStatusUpdate(BaseModel):
    status: SalesOrderStatus


class SalesOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    order_id: str
    order_number: str
    patient_id: str
    patient_name: Optional[str] = None
    prescription_id: Optional[str]
    items: List[SalesOrderItemModel]
    subtotal: float
    total_amount: float
    measurements: Optional[Dict[str, Any]] = None
    tested_by: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    invoice_id: Optional[str] = None
    status: SalesOrderStatus
    created_by: str
    created_at: datetime
    updated_at: datetime
