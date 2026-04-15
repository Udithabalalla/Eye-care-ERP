from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional

from app.config.database import get_database
from app.api.deps import get_current_user
from app.models.user import UserModel
from app.schemas.responses import PaginatedResponse
from app.schemas.audit_log import AuditLogResponse
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
async def list_audit_logs(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100), user_id: Optional[str] = None, entity_type: Optional[str] = None, db: AsyncIOMotorDatabase = Depends(get_database), current_user: UserModel = Depends(get_current_user)):
    service = AuditService(db)
    logs, total = await service.list_logs(page, page_size, user_id, entity_type)
    total_pages = (total + page_size - 1) // page_size
    return PaginatedResponse(data=[AuditLogResponse(**log.dict()) for log in logs], total=total, page=page, page_size=page_size, total_pages=total_pages)