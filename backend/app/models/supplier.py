from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from app.models.common import TimestampModel


class SupplierModel(TimestampModel):
    id: str = Field(..., description="Unique supplier identifier")
    supplier_name: str = Field(..., description="Supplier display name")
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
