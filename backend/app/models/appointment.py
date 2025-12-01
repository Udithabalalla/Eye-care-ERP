from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.common import TimestampModel
from app.utils.constants import AppointmentStatus, AppointmentType

class AppointmentModel(TimestampModel):
    """Appointment database model"""
    appointment_id: str = Field(..., description="Unique appointment identifier")
    patient_id: str = Field(..., description="Reference to patient")
    patient_name: str = Field(..., description="Patient name (denormalized)")
    doctor_id: str = Field(..., description="Reference to doctor")
    doctor_name: str = Field(..., description="Doctor name (denormalized)")
    appointment_date: datetime = Field(..., description="Appointment date")  # Changed from date
    appointment_time: datetime = Field(..., description="Appointment time")  # Changed from time
    duration_minutes: int = Field(default=30, description="Duration in minutes")
    type: AppointmentType = Field(..., description="Appointment type")
    status: AppointmentStatus = Field(default=AppointmentStatus.SCHEDULED)
    reason: str = Field(..., description="Reason for visit")
    notes: Optional[str] = None
    reminder_sent: bool = False
    created_by: str = Field(..., description="User who created appointment")
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "appointment_id": "APT000001",
                "patient_id": "PAT000001",
                "patient_name": "John Doe",
                "doctor_id": "USR000002",
                "doctor_name": "Dr. Sarah Johnson",
                "appointment_date": "2024-02-01T00:00:00Z",
                "appointment_time": "2024-02-01T10:00:00Z",
                "type": "consultation",
                "status": "scheduled",
                "reason": "Regular eye checkup"
            }
        }
