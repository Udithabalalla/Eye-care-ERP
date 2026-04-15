from fastapi import APIRouter, Depends, Query, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from app.config.database import get_database
from app.models.user import UserModel
from app.api.deps import get_current_user
from app.schemas.role import (
    RoleCreate, RoleUpdate, RoleResponse, RoleWithPermissions,
    PermissionCreate, PermissionUpdate, PermissionResponse
)
from app.services.role_service import RoleService, PermissionService
from app.schemas.responses import ResponseModel

router = APIRouter()


# ==================== PERMISSIONS ====================

@router.get("/permissions", response_model=ResponseModel)
async def list_permissions(
    category: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all permissions"""
    permission_service = PermissionService(db)
    permissions, total = await permission_service.list_permissions(category, skip, limit)
    return ResponseModel(
        message="Permissions retrieved successfully",
        data=[p.dict() for p in permissions],
        total=total
    )


@router.post("/permissions", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def create_permission(
    permission: PermissionCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new permission"""
    permission_service = PermissionService(db)
    new_permission = await permission_service.create_permission(
        name=permission.name,
        category=permission.category,
        code=permission.code,
        description=permission.description
    )
    return ResponseModel(
        message="Permission created successfully",
        data=new_permission.dict()
    )


@router.get("/permissions/{permission_id}", response_model=ResponseModel)
async def get_permission(
    permission_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get permission by ID"""
    permission_service = PermissionService(db)
    permission = await permission_service.get_permission(permission_id)
    if not permission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    return ResponseModel(
        message="Permission retrieved successfully",
        data=permission.dict()
    )


@router.put("/permissions/{permission_id}", response_model=ResponseModel)
async def update_permission(
    permission_id: str,
    permission: PermissionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update permission"""
    permission_service = PermissionService(db)
    updated = await permission_service.update_permission(
        permission_id,
        name=permission.name,
        description=permission.description,
        category=permission.category
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    return ResponseModel(
        message="Permission updated successfully",
        data=updated.dict()
    )


@router.delete("/permissions/{permission_id}", response_model=ResponseModel)
async def delete_permission(
    permission_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete permission"""
    permission_service = PermissionService(db)
    deleted = await permission_service.delete_permission(permission_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Permission not found")
    return ResponseModel(message="Permission deleted successfully")


# ==================== ROLES ====================

@router.get("/roles", response_model=ResponseModel)
async def list_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    include_inactive: bool = False,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """List all roles"""
    role_service = RoleService(db)
    roles, total = await role_service.list_roles(skip, limit, include_inactive)
    return ResponseModel(
        message="Roles retrieved successfully",
        data=[r.dict() for r in roles],
        total=total
    )


@router.post("/roles", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def create_role(
    role: RoleCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Create a new role"""
    role_service = RoleService(db)
    new_role = await role_service.create_role(
        name=role.name,
        description=role.description,
        permission_ids=role.permission_ids
    )
    return ResponseModel(
        message="Role created successfully",
        data=new_role.dict()
    )


@router.get("/roles/{role_id}", response_model=ResponseModel)
async def get_role(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Get role with permissions"""
    role_service = RoleService(db)
    role = await role_service.get_role_with_permissions(role_id)
    if not role:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return ResponseModel(
        message="Role retrieved successfully",
        data=role
    )


@router.put("/roles/{role_id}", response_model=ResponseModel)
async def update_role(
    role_id: str,
    role: RoleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Update role"""
    role_service = RoleService(db)
    
    # Check if role exists
    existing = await role_service.get_role(role_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    
    # Update basic info
    if role.name or role.description:
        await role_service.update_role(role_id, name=role.name, description=role.description)
    
    # Update permissions if provided
    if role.permission_ids is not None:
        await role_service.set_role_permissions(role_id, role.permission_ids)
    
    # Get updated role
    updated = await role_service.get_role_with_permissions(role_id)
    return ResponseModel(
        message="Role updated successfully",
        data=updated
    )


@router.post("/roles/{role_id}/permissions/{permission_id}", response_model=ResponseModel)
async def add_permission_to_role(
    role_id: str,
    permission_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Add permission to role"""
    role_service = RoleService(db)
    added = await role_service.add_permission_to_role(role_id, permission_id)
    if not added:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Permission could not be added")
    
    updated = await role_service.get_role_with_permissions(role_id)
    return ResponseModel(
        message="Permission added to role successfully",
        data=updated
    )


@router.delete("/roles/{role_id}/permissions/{permission_id}", response_model=ResponseModel)
async def remove_permission_from_role(
    role_id: str,
    permission_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Remove permission from role"""
    role_service = RoleService(db)
    removed = await role_service.remove_permission_from_role(role_id, permission_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Permission could not be removed")
    
    updated = await role_service.get_role_with_permissions(role_id)
    return ResponseModel(
        message="Permission removed from role successfully",
        data=updated
    )


@router.delete("/roles/{role_id}", response_model=ResponseModel)
async def delete_role(
    role_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user)
):
    """Delete role (soft delete - mark as inactive)"""
    role_service = RoleService(db)
    deleted = await role_service.delete_role(role_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return ResponseModel(message="Role deleted successfully")
