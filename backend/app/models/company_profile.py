from pydantic import BaseModel, ConfigDict, Field
from typing import Optional

from app.models.common import TimestampModel


class CompanyProfileModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default="company_profile")
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_number: Optional[str] = None