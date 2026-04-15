from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.audit_log import AuditLogModel


class AuditLogRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "audit_logs")

    async def list_audit_logs(self, skip: int = 0, limit: int = 10, user_id: Optional[str] = None, entity_type: Optional[str] = None) -> Tuple[List[AuditLogModel], int]:
        query = {}
        if user_id:
            query["user_id"] = user_id
        if entity_type:
            query["entity_type"] = entity_type
        records = await self.get_many(filter=query, skip=skip, limit=limit, sort=[("timestamp", -1)])
        total = await self.count(query)
        return [AuditLogModel(**record) for record in records], total