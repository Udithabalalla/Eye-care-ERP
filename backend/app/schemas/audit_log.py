from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime


class AuditLogCreate(BaseModel):
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    timestamp: datetime


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    log_id: str
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    timestamp: datetime
    created_at: datetime
    updated_at: datetime