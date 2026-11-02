from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.config.database import get_database
from app.models.user import UserModel
from app.api.deps import require_admin
from app.schemas.role import RoleUpdate
from app.services.role_service import RoleService, PermissionService
from app.schemas.responses import ResponseModel

# Mounted with an admin-only guard in router.py; the per-route ``require_admin``
# also gives the acting admin's id for the audit log.
router = APIRouter()


# ==================== PERMISSIONS ====================

@router.get("/permissions", response_model=ResponseModel)
async def list_permissions(current_user: UserModel = Depends(require_admin)):
    """Every permission a route checks, one per module and action"""
    return ResponseModel(
        message="Permissions retrieved successfully",
        data=[p.model_dump() for p in PermissionService.list_permissions()],
    )


@router.get("/permissions/modules", response_model=ResponseModel)
async def list_permission_modules(current_user: UserModel = Depends(require_admin)):
    """The same permissions grouped by module, for building a permission grid"""
    return ResponseModel(data=[m.model_dump() for m in PermissionService.list_modules()])


# ==================== ROLES ====================

@router.get("/roles", response_model=ResponseModel)
async def list_roles(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """The sign-in roles and what each may do"""
    roles = await RoleService(db).list_roles()
    return ResponseModel(message="Roles retrieved successfully", data=[r.model_dump() for r in roles])


@router.get("/roles/{role_id}", response_model=ResponseModel)
async def get_role(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Get role with permissions"""
    role = await RoleService(db).get_role(role_id)
    return ResponseModel(message="Role retrieved successfully", data=role.model_dump())


@router.put("/roles/{role_id}", response_model=ResponseModel)
async def update_role(
    role_id: str,
    role: RoleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Change what a role may do; applies to its users on their next request"""
    updated = await RoleService(db).update_role(
        role_id, current_user.user_id, permission_ids=role.permission_ids, description=role.description
    )
    return ResponseModel(message="Role updated successfully", data=updated.model_dump())


@router.post("/roles/{role_id}/reset", response_model=ResponseModel)
async def reset_role(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Put a role back to the permissions it started with"""
    updated = await RoleService(db).reset_role(role_id, current_user.user_id)
    return ResponseModel(message="Role reset to its default permissions", data=updated.model_dump())
