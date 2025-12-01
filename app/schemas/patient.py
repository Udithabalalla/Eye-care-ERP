from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime  # Keep date for input, datetime for response
from app.utils.constants import Gender
from app.models.patient import EmergencyContact, MedicalHistory, Insurance
from app.models.common import Address

class PatientCreate(BaseModel):
    """Schema for creating a patient"""
    name: str = Field(..., min_length=2)
    date_of_birth: date  # Accept date from user
    gender: Gender
    phone: str = Field(..., min_length=10)
    email: Optional[EmailStr] = None
    address: Optional[Address] = None
    emergency_contact: Optional[EmergencyContact] = None
    medical_history: Optional[MedicalHistory] = None
    insurance: Optional[Insurance] = None
    notes: Optional[str] = None

class PatientUpdate(BaseModel):
    """Schema for updating a patient"""
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[Address] = None
    emergency_contact: Optional[EmergencyContact] = None
    medical_history: Optional[MedicalHistory] = None
    insurance: Optional[Insurance] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class PatientResponse(BaseModel):
    """Schema for patient response"""
    patient_id: str
    name: str
    date_of_birth: datetime  # Return as datetime
    age: int
    gender: Gender
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[Address] = None
    emergency_contact: Optional[EmergencyContact] = None
    medical_history: Optional[MedicalHistory] = None
    insurance: Optional[Insurance] = None
    last_visit: Optional[datetime] = None
    next_appointment: Optional[datetime] = None
    total_visits: int
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
