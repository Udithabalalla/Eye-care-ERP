from fastapi import APIRouter, Depends, Query
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.schemas.quick_intake import QuickIntakeCreate, QuickIntakeUpdate, QuickIntakeResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.quick_intake_service import QuickIntakeService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()


@router.get("", response_model=PaginatedResponse[QuickIntakeResponse])
async def list_quick_intakes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = QuickIntakeService(db)
    return await service.list_intakes(page, page_size, status, supplier_id)


@router.post("", response_model=ResponseModel[QuickIntakeResponse])
async def create_quick_intake(
    data: QuickIntakeCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = QuickIntakeService(db)
    result = await service.create_intake(data, created_by=current_user.user_id)
    return ResponseModel(message="Quick intake created", data=result)


@router.get("/{intake_id}", response_model=ResponseModel[QuickIntakeResponse])
async def get_quick_intake(
    intake_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = QuickIntakeService(db)
    result = await service.get_intake(intake_id)
    return ResponseModel(data=result)


@router.put("/{intake_id}", response_model=ResponseModel[QuickIntakeResponse])
async def update_quick_intake(
    intake_id: str,
    data: QuickIntakeUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = QuickIntakeService(db)
    result = await service.update_intake(intake_id, data)
    return ResponseModel(message="Quick intake updated", data=result)


@router.post("/{intake_id}/commit", response_model=ResponseModel[QuickIntakeResponse])
async def commit_quick_intake(
    intake_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Commit draft intake — increments stock atomically for all rows."""
    service = QuickIntakeService(db)
    result = await service.commit_intake(intake_id)
    return ResponseModel(message="Intake committed — stock updated", data=result)


@router.delete("/{intake_id}")
async def delete_quick_intake(
    intake_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    """Delete a draft intake (committed intakes cannot be deleted)."""
    service = QuickIntakeService(db)
    await service.delete_draft(intake_id)
    return ResponseModel(message="Intake deleted")
