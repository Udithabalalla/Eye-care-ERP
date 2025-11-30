from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from app.models.common import TimestampModel
from app.utils.constants import PrescriptionType

class EyeMeasurement(BaseModel):
    """Eye measurement details"""
    sphere: Optional[float] = None  # SPH
    cylinder: Optional[float] = None  # CYL
    axis: Optional[int] = Field(None, ge=0, le=180)  # Axis in degrees
    add: Optional[float] = None  # Addition for reading
    prism: Optional[float] = None
    base: Optional[str] = None
    pupillary_distance: Optional[float] = None  # PD

class EyePrescription(BaseModel):
    """Complete eye prescription"""
    right_eye: EyeMeasurement
    left_eye: EyeMeasurement
    prescription_type: PrescriptionType

class Medication(BaseModel):
    """Medication details"""
    medication_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None
    quantity: int

class ContactLensSpec(BaseModel):
    """Contact lens specifications"""
    brand: str
    power: float
    base_curve: float
    diameter: float

class ContactLenses(BaseModel):
    """Contact lens prescription"""
    right_eye: ContactLensSpec
    left_eye: ContactLensSpec
    replacement_schedule: str  # daily, weekly, monthly

class PrescriptionModel(TimestampModel):
    """Prescription database model"""
    prescription_id: str = Field(..., description="Unique prescription identifier")
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    appointment_id: Optional[str] = None
    prescription_date: date
    valid_until: date
    eye_prescription: Optional[EyePrescription] = None
    medications: List[Medication] = Field(default_factory=list)
    contact_lenses: Optional[ContactLenses] = None
    diagnosis: str
    notes: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "prescription_id": "PRE000001",
                "patient_id": "PAT000001",
                "patient_name": "John Doe",
                "doctor_id": "USR000002",
                "doctor_name": "Dr. Sarah Johnson",
                "prescription_date": "2024-01-15",
                "valid_until": "2025-01-15",
                "diagnosis": "Myopia"
            }
        }
