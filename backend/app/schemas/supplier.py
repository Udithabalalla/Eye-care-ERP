from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


class SupplierCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    supplier_name: str = Field(..., min_length=2, validation_alias=AliasChoices("supplier_name", "name"))
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("payment_terms", mode="before")
    @classmethod
    def normalize_payment_terms(cls, value):
        if value is None:
            return None
        return str(value)


class SupplierUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    supplier_name: Optional[str] = Field(default=None, validation_alias=AliasChoices("supplier_name", "name"))
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("payment_terms", mode="before")
    @classmethod
    def normalize_payment_terms(cls, value):
        if value is None:
            return None
        return str(value)


class SupplierResponse(BaseModel):
    id: str
    supplier_name: str
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
