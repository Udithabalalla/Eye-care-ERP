from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.utils.constants import TransactionType

class InventoryTransactionModel(BaseModel):
    """Inventory transaction model"""
    transaction_id: str
    product_id: str
    product_name: str
    transaction_type: TransactionType
    quantity: int  # Positive for in, negative for out
    previous_stock: int
    new_stock: int
    unit_cost: float = Field(..., ge=0)
    total_value: float
    reference_type: Optional[str] = None  # invoice, purchase_order, adjustment
    reference_id: Optional[str] = None
    notes: Optional[str] = None
    performed_by: str
    transaction_date: datetime = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "transaction_id": "TXN000001",
                "product_id": "PRD000001",
                "product_name": "Contact Lens Solution",
                "transaction_type": "sale",
                "quantity": -2,
                "previous_stock": 150,
                "new_stock": 148,
                "unit_cost": 8.50,
                "total_value": -17.00
            }
        }
