from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.schemas.prescription import PrescriptionCreate, PrescriptionUpdate, PrescriptionResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.prescription_service import PrescriptionService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()

@router.get("", response_model=PaginatedResponse[PrescriptionResponse])
async def list_prescriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    patient_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all prescriptions with filters"""
    prescription_service = PrescriptionService(db)
    return await prescription_service.list_prescriptions(page, page_size, patient_id, doctor_id)

@router.get("/{prescription_id}", response_model=ResponseModel[PrescriptionResponse])
async def get_prescription(
    prescription_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get prescription by ID"""
    prescription_service = PrescriptionService(db)
    prescription = await prescription_service.get_prescription(prescription_id)
    return ResponseModel(data=prescription)

@router.post("", response_model=ResponseModel[PrescriptionResponse])
async def create_prescription(
    prescription_data: PrescriptionCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new prescription"""
    prescription_service = PrescriptionService(db)
    prescription = await prescription_service.create_prescription(prescription_data)
    return ResponseModel(
        message="Prescription created successfully",
        data=prescription
    )

@router.put("/{prescription_id}", response_model=ResponseModel[PrescriptionResponse])
async def update_prescription(
    prescription_id: str,
    prescription_data: PrescriptionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update prescription"""
    prescription_service = PrescriptionService(db)
    prescription = await prescription_service.update_prescription(prescription_id, prescription_data)
    return ResponseModel(
        message="Prescription updated successfully",
        data=prescription
    )
