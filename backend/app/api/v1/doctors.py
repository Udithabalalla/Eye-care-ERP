from typing import List
from fastapi import APIRouter, Depends, Query, status
from app.schemas.doctor import DoctorCreate, DoctorUpdate, DoctorResponse
from app.services.doctor_service import DoctorService
from app.api.v1.auth import get_current_user

router = APIRouter()
service = DoctorService()

@router.post("", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    doctor_data: DoctorCreate,
    current_user = Depends(get_current_user)
):
    """Create a new doctor"""
    return await service.create_doctor(doctor_data)

@router.get("", response_model=List[DoctorResponse])
async def get_doctors(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    active_only: bool = Query(False),
    current_user = Depends(get_current_user)
):
    """Get list of doctors"""
    return await service.get_doctors(skip, limit, active_only)

@router.get("/{doctor_id}", response_model=DoctorResponse)
async def get_doctor(
    doctor_id: str,
    current_user = Depends(get_current_user)
):
    """Get doctor by ID"""
    return await service.get_doctor(doctor_id)

@router.put("/{doctor_id}", response_model=DoctorResponse)
async def update_doctor(
    doctor_id: str,
    doctor_data: DoctorUpdate,
    current_user = Depends(get_current_user)
):
    """Update doctor details"""
    return await service.update_doctor(doctor_id, doctor_data)

@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(
    doctor_id: str,
    current_user = Depends(get_current_user)
):
    """Delete doctor"""
    await service.delete_doctor(doctor_id)
