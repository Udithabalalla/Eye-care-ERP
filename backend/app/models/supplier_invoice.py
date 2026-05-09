from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from app.models.common import TimestampModel


class SupplierInvoiceItemModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str
    product_name: Optional[str] = None
    ordered_quantity: int = Field(..., ge=0)
    received_quantity: int = Field(..., ge=0)
    invoice_quantity: int = Field(..., ge=0)
    unit_price: float = Field(..., ge=0)
    line_total: float = Field(..., ge=0)
    warnings: List[str] = Field(default_factory=list)


class SupplierInvoiceModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    supplier_id: str
    purchase_order_id: Optional[str] = None
    invoice_number: str
    invoice_date: datetime
    total_amount: float = Field(..., ge=0)
    due_date: Optional[datetime] = None
    status: str = Field(default="Unpaid")
    items: List[SupplierInvoiceItemModel] = Field(default_factory=list)
    matching_status: str = Field(default="Matched")
    matching_issues: List[str] = Field(default_factory=list)
