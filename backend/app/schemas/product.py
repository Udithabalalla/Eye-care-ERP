from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from app.utils.constants import ProductCategory
from app.models.product import Supplier

class ProductCreate(BaseModel):
    """Schema for creating a product"""
    name: str = Field(..., min_length=2)
    description: Optional[str] = None
    category: ProductCategory
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    sku: str
    barcode: Optional[str] = None
    cost_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    mrp: float = Field(..., ge=0)
    discount_percentage: float = Field(default=0, ge=0, le=100)
    tax_percentage: float = Field(default=0, ge=0)
    current_stock: int = Field(default=0, ge=0)
    min_stock_level: int = Field(default=10, ge=0)
    max_stock_level: int = Field(default=1000, ge=0)
    reorder_quantity: int = Field(default=50, ge=0)
    supplier: Optional[Supplier] = None
    specifications: Dict[str, Any] = Field(default_factory=dict)
    expiry_date: Optional[date] = None  # Accept date from user
    is_prescription_required: bool = False

class ProductUpdate(BaseModel):
    """Schema for updating a product"""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ProductCategory] = None
    brand: Optional[str] = None
    cost_price: Optional[float] = Field(None, ge=0)
    selling_price: Optional[float] = Field(None, ge=0)
    mrp: Optional[float] = Field(None, ge=0)
    discount_percentage: Optional[float] = Field(None, ge=0, le=100)
    min_stock_level: Optional[int] = Field(None, ge=0)
    supplier: Optional[Supplier] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    """Schema for product response"""
    product_id: str
    name: str
    description: Optional[str]
    category: ProductCategory
    brand: Optional[str]
    sku: str
    barcode: Optional[str]
    cost_price: float
    selling_price: float
    mrp: float
    discount_percentage: float
    tax_percentage: float
    current_stock: int
    min_stock_level: int
    supplier: Optional[Supplier]
    expiry_date: Optional[datetime]  # Return as datetime
    is_active: bool
    is_prescription_required: bool
    created_at: datetime

class StockAdjustment(BaseModel):
    """Schema for stock adjustment"""
    quantity: int  # Positive to add, negative to remove
    reason: str
    notes: Optional[str] = None
