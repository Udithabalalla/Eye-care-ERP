"""The "Tested by" list: anyone taking orders reads it, only the admin changes it."""
from typing import List

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user, require_admin
from app.config.database import get_database
from app.models.user import UserModel
from app.schemas.responses import ResponseModel
from app.schemas.tester import TesterCreate, TesterResponse, TesterStatusUpdate, TesterUpdate
from app.services.tester_service import TesterService

router = APIRouter()


@router.get("", response_model=ResponseModel[List[TesterResponse]])
async def list_testers(
    is_active: bool | None = Query(None, description="Only the listed (true) or removed (false) names"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return ResponseModel(data=await TesterService(db).list_testers(is_active))


@router.post("", response_model=ResponseModel[TesterResponse])
async def create_tester(
    data: TesterCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin),
):
    tester = await TesterService(db).create_tester(data, current_user.user_id)
    return ResponseModel(message=f"{tester.name} added", data=tester)


@router.put("/{tester_id}", response_model=ResponseModel[TesterResponse])
async def update_tester(
    tester_id: str,
    data: TesterUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin),
):
    tester = await TesterService(db).update_tester(tester_id, data, current_user.user_id)
    return ResponseModel(message=f"{tester.name} updated", data=tester)


@router.patch("/{tester_id}/status", response_model=ResponseModel[TesterResponse])
async def set_tester_status(
    tester_id: str,
    data: TesterStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin),
):
    tester = await TesterService(db).set_status(tester_id, data.is_active, current_user.user_id)
    return ResponseModel(message=f"{tester.name} {'restored' if tester.is_active else 'removed'}", data=tester)
