from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime

SaleLocation = Literal["institute", "clinic"]

from app.models.common import TimestampModel
from app.utils.constants import SalesOrderStatus


class StatusHistoryEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: str
    updated_at: datetime
    updated_by: str


class SalesOrderItemModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)
    discount: float = Field(default=0, ge=0, description="Line discount amount")
    total: float = Field(..., ge=0, description="quantity × unit_price − discount")
    master_data_id: Optional[str] = None
    frame_variant_id: Optional[str] = None
    line_type: Literal["product", "frame", "lens", "expense", "complimentary"] = "product"
    track_stock: bool = True


class SalesOrderModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    order_id: str
    order_number: str
    patient_id: str
    prescription_id: Optional[str] = None
    items: List[SalesOrderItemModel] = Field(default_factory=list)
    subtotal: float = Field(default=0, ge=0, description="Sum of line totals (after line discounts)")
    discount_amount: float = Field(default=0, ge=0, description="Order-level discount amount")
    total_amount: float = Field(default=0, ge=0, description="subtotal − discount_amount")
    measurements: Optional[Dict[str, Any]] = None
    tested_by: Optional[str] = None
    expected_delivery_date: Optional[datetime] = None
    date_of_full_payment: Optional[datetime] = None
    notes: Optional[str] = None
    invoice_id: Optional[str] = None
    sale_location: Optional[SaleLocation] = None
    status: SalesOrderStatus = Field(default=SalesOrderStatus.DRAFT)
    status_history: List[StatusHistoryEntry] = Field(default_factory=list)
    created_by: str