from pydantic import Field
from typing import Optional, List
from app.models.common import TimestampModel

from app.utils.doctor_constants import DoctorSpecialization

class DoctorModel(TimestampModel):
    """Doctor database model"""
    doctor_id: str = Field(..., description="Unique doctor identifier")
    name: str = Field(..., description="Doctor's full name")
    specialization: DoctorSpecialization = Field(..., description="Area of specialization")
    qualification: Optional[str] = Field(None, description="Medical qualifications")
    experience_years: Optional[int] = Field(default=0, description="Years of experience")
    contact_number: Optional[str] = Field(None, description="Contact number")
    email: Optional[str] = Field(None, description="Email address")
    consultation_fee: float = Field(default=0.0, description="Consultation fee")
    available_days: List[str] = Field(default=[], description="Available days of the week")
    available_time_start: str = Field(..., description="Start time of availability (HH:MM)")
    available_time_end: str = Field(..., description="End time of availability (HH:MM)")
    is_active: bool = Field(default=True, description="Active status")
    
    class Config:
        json_schema_extra = {
            "example": {
                "doctor_id": "DOC000001",
                "name": "Dr. Sarah Johnson",
                "specialization": "Ophthalmologist",
                "qualification": "MBBS, MS (Ophthalmology)",
                "experience_years": 8,
                "contact_number": "+1234567890",
                "email": "sarah.johnson@visionoptical.com",
                "consultation_fee": 50.0,
                "available_days": ["Monday", "Wednesday", "Friday"],
                "available_time_start": "09:00",
                "available_time_end": "17:00",
                "is_active": True
            }
        }
