from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.session import RevokeResult
from app.schemas.user import (
    AdminUserResponse, PasswordChange, PasswordResetByAdmin, UserCreate, UserPermissionsUpdate,
    UserResponse, UserUpdate,
)
from app.utils.constants import UserRole
from app.config.database import get_database
from app.models.user import UserModel
from app.api.deps import get_current_session_id, get_current_user, require_admin, require_permission
from app.core.exceptions import ForbiddenException
from app.services.auth_service import AuthService
from app.services.session_service import SessionService
from app.services.user_service import UserService
from app.schemas.responses import ResponseModel
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter()

# Reading the staff list needs ``users.read`` (pickers use it) and never returns
# password hashes or per-user permissions. Everything that changes an account
# is admin-only.


def _admin_view(user: UserModel, active_sessions: int = 0) -> dict:
    return AdminUserResponse(**user.model_dump(), active_sessions=active_sessions).model_dump()


@router.get("", response_model=ResponseModel)
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    role: Optional[UserRole] = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_permission("users.read"))
):
    """Get list of users, optionally filtered by role"""
    user_service = UserService(db)
    if current_user.role == UserRole.ADMIN:
        users, total = await user_service.list_users_for_admin(skip, limit, role)
        data = [u.model_dump() for u in users]
    else:
        users, total = await user_service.list_users(skip, limit, role)
        data = [UserResponse(**u.model_dump()).model_dump() for u in users]
    return ResponseModel(
        message="Users retrieved successfully",
        data=data,
        total=total
    )


@router.get("/{user_id}", response_model=ResponseModel)
async def get_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_permission("users.read"))
):
    """Get user by ID"""
    user = await UserService(db)._get_or_404(user_id)
    data = _admin_view(user) if current_user.role == UserRole.ADMIN else UserResponse(**user.model_dump()).model_dump()
    return ResponseModel(message="User retrieved successfully", data=data)


@router.post("", response_model=ResponseModel, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Create an account for someone else"""
    new_user = await UserService(db).create_user(user_data, current_user.user_id)
    return ResponseModel(message="User created successfully", data=_admin_view(new_user))


@router.put("/{user_id}", response_model=ResponseModel)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Update a user's details or role"""
    updated = await UserService(db).update_user(user_id, user_data, current_user.user_id)
    return ResponseModel(message="User updated successfully", data=_admin_view(updated))


@router.post("/{user_id}/change-password", response_model=ResponseModel)
async def change_password(
    user_id: str,
    password_change: PasswordChange,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
    session_id: Optional[str] = Depends(get_current_session_id),
):
    """Change your own password (admins set other people's with reset-password)"""
    if user_id != current_user.user_id:
        raise ForbiddenException("You can only change your own password")
    await AuthService(db).change_own_password(
        current_user, password_change.old_password, password_change.new_password, session_id
    )
    return ResponseModel(message="Password changed successfully")


@router.post("/{user_id}/reset-password", response_model=ResponseModel)
async def reset_password(
    user_id: str,
    payload: PasswordResetByAdmin,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Set a new password for a user; they are signed out everywhere"""
    updated = await UserService(db).reset_password(
        user_id, payload.new_password, current_user.user_id, payload.must_change_password
    )
    return ResponseModel(message="Password reset successfully", data=_admin_view(updated))


@router.post("/{user_id}/deactivate", response_model=ResponseModel)
async def deactivate_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Deactivate a user and sign out all their sessions"""
    revoked = await UserService(db).deactivate_user(user_id, current_user.user_id)
    return ResponseModel(message="User deactivated successfully", data=RevokeResult(revoked=revoked).model_dump())


@router.post("/{user_id}/activate", response_model=ResponseModel)
async def activate_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Activate user"""
    activated = await UserService(db).activate_user(user_id, current_user.user_id)
    return ResponseModel(message="User activated successfully", data=_admin_view(activated))


@router.get("/{user_id}/permissions", response_model=ResponseModel)
async def get_user_permissions(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """What the user may do: their role's permissions plus their own grants and revokes"""
    return ResponseModel(data=(await UserService(db).get_permissions(user_id)).model_dump())


@router.put("/{user_id}/permissions", response_model=ResponseModel)
async def set_user_permissions(
    user_id: str,
    payload: UserPermissionsUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Grant or revoke single permissions for one user, on top of their role"""
    result = await UserService(db).set_permissions(user_id, payload, current_user.user_id)
    return ResponseModel(message="Permissions updated", data=result.model_dump())


@router.get("/{user_id}/sessions", response_model=ResponseModel)
async def get_user_sessions(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin),
    session_id: Optional[str] = Depends(get_current_session_id),
):
    """The user's signed-in sessions"""
    sessions = await SessionService(db).list_active(user_id=user_id, current_session_id=session_id)
    return ResponseModel(data=[s.model_dump() for s in sessions])


@router.post("/{user_id}/sessions/revoke", response_model=ResponseModel)
async def revoke_user_sessions(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(require_admin)
):
    """Sign the user out of every session"""
    revoked = await SessionService(db).admin_end_user_sessions(user_id, current_user.user_id)
    return ResponseModel(message=f"Signed out {revoked} session(s)", data=RevokeResult(revoked=revoked).model_dump())
