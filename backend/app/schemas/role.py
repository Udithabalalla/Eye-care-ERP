from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    code: str


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class PermissionResponse(PermissionBase):
    permission_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[str] = Field(default_factory=list)


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[str]] = None
    is_active: Optional[bool] = None


class RoleResponse(RoleBase):
    role_id: str
    is_system_role: bool
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None


class RoleWithPermissions(RoleResponse):
    permissions: List[PermissionResponse] = []
