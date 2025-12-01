from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.common import TimestampModel
from app.utils.constants import ProductCategory

class Supplier(BaseModel):
    """Supplier information"""
    name: str
    contact: Optional[str] = None
    email: Optional[str] = None

class ProductModel(TimestampModel):
    """Product database model"""
    product_id: str = Field(..., description="Unique product identifier")
    name: str
    description: Optional[str] = None
    category: ProductCategory
    subcategory: Optional[str] = None
    brand: Optional[str] = None
    sku: str = Field(..., description="Stock Keeping Unit")
    barcode: Optional[str] = None
    upc: Optional[str] = None
    
    # Pricing
    cost_price: float = Field(..., ge=0)
    selling_price: float = Field(..., ge=0)
    mrp: float = Field(..., ge=0)
    discount_percentage: float = Field(default=0, ge=0, le=100)
    tax_percentage: float = Field(default=0, ge=0)
    
    # Inventory
    current_stock: int = Field(default=0, ge=0)
    min_stock_level: int = Field(default=10, ge=0)
    max_stock_level: int = Field(default=1000, ge=0)
    reorder_quantity: int = Field(default=50, ge=0)
    unit_of_measure: str = "piece"  # piece, box, bottle
    
    # Supplier
    supplier: Optional[Supplier] = None
    
    # Product Details
    specifications: Dict[str, Any] = Field(default_factory=dict)
    images: List[str] = Field(default_factory=list)
    expiry_date: Optional[datetime] = None  # Changed from date
    manufacturing_date: Optional[datetime] = None  # Changed from date
    batch_number: Optional[str] = None
    warranty_months: Optional[int] = None
    
    is_active: bool = True
    is_prescription_required: bool = False
    
    class Config:
        json_schema_extra = {
            "example": {
                "product_id": "PRD000001",
                "name": "Contact Lens Solution 360ml",
                "category": "accessories",
                "sku": "CLS-360",
                "cost_price": 8.50,
                "selling_price": 12.99,
                "mrp": 14.99,
                "current_stock": 150
            }
        }
