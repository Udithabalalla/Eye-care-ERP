from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models.common import TimestampModel
from app.utils.constants import PaymentStatus, PaymentMethod

class InvoiceItem(BaseModel):
    """Invoice item details"""
    product_id: str
    product_name: str
    sku: str
    quantity: int = Field(..., gt=0)  # Changed from ge=1 to gt=0 for clarity
    unit_price: float = Field(..., ge=0)
    discount: float = Field(default=0, ge=0)
    tax: float = Field(default=0, ge=0)
    total: float = Field(..., ge=0)

class InsuranceClaim(BaseModel):
    """Insurance claim details"""
    claim_number: Optional[str] = None
    provider: Optional[str] = None
    claim_amount: float = Field(default=0, ge=0)
    approved_amount: float = Field(default=0, ge=0)
    status: Optional[str] = None

class InvoiceModel(TimestampModel):
    """Invoice database model"""
    invoice_id: str
    invoice_number: str = Field(..., description="Unique invoice number")
    patient_id: str
    patient_name: str
    patient_phone: str
    patient_email: Optional[EmailStr] = None
    
    invoice_date: datetime  # Changed from date
    due_date: datetime  # Changed from date
    
    # Items
    items: List[InvoiceItem]
    
    # Calculations
    subtotal: float = Field(..., ge=0)
    total_discount: float = Field(default=0, ge=0)
    total_tax: float = Field(default=0, ge=0)
    total_amount: float = Field(..., ge=0)
    paid_amount: float = Field(default=0, ge=0)
    balance_due: float = Field(..., ge=0)
    
    # Payment
    payment_status: PaymentStatus = Field(default=PaymentStatus.PENDING)
    payment_method: Optional[PaymentMethod] = None
    payment_date: Optional[datetime] = None  # Changed from date
    transaction_id: Optional[str] = None
    
    # References
    prescription_id: Optional[str] = None
    appointment_id: Optional[str] = None
    
    # Insurance
    insurance_claim: Optional[InsuranceClaim] = None
    
    notes: Optional[str] = None
    created_by: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "invoice_id": "INV000001",
                "invoice_number": "INV-2024-001",
                "patient_id": "PAT000001",
                "patient_name": "John Doe",
                "patient_phone": "+1234567890",
                "invoice_date": "2024-01-15T00:00:00Z",
                "due_date": "2024-02-15T00:00:00Z",
                "subtotal": 100.00,
                "total_amount": 108.00,
                "payment_status": "paid"
            }
        }
