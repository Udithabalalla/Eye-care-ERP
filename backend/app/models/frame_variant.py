from pydantic import BaseModel, Field
from typing import Optional
from app.models.common import TimestampModel


class FrameMasterRef(BaseModel):
    """Denormalized snapshot stored on the variant for fast reads."""
    brand: str
    model_code: str
    frame_name: str
    category: Optional[str] = None
    shape: Optional[str] = None


class FrameVariantModel(TimestampModel):
    variant_id: str = Field(..., description="Unique variant identifier e.g. FV-000001")
    sku: str = Field(..., description="Auto-generated: BOS-1602-BLK-52-F")
    barcode: str = Field(..., description="Equals SKU by default, Code128-encoded")

    frame_master_id: str
    frame_master_ref: FrameMasterRef

    color: str
    color_code: Optional[str] = None
    eye_size: int = Field(..., description="Lens diameter in mm")
    bridge_size: Optional[int] = None
    temple_length: Optional[int] = None
    rim_type: str = "full"

    cost_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    mrp: float = Field(default=0.0, ge=0)

    current_stock: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=2, ge=0)

    supplier_id: Optional[str] = None
    is_active: bool = True

    class Config:
        json_schema_extra = {
            "example": {
                "variant_id": "FV-000001",
                "sku": "BOS-1602-BLK-52-F",
                "barcode": "BOS-1602-BLK-52-F",
                "frame_master_id": "FM-000001",
                "color": "Black",
                "eye_size": 52,
                "rim_type": "full",
                "cost_price": 1200.0,
                "selling_price": 4500.0
            }
        }
