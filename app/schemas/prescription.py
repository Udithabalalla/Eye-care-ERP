from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from app.models.prescription import (
    EyeMeasurement, EyePrescription, Medication, 
    ContactLensSpec, ContactLenses
)

class PrescriptionCreate(BaseModel):
    """Schema for creating a prescription"""
    patient_id: str
    doctor_id: str
    prescription_date: date
    valid_until: date
    eye_prescription: Optional[EyePrescription] = None
    medications: List[Medication] = Field(default_factory=list)
    contact_lenses: Optional[ContactLenses] = None
    diagnosis: str = Field(..., min_length=5)
    notes: Optional[str] = None
    appointment_id: Optional[str] = None

class PrescriptionUpdate(BaseModel):
    """Schema for updating a prescription"""
    notes: Optional[str] = None
    diagnosis: Optional[str] = None

class PrescriptionResponse(BaseModel):
    """Schema for prescription response"""
    prescription_id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    appointment_id: Optional[str]
    prescription_date: datetime
    valid_until: datetime
    eye_prescription: Optional[EyePrescription]
    medications: List[Medication]
    contact_lenses: Optional[ContactLenses]
    diagnosis: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
