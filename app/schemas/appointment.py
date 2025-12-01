from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, time, datetime
from app.utils.constants import AppointmentStatus, AppointmentType

class AppointmentCreate(BaseModel):
    """Schema for creating an appointment"""
    patient_id: str
    doctor_id: str
    appointment_date: date
    appointment_time: time
    duration_minutes: int = Field(default=30, ge=15, le=240)
    type: AppointmentType
    reason: str = Field(..., min_length=5)
    notes: Optional[str] = None

class AppointmentUpdate(BaseModel):
    """Schema for updating an appointment"""
    appointment_date: Optional[date] = None
    appointment_time: Optional[time] = None
    duration_minutes: Optional[int] = Field(None, ge=15, le=240)
    type: Optional[AppointmentType] = None
    status: Optional[AppointmentStatus] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class AppointmentResponse(BaseModel):
    """Schema for appointment response"""
    appointment_id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    appointment_date: datetime
    appointment_time: datetime
    duration_minutes: int
    type: AppointmentType
    status: AppointmentStatus
    reason: str
    notes: Optional[str] = None
    reminder_sent: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
