from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from app.models.common import TimestampModel


class PermissionModel(TimestampModel):
    """Permission database model"""
    permission_id: str = Field(..., description="Unique permission identifier")
    name: str = Field(..., description="Permission name")
    description: Optional[str] = None
    category: str = Field(..., description="Permission category (e.g., Patients, Invoices, Reports)")
    code: str = Field(..., description="Permission code (e.g., patients.read, invoices.create)")


class RoleModel(TimestampModel):
    """Role database model"""
    role_id: str = Field(..., description="Unique role identifier")
    name: str = Field(..., description="Role name")
    description: Optional[str] = None
    permission_ids: List[str] = Field(default_factory=list, description="List of permission IDs")
    is_system_role: bool = False
    is_active: bool = True
