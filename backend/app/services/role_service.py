import logging
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import BadRequestException, NotFoundException
from app.core.permissions import (
    ACTION_LABELS,
    DEFAULT_ROLE_PERMISSIONS,
    PERMISSION_MODULES,
    ROLE_DESCRIPTIONS,
    ROLE_LABELS,
    role_permissions,
    role_permissions_stale,
    set_role_permissions,
    unknown_permissions,
)
from app.models.role import RoleModel
from app.repositories.role_repository import RoleRepository
from app.schemas.role import PermissionModuleResponse, PermissionResponse, RoleResponse
from app.services.audit_service import AuditService
from app.utils.constants import UserRole

logger = logging.getLogger(__name__)


class PermissionService:
    """The permissions an admin can grant: exactly the ones the routes check"""

    @staticmethod
    def list_modules() -> List[PermissionModuleResponse]:
        return [PermissionModuleResponse(**module) for module in PERMISSION_MODULES]

    @staticmethod
    def list_permissions() -> List[PermissionResponse]:
        return [
            PermissionResponse(
                code=f"{module['module']}.{action}",
                module=module["module"],
                action=action,
                name=f"{ACTION_LABELS[action]} {module['label'].lower()}",
                category=module["label"],
                description=module["description"],
            )
            for module in PERMISSION_MODULES
            for action in module["actions"]
        ]


class RoleService:
    """The five sign-in roles and what each may do.

    Roles are fixed (a user's role is a ``UserRole``); admins change what each
    non-admin role is permitted to do. Changes take effect on the next request.
    """

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.role_repo = RoleRepository(db)

    @staticmethod
    def _default_role(role: UserRole) -> RoleModel:
        return RoleModel(
            role_id=role.value,
            name=ROLE_LABELS[role],
            description=ROLE_DESCRIPTIONS[role],
            permission_ids=sorted(DEFAULT_ROLE_PERMISSIONS.get(role, frozenset())),
        )

    @staticmethod
    def _parse_role(role_id: str) -> UserRole:
        try:
            return UserRole(role_id)
        except ValueError:
            raise NotFoundException("Role not found")

    async def ensure_system_roles(self) -> None:
        """Store each role with its default permissions the first time we start"""
        for role in UserRole:
            if role != UserRole.ADMIN:
                await self.role_repo.insert_if_missing(self._default_role(role))

    async def refresh_permission_cache(self) -> None:
        stored = await self.role_repo.list_roles([r.value for r in UserRole if r != UserRole.ADMIN])
        set_role_permissions({UserRole(r.role_id): r.permission_ids for r in stored})

    async def refresh_permission_cache_if_stale(self) -> None:
        """Reload stored role permissions when this worker's copy is old.

        On a database error the last loaded permissions (or the defaults) stay in force.
        """
        if not role_permissions_stale():
            return
        try:
            await self.refresh_permission_cache()
        except Exception as exc:  # noqa: BLE001 - keep serving with the cached rules
            logger.warning("Could not reload role permissions: %s", exc)

    async def _to_response(self, role: UserRole, stored: Optional[RoleModel]) -> RoleResponse:
        user_count = await self.db["users"].count_documents({"role": role.value, "is_active": True})
        if role == UserRole.ADMIN:
            return RoleResponse(
                role_id=role.value,
                name=ROLE_LABELS[role],
                description=ROLE_DESCRIPTIONS[role],
                permission_ids=["*"],
                editable=False,
                matches_defaults=True,
                user_count=user_count,
            )
        model = stored or self._default_role(role)
        codes = sorted(role_permissions(role)) if stored is None else sorted(model.permission_ids)
        return RoleResponse(
            role_id=role.value,
            name=model.name,
            description=model.description,
            permission_ids=codes,
            is_system_role=True,
            is_active=True,
            editable=True,
            matches_defaults=set(codes) == set(DEFAULT_ROLE_PERMISSIONS.get(role, frozenset())),
            user_count=user_count,
            created_at=model.created_at if stored else None,
            updated_at=model.updated_at if stored else None,
            updated_by=model.updated_by,
        )

    async def list_roles(self) -> List[RoleResponse]:
        stored = {r.role_id: r for r in await self.role_repo.list_roles([r.value for r in UserRole])}
        return [await self._to_response(role, stored.get(role.value)) for role in UserRole]

    async def get_role(self, role_id: str) -> RoleResponse:
        role = self._parse_role(role_id)
        return await self._to_response(role, await self.role_repo.get_role(role.value))

    async def update_role(
        self,
        role_id: str,
        actor_id: str,
        permission_ids: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> RoleResponse:
        role = self._parse_role(role_id)
        if role == UserRole.ADMIN:
            raise BadRequestException("The admin role always has every permission and can't be changed")

        before = await self.get_role(role.value)
        update: dict = {"updated_by": actor_id}
        if permission_ids is not None:
            unknown = unknown_permissions(permission_ids)
            if unknown:
                raise BadRequestException(f"Unknown permissions: {', '.join(unknown)}")
            update["permission_ids"] = sorted(set(permission_ids))
        if description is not None:
            update["description"] = description.strip() or None

        await self.role_repo.insert_if_missing(self._default_role(role))
        await self.role_repo.update_role(role.value, update)
        await self.refresh_permission_cache()

        after = await self.get_role(role.value)
        await AuditService(self.db).log(
            actor_id, "update_permissions", "role", role.value,
            old_value={"permissions": before.permission_ids},
            new_value={"permissions": after.permission_ids},
        )
        return after

    async def reset_role(self, role_id: str, actor_id: str) -> RoleResponse:
        """Put a role back to the permissions it started with"""
        role = self._parse_role(role_id)
        if role == UserRole.ADMIN:
            raise BadRequestException("The admin role always has every permission and can't be changed")
        return await self.update_role(
            role.value, actor_id, permission_ids=sorted(DEFAULT_ROLE_PERMISSIONS.get(role, frozenset()))
        )
