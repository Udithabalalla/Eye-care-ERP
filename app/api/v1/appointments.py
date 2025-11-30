from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date

from app.config.database import get_database
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.appointment_service import AppointmentService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("", response_model=PaginatedResponse[AppointmentResponse])
async def list_appointments(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    patient_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all appointments with filters"""
    appointment_service = AppointmentService(db)
    return await appointment_service.list_appointments(
        page, page_size, patient_id, doctor_id, start_date, end_date, status
    )

@router.get("/{appointment_id}", response_model=ResponseModel[AppointmentResponse])
async def get_appointment(
    appointment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get appointment by ID"""
    appointment_service = AppointmentService(db)
    appointment = await appointment_service.get_appointment(appointment_id)
    return ResponseModel(data=appointment)

@router.post("", response_model=ResponseModel[AppointmentResponse])
async def create_appointment(
    appointment_data: AppointmentCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new appointment"""
    appointment_service = AppointmentService(db)
    appointment = await appointment_service.create_appointment(
        appointment_data,
        current_user.user_id
    )
    return ResponseModel(
        message="Appointment created successfully",
        data=appointment
    )

@router.put("/{appointment_id}", response_model=ResponseModel[AppointmentResponse])
async def update_appointment(
    appointment_id: str,
    appointment_data: AppointmentUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update appointment"""
    appointment_service = AppointmentService(db)
    appointment = await appointment_service.update_appointment(appointment_id, appointment_data)
    return ResponseModel(
        message="Appointment updated successfully",
        data=appointment
    )

@router.delete("/{appointment_id}")
async def cancel_appointment(
    appointment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Cancel an appointment"""
    appointment_service = AppointmentService(db)
    await appointment_service.cancel_appointment(appointment_id)
    return ResponseModel(message="Appointment cancelled successfully")
