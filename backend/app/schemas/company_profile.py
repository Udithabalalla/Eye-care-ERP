from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.models.company_profile import InvoiceAppearance


class CompanyProfileBase(BaseModel):
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None
    default_ship_to_location: Optional[str] = None
    default_delivery_address: Optional[str] = None
    default_receiving_department: Optional[str] = None
    default_delivery_instructions: Optional[str] = None
    # Printed at the foot of every customer invoice
    invoice_terms: Optional[str] = None


class CompanyProfileUpdate(CompanyProfileBase):
    invoice_appearance: Optional[InvoiceAppearance] = None


class CompanyProfileResponse(CompanyProfileBase):
    id: str
    # Always complete: the defaults until the shop changes them
    invoice_appearance: InvoiceAppearance = Field(default_factory=InvoiceAppearance)
    created_at: datetime
    updated_at: datetime