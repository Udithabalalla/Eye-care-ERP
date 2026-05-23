from pydantic import BaseModel, Field
from typing import Optional, List
from app.models.common import TimestampModel


class FrameImage(BaseModel):
    url: str
    is_primary: bool = False
    caption: Optional[str] = None


class FrameMasterModel(TimestampModel):
    frame_master_id: str = Field(..., description="Unique master identifier e.g. FM-000001")
    brand: str
    model_code: str
    frame_name: str
    material: Optional[str] = None
    shape: Optional[str] = None
    rim_type: Optional[str] = None
    gender: Optional[str] = None
    category: str = "optical"
    description: Optional[str] = None

    default_eye_size: Optional[int] = None
    default_bridge_size: Optional[int] = None
    default_temple_length: Optional[int] = None

    supplier_ids: List[str] = Field(default_factory=list)
    images: List[FrameImage] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    is_active: bool = True

    class Config:
        json_schema_extra = {
            "example": {
                "frame_master_id": "FM-000001",
                "brand": "Boss",
                "model_code": "1602",
                "frame_name": "Boss 1602",
                "material": "metal",
                "shape": "rectangle",
                "rim_type": "full",
                "gender": "men",
                "category": "optical"
            }
        }
