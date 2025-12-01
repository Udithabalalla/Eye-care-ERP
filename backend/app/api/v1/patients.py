from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.schemas.patient import PatientCreate, PatientUpdate, PatientResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.patient_service import PatientService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("", response_model=PaginatedResponse[PatientResponse])
async def list_patients(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all patients with pagination and search"""
    patient_service = PatientService(db)
    return await patient_service.list_patients(page, page_size, search)

@router.get("/{patient_id}", response_model=ResponseModel[PatientResponse])
async def get_patient(
    patient_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get patient by ID"""
    patient_service = PatientService(db)
    patient = await patient_service.get_patient(patient_id)
    return ResponseModel(data=patient)

@router.post("", response_model=ResponseModel[PatientResponse])
async def create_patient(
    patient_data: PatientCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new patient"""
    patient_service = PatientService(db)
    patient = await patient_service.create_patient(patient_data)
    return ResponseModel(
        message="Patient created successfully",
        data=patient
    )

@router.put("/{patient_id}", response_model=ResponseModel[PatientResponse])
async def update_patient(
    patient_id: str,
    patient_data: PatientUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update patient information"""
    patient_service = PatientService(db)
    patient = await patient_service.update_patient(patient_id, patient_data)
    return ResponseModel(
        message="Patient updated successfully",
        data=patient
    )

@router.delete("/{patient_id}")
async def delete_patient(
    patient_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete a patient"""
    patient_service = PatientService(db)
    await patient_service.delete_patient(patient_id)
    return ResponseModel(message="Patient deleted successfully")
