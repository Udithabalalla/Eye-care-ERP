from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.common import TimestampModel


class QuickIntakeItem(BaseModel):
    variant_id: Optional[str] = None
    product_id: Optional[str] = None
    sku: str
    variant_label: str = ""
    qty: int = Field(..., ge=1)
    cost_price: float = Field(..., ge=0)


class QuickIntakeModel(TimestampModel):
    intake_id: str = Field(..., description="QI-2026-0001")
    supplier_id: Optional[str] = None
    intake_date: datetime
    items: List[QuickIntakeItem] = Field(default_factory=list)
    status: str = "draft"
    notes: Optional[str] = None
    committed_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "intake_id": "QI-2026-0001",
                "supplier_id": "SUP000001",
                "intake_date": "2026-05-23T00:00:00Z",
                "status": "draft",
                "items": []
            }
        }
