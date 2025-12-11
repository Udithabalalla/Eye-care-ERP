from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

from app.utils.doctor_constants import DoctorSpecialization

class DoctorBase(BaseModel):
    name: str = Field(..., min_length=2)
    specialization: DoctorSpecialization
    qualification: Optional[str] = None
    experience_years: Optional[int] = Field(default=0, ge=0)
    contact_number: Optional[str] = None
    email: Optional[EmailStr] = None
    consultation_fee: float = Field(default=0.0, ge=0)
    available_days: List[str]
    available_time_start: str
    available_time_end: str
    is_active: bool = True

class DoctorCreate(DoctorBase):
    pass

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialization: Optional[DoctorSpecialization] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    contact_number: Optional[str] = None
    email: Optional[EmailStr] = None
    consultation_fee: Optional[float] = None
    available_days: Optional[List[str]] = None
    available_time_start: Optional[str] = None
    available_time_end: Optional[str] = None
    is_active: Optional[bool] = None

class DoctorResponse(DoctorBase):
    doctor_id: str
    created_at: datetime
    updated_at: datetime
