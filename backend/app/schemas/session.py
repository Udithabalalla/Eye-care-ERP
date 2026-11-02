from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.utils.constants import UserRole


class SessionResponse(BaseModel):
    """A signed-in device: one refresh token that hasn't expired or been revoked"""
    session_id: str
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[UserRole] = None
    user_is_active: bool = True
    signed_in_at: datetime
    last_seen_at: Optional[datetime] = None
    expires_at: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    # The session making this request
    is_current: bool = False


class RevokeResult(BaseModel):
    revoked: int
