from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.common import TimestampModel, Address
from app.utils.constants import Gender

class EmergencyContact(BaseModel):
    """Emergency contact information"""
    name: str
    relationship: str
    phone: str

class MedicalHistory(BaseModel):
    """Patient medical history"""
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    family_history: Optional[str] = None

class Insurance(BaseModel):
    """Insurance information"""
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None

class PatientModel(TimestampModel):
    """Patient database model"""
    patient_id: str = Field(..., description="Unique patient number")
    name: str = Field(..., description="Patient full name")
    date_of_birth: date = Field(..., description="Date of birth")
    age: int = Field(..., description="Current age")
    gender: Gender = Field(..., description="Gender")
    phone: str = Field(..., description="Contact phone")
    email: Optional[EmailStr] = None
    address: Optional[Address] = None
    emergency_contact: Optional[EmergencyContact] = None
    medical_history: Optional[MedicalHistory] = Field(default_factory=MedicalHistory)
    insurance: Optional[Insurance] = None
    last_visit: Optional[datetime] = None
    next_appointment: Optional[datetime] = None
    total_visits: int = 0
    notes: Optional[str] = None
    is_active: bool = True
    
    class Config:
        json_schema_extra = {
            "example": {
                "patient_id": "PAT000001",
                "name": "John Doe",
                "date_of_birth": "1990-01-15",
                "age": 34,
                "gender": "male",
                "phone": "+1234567890",
                "email": "john.doe@example.com"
            }
        }
