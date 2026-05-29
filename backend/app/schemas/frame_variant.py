from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from app.models.frame_variant import FrameMasterRef


class FrameVariantCreate(BaseModel):
    frame_master_id: str
    color: str = Field(..., min_length=1)
    color_code: Optional[str] = None
    eye_size: int = Field(..., ge=30, le=80)
    bridge_size: Optional[int] = None
    temple_length: Optional[int] = None
    rim_type: str = "full"
    cost_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    mrp: float = Field(default=0.0, ge=0)
    current_stock: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=2, ge=0)
    supplier_id: Optional[str] = None
    supplier_frame_no: Optional[str] = None
    institute_stock_nos: Optional[List[int]] = None


class FrameVariantBulkCreate(BaseModel):
    """Create many variants for one frame master at once."""
    frame_master_id: str
    colors: List[str]
    eye_sizes: List[int]
    rim_type: str = "full"
    bridge_size: Optional[int] = None
    temple_length: Optional[int] = None
    cost_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    mrp: float = Field(default=0.0, ge=0)
    reorder_level: int = Field(default=2, ge=0)
    supplier_id: Optional[str] = None


class FrameVariantUpdate(BaseModel):
    color: Optional[str] = None
    color_code: Optional[str] = None
    eye_size: Optional[int] = None
    bridge_size: Optional[int] = None
    temple_length: Optional[int] = None
    rim_type: Optional[str] = None
    cost_price: Optional[float] = Field(None, ge=0)
    selling_price: Optional[float] = Field(None, ge=0)
    mrp: Optional[float] = Field(None, ge=0)
    reorder_level: Optional[int] = Field(None, ge=0)
    supplier_id: Optional[str] = None
    supplier_frame_no: Optional[str] = None
    institute_stock_nos: Optional[List[int]] = None
    sale_location: Optional[Literal["institute", "clinic"]] = None
    is_active: Optional[bool] = None


class StockAdjustVariant(BaseModel):
    new_stock: int = Field(..., ge=0)
    reason: str
    notes: Optional[str] = None


class FrameVariantResponse(BaseModel):
    variant_id: str
    sku: str
    barcode: str
    frame_master_id: str
    frame_master_ref: FrameMasterRef
    color: str
    color_code: Optional[str]
    eye_size: int
    bridge_size: Optional[int]
    temple_length: Optional[int]
    rim_type: str
    cost_price: float
    selling_price: float
    mrp: float
    current_stock: int
    reorder_level: int
    supplier_id: Optional[str]
    supplier_frame_no: Optional[str] = None
    institute_stock_nos: Optional[List[int]] = None
    sale_location: Optional[Literal["institute", "clinic"]] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @property
    def display_label(self) -> str:
        return f"{self.frame_master_ref.brand} {self.frame_master_ref.model_code} / {self.color} / {self.eye_size} / {self.rim_type.capitalize()}"

    @property
    def is_low_stock(self) -> bool:
        return self.current_stock <= self.reorder_level

    @property
    def is_out_of_stock(self) -> bool:
        return self.current_stock == 0
