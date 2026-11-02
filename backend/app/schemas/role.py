from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class PermissionModuleResponse(BaseModel):
    """One area of the system and the actions that can be granted in it"""
    module: str
    label: str
    description: str
    actions: List[str]


class PermissionResponse(BaseModel):
    code: str
    module: str
    action: str
    name: str
    category: str
    description: str


class RoleUpdate(BaseModel):
    description: Optional[str] = None
    permission_ids: Optional[List[str]] = None


class RoleResponse(BaseModel):
    role_id: str
    name: str
    description: Optional[str] = None
    permission_ids: List[str]
    is_system_role: bool = True
    is_active: bool = True
    # Admin always has every permission and can't be edited
    editable: bool
    matches_defaults: bool
    user_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
