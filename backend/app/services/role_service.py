from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.role_repository import RoleRepository, PermissionRepository
from app.models.role import RoleModel, PermissionModel
from typing import List, Optional
import uuid
from datetime import datetime


class PermissionService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.permission_repo = PermissionRepository(db)

    async def create_permission(self, name: str, category: str, code: str, description: Optional[str] = None) -> PermissionModel:
        """Create a new permission"""
        permission_data = {
            "permission_id": f"PERM_{uuid.uuid4().hex[:12].upper()}",
            "name": name,
            "description": description,
            "category": category,
            "code": code,
            "created_at": datetime.utcnow(),
            "updated_at": None
        }
        return await self.permission_repo.create_permission(permission_data)

    async def get_permission(self, permission_id: str) -> Optional[PermissionModel]:
        """Get permission by ID"""
        return await self.permission_repo.get_permission(permission_id)

    async def list_permissions(self, category: Optional[str] = None, skip: int = 0, limit: int = 100) -> tuple[List[PermissionModel], int]:
        """List permissions"""
        return await self.permission_repo.list_permissions(category, skip, limit)

    async def update_permission(self, permission_id: str, name: Optional[str] = None, description: Optional[str] = None, category: Optional[str] = None) -> Optional[PermissionModel]:
        """Update permission"""
        update_data = {"updated_at": datetime.utcnow()}
        if name:
            update_data["name"] = name
        if description:
            update_data["description"] = description
        if category:
            update_data["category"] = category
        
        return await self.permission_repo.update_permission(permission_id, update_data)

    async def delete_permission(self, permission_id: str) -> bool:
        """Delete permission"""
        return await self.permission_repo.delete_permission(permission_id)

    async def seed_default_permissions(self) -> None:
        """Seed default permissions"""
        default_permissions = [
            {"name": "View Patients", "category": "Patients", "code": "patients.read", "description": "View patient records"},
            {"name": "Create Patients", "category": "Patients", "code": "patients.create", "description": "Create new patient records"},
            {"name": "Edit Patients", "category": "Patients", "code": "patients.update", "description": "Edit patient records"},
            {"name": "Delete Patients", "category": "Patients", "code": "patients.delete", "description": "Delete patient records"},
            
            {"name": "View Appointments", "category": "Appointments", "code": "appointments.read", "description": "View appointments"},
            {"name": "Create Appointments", "category": "Appointments", "code": "appointments.create", "description": "Create appointments"},
            {"name": "Edit Appointments", "category": "Appointments", "code": "appointments.update", "description": "Edit appointments"},
            {"name": "Delete Appointments", "category": "Appointments", "code": "appointments.delete", "description": "Delete appointments"},
            
            {"name": "View Invoices", "category": "Invoices", "code": "invoices.read", "description": "View invoices"},
            {"name": "Create Invoices", "category": "Invoices", "code": "invoices.create", "description": "Create invoices"},
            {"name": "Edit Invoices", "category": "Invoices", "code": "invoices.update", "description": "Edit invoices"},
            {"name": "Record Payment", "category": "Invoices", "code": "invoices.payment", "description": "Record invoice payments"},
            
            {"name": "View Inventory", "category": "Inventory", "code": "inventory.read", "description": "View inventory"},
            {"name": "Manage Inventory", "category": "Inventory", "code": "inventory.manage", "description": "Manage inventory levels"},
            
            {"name": "View Reports", "category": "Reports", "code": "reports.read", "description": "View reports"},
            {"name": "Export Reports", "category": "Reports", "code": "reports.export", "description": "Export reports"},
            
            {"name": "View Users", "category": "System", "code": "users.read", "description": "View users"},
            {"name": "Manage Users", "category": "System", "code": "users.manage", "description": "Create, edit, delete users"},
            {"name": "Manage Roles", "category": "System", "code": "roles.manage", "description": "Manage roles and permissions"},
            {"name": "View Audit Logs", "category": "System", "code": "audit.read", "description": "View audit logs"},
        ]
        
        for perm_data in default_permissions:
            existing = await self.permission_repo.get_by_code(perm_data["code"])
            if not existing:
                perm_data["permission_id"] = f"PERM_{uuid.uuid4().hex[:12].upper()}"
                perm_data["created_at"] = datetime.utcnow()
                perm_data["updated_at"] = None
                await self.permission_repo.create_permission(perm_data)


class RoleService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.role_repo = RoleRepository(db)
        self.permission_repo = PermissionRepository(db)

    async def create_role(self, name: str, description: Optional[str] = None, permission_ids: Optional[List[str]] = None) -> RoleModel:
        """Create a new role"""
        role_data = {
            "role_id": f"ROLE_{uuid.uuid4().hex[:12].upper()}",
            "name": name,
            "description": description,
            "permission_ids": permission_ids or [],
            "is_system_role": False,
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": None
        }
        return await self.role_repo.create_role(role_data)

    async def get_role(self, role_id: str) -> Optional[RoleModel]:
        """Get role by ID"""
        return await self.role_repo.get_role(role_id)

    async def get_role_with_permissions(self, role_id: str) -> Optional[dict]:
        """Get role with full permission details"""
        role = await self.role_repo.get_role(role_id)
        if not role:
            return None
        
        permissions = []
        for perm_id in role.permission_ids:
            perm = await self.permission_repo.get_permission(perm_id)
            if perm:
                permissions.append(perm)
        
        return {
            "role_id": role.role_id,
            "name": role.name,
            "description": role.description,
            "permission_ids": role.permission_ids,
            "permissions": permissions,
            "is_system_role": role.is_system_role,
            "is_active": role.is_active,
            "created_at": role.created_at,
            "updated_at": role.updated_at
        }

    async def list_roles(self, skip: int = 0, limit: int = 100, include_inactive: bool = False) -> tuple[List[RoleModel], int]:
        """List roles"""
        return await self.role_repo.list_roles(skip, limit, include_inactive)

    async def update_role(self, role_id: str, name: Optional[str] = None, description: Optional[str] = None) -> Optional[RoleModel]:
        """Update role"""
        update_data = {"updated_at": datetime.utcnow()}
        if name:
            update_data["name"] = name
        if description:
            update_data["description"] = description
        
        return await self.role_repo.update_role(role_id, update_data)

    async def add_permission_to_role(self, role_id: str, permission_id: str) -> bool:
        """Add permission to role"""
        return await self.role_repo.add_permission_to_role(role_id, permission_id)

    async def remove_permission_from_role(self, role_id: str, permission_id: str) -> bool:
        """Remove permission from role"""
        return await self.role_repo.remove_permission_from_role(role_id, permission_id)

    async def set_role_permissions(self, role_id: str, permission_ids: List[str]) -> Optional[RoleModel]:
        """Replace all permissions for a role"""
        return await self.role_repo.update_role(role_id, {"permission_ids": permission_ids, "updated_at": datetime.utcnow()})

    async def delete_role(self, role_id: str) -> bool:
        """Delete role (soft delete)"""
        return await self.role_repo.delete_role(role_id)

    async def seed_default_roles(self) -> None:
        """Seed default roles"""
        default_roles = [
            {"name": "Admin", "description": "System administrator with full access", "is_system_role": True},
            {"name": "Manager", "description": "Manager with access to reports and staff management", "is_system_role": True},
            {"name": "Doctor", "description": "Doctor with access to patient records and prescriptions", "is_system_role": True},
            {"name": "Receptionist", "description": "Receptionist with access to appointments and invoicing", "is_system_role": True},
            {"name": "Staff", "description": "Staff member with limited access", "is_system_role": True},
        ]
        
        for role_data in default_roles:
            existing = await self.role_repo.get_by_name(role_data["name"])
            if not existing:
                role_data["role_id"] = f"ROLE_{uuid.uuid4().hex[:12].upper()}"
                role_data["permission_ids"] = []
                role_data["is_active"] = True
                role_data["created_at"] = datetime.utcnow()
                role_data["updated_at"] = None
                await self.role_repo.create_role(role_data)
