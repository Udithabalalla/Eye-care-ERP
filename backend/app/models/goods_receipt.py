from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.common import TimestampModel


class GoodsReceiptItem(BaseModel):
    variant_id: str
    sku: str
    variant_label: str = ""
    expected_qty: int = Field(default=0, ge=0)
    received_qty: int = Field(default=0, ge=0)
    damaged_qty: int = Field(default=0, ge=0)
    missing_qty: int = Field(default=0, ge=0)
    extra_qty: int = Field(default=0, ge=0)
    cost_price: float = Field(..., ge=0)
    notes: Optional[str] = None


class GoodsReceiptModel(TimestampModel):
    grn_number: str = Field(..., description="GRN-2026-0001")
    purchase_order_id: Optional[str] = None
    supplier_id: str
    receipt_date: datetime
    items: List[GoodsReceiptItem] = Field(default_factory=list)
    status: str = "complete"
    notes: Optional[str] = None
    created_by: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "grn_number": "GRN-2026-0001",
                "supplier_id": "SUP000001",
                "receipt_date": "2026-05-23T00:00:00Z",
                "items": []
            }
        }
