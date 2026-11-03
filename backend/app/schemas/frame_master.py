from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime
from app.models.frame_master import FrameImage


class FrameMasterCreate(BaseModel):
    # "model_code" is a frame field, not a pydantic method
    model_config = ConfigDict(protected_namespaces=())

    brand: str = Field(..., min_length=1)
    model_code: str = Field(..., min_length=1)
    frame_name: str = Field(..., min_length=1)
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
    tags: List[str] = Field(default_factory=list)


class FrameMasterUpdate(BaseModel):
    # "model_code" is a frame field, not a pydantic method
    model_config = ConfigDict(protected_namespaces=())

    brand: Optional[str] = None
    model_code: Optional[str] = None
    frame_name: Optional[str] = None
    material: Optional[str] = None
    shape: Optional[str] = None
    rim_type: Optional[str] = None
    gender: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    default_eye_size: Optional[int] = None
    default_bridge_size: Optional[int] = None
    default_temple_length: Optional[int] = None
    supplier_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None


class FrameMasterResponse(BaseModel):
    # "model_code" is a frame field, not a pydantic method
    model_config = ConfigDict(protected_namespaces=())

    frame_master_id: str
    brand: str
    model_code: str
    frame_name: str
    material: Optional[str]
    shape: Optional[str]
    rim_type: Optional[str]
    gender: Optional[str]
    category: str
    description: Optional[str]
    default_eye_size: Optional[int]
    default_bridge_size: Optional[int]
    default_temple_length: Optional[int]
    supplier_ids: List[str]
    images: List[FrameImage]
    tags: List[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    variant_count: Optional[int] = 0
    total_stock: Optional[int] = 0
