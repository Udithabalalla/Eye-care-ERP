from pydantic import BaseModel
from typing import Optional
from datetime import datetime


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


class CompanyProfileUpdate(CompanyProfileBase):
    pass


class CompanyProfileResponse(CompanyProfileBase):
    id: str
    created_at: datetime
    updated_at: datetime