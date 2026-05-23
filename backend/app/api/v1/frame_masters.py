from fastapi import APIRouter, Depends, Query, UploadFile, File
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config.database import get_database
from app.schemas.frame_master import FrameMasterCreate, FrameMasterUpdate, FrameMasterResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.services.frame_master_service import FrameMasterService
from app.api.deps import get_current_user
from app.models.user import UserModel

router = APIRouter()


@router.get("", response_model=PaginatedResponse[FrameMasterResponse])
async def list_frame_masters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    brand: Optional[str] = None,
    category: Optional[str] = None,
    gender: Optional[str] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameMasterService(db)
    return await service.list_masters(page, page_size, search, brand, category, gender)


@router.post("", response_model=ResponseModel[FrameMasterResponse])
async def create_frame_master(
    data: FrameMasterCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameMasterService(db)
    result = await service.create_master(data)
    return ResponseModel(message="Frame master created", data=result)


@router.get("/brands", response_model=ResponseModel[List[str]])
async def get_distinct_brands(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameMasterService(db)
    brands = await service.get_distinct_brands()
    return ResponseModel(data=brands)


@router.get("/{frame_master_id}", response_model=ResponseModel[FrameMasterResponse])
async def get_frame_master(
    frame_master_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameMasterService(db)
    result = await service.get_master(frame_master_id)
    return ResponseModel(data=result)


@router.put("/{frame_master_id}", response_model=ResponseModel[FrameMasterResponse])
async def update_frame_master(
    frame_master_id: str,
    data: FrameMasterUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameMasterService(db)
    result = await service.update_master(frame_master_id, data)
    return ResponseModel(message="Frame master updated", data=result)


@router.delete("/{frame_master_id}")
async def delete_frame_master(
    frame_master_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    service = FrameMasterService(db)
    await service.delete_master(frame_master_id)
    return ResponseModel(message="Frame master deleted")
