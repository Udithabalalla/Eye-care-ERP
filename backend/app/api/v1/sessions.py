from typing import Optional

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_session_id, require_admin
from app.config.database import get_database
from app.models.user import UserModel
from app.schemas.responses import ResponseModel
from app.schemas.session import RevokeResult
from app.services.session_service import SessionService

router = APIRouter()


@router.get("", response_model=ResponseModel)
async def list_sessions(
    user_id: Optional[str] = Query(None),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin),
    session_id: Optional[str] = Depends(get_current_session_id),
):
    """Everyone who is signed in: sessions whose refresh token hasn't expired or been revoked"""
    sessions = await SessionService(db).list_active(user_id=user_id, current_session_id=session_id)
    return ResponseModel(message="Sessions retrieved successfully", data=[s.model_dump() for s in sessions])


@router.delete("/{session_id}", response_model=ResponseModel)
async def revoke_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin),
):
    """Sign out one session: its refresh token and access tokens stop working"""
    await SessionService(db).admin_end_session(session_id, current_user.user_id)
    return ResponseModel(message="Session signed out", data=RevokeResult(revoked=1).model_dump())
