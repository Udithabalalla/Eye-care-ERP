from pydantic import Field
from typing import List, Optional
from app.models.common import TimestampModel


class RoleModel(TimestampModel):
    """Role database model: one document per ``UserRole``, keyed by its value"""
    role_id: str = Field(..., description="The UserRole value, e.g. 'staff'")
    name: str = Field(..., description="Role name")
    description: Optional[str] = None
    permission_ids: List[str] = Field(default_factory=list, description="Permission codes, e.g. 'patients.read'")
    is_system_role: bool = True
    is_active: bool = True
    updated_by: Optional[str] = None
