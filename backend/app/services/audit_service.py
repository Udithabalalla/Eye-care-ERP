from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone
from typing import Any, Optional

from app.repositories.audit_log_repository import AuditLogRepository
from app.utils.helpers import generate_id


class AuditService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = AuditLogRepository(db)

    async def log(self, user_id: str, action: str, entity_type: str, entity_id: str, old_value: Optional[Any] = None, new_value: Optional[Any] = None):
        next_number = await self.repo.count({}) + 1
        log_id = generate_id("AUD", next_number)
        payload = {
            "log_id": log_id,
            "user_id": user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "old_value": old_value,
            "new_value": new_value,
            "timestamp": datetime.now(timezone.utc),
        }
        await self.repo.create(payload)
        return payload

    async def list_logs(self, page: int, page_size: int, user_id: Optional[str] = None, entity_type: Optional[str] = None):
        skip = (page - 1) * page_size
        logs, total = await self.repo.list_audit_logs(skip=skip, limit=page_size, user_id=user_id, entity_type=entity_type)
        return logs, total