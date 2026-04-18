from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.models.common import TimestampModel
from app.utils.constants import SalesOrderStatus


class SalesOrderItemModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    total: float = Field(..., ge=0)


class SalesOrderModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str
    order_number: str
    patient_id: str
    prescription_id: Optional[str] = None
    items: List[SalesOrderItemModel] = Field(default_factory=list)
    subtotal: float = Field(default=0, ge=0)
    total_amount: float = Field(default=0, ge=0)
    measurements: Optional[Dict[str, Any]] = None
    tested_by: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    notes: Optional[str] = None
    invoice_id: Optional[str] = None
    status: SalesOrderStatus = Field(default=SalesOrderStatus.DRAFT)
    created_by: str