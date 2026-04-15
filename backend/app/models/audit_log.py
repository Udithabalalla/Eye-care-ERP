from pydantic import ConfigDict
from typing import Optional, Any
from datetime import datetime

from app.models.common import TimestampModel


class AuditLogModel(TimestampModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    user_id: str
    action: str
    entity_type: str
    entity_id: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    timestamp: datetime