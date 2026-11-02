from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.user_repository import UserRepository
from app.models.user import UserModel
from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.core.permissions import effective_permissions, role_permissions, unknown_permissions
from app.core.security import get_password_hash
from app.schemas.user import (
    AdminUserResponse, UserCreate, UserPermissionsResponse, UserPermissionsUpdate, UserUpdate,
)
from app.services.audit_service import AuditService
from app.services.session_service import SessionService
from app.utils.constants import UserRole
from typing import List, Optional
import uuid


class UserService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.user_repo = UserRepository(db)
        self.sessions = SessionService(db)
        self.audit = AuditService(db)

    async def get_user(self, user_id: str) -> Optional[UserModel]:
        """Get user by ID"""
        return await self.user_repo.get_by_user_id(user_id)

    async def _get_or_404(self, user_id: str) -> UserModel:
        user = await self.user_repo.get_by_user_id(user_id)
        if not user:
            raise NotFoundException("User not found")
        return user

    async def get_user_by_email(self, email: str) -> Optional[UserModel]:
        """Get user by email"""
        return await self.user_repo.get_by_email(email)

    async def list_users(self, skip: int = 0, limit: int = 100, role: Optional[UserRole] = None) -> tuple[List[UserModel], int]:
        """List users"""
        return await self.user_repo.list_users(skip, limit, role)

    async def list_users_for_admin(
        self, skip: int = 0, limit: int = 100, role: Optional[UserRole] = None
    ) -> tuple[List[AdminUserResponse], int]:
        users, total = await self.user_repo.list_users(skip, limit, role)
        session_counts = await self.sessions.count_active_by_user()
        return [
            AdminUserResponse(**u.model_dump(), active_sessions=session_counts.get(u.user_id, 0))
            for u in users
        ], total

    async def _ensure_another_admin(self, user: UserModel, action: str) -> None:
        """Refuse to leave the system without an active admin"""
        if user.role != UserRole.ADMIN or not user.is_active:
            return
        others = await self.db["users"].count_documents(
            {"role": UserRole.ADMIN.value, "is_active": True, "user_id": {"$ne": user.user_id}}
        )
        if others == 0:
            raise BadRequestException(f"Can't {action} the only active admin. Make someone else an admin first.")

    async def create_user(self, data: UserCreate, actor_id: str) -> UserModel:
        """Create an account for someone else; they sign in with the password the admin set"""
        email = data.email.lower()
        if await self.user_repo.get_by_email(email):
            raise ConflictException(f"A user with the email {email} already exists")

        user = UserModel(
            user_id=f"USR_{uuid.uuid4().hex[:12].upper()}",
            email=email,
            password_hash=get_password_hash(data.password),
            name=data.name.strip(),
            role=data.role,
            department=(data.department or "").strip() or None,
            phone=(data.phone or "").strip() or None,
            is_active=True,
            must_change_password=data.must_change_password,
        )
        created = await self.user_repo.create_user(user)
        await self.audit.log(actor_id, "create", "user", created.user_id,
                             new_value={"email": created.email, "role": created.role.value})
        return created

    async def update_user(self, user_id: str, data: UserUpdate, actor_id: str) -> UserModel:
        """Update the fields that were sent (an empty department or phone clears it)"""
        user = await self._get_or_404(user_id)
        changes = data.model_dump(exclude_unset=True)
        update: dict = {}

        if changes.get("name") is not None:
            update["name"] = changes["name"].strip()
        for field in ("department", "phone"):
            if field in changes:
                update[field] = (changes[field] or "").strip() or None
        if changes.get("email") is not None:
            email = changes["email"].lower()
            existing = await self.user_repo.get_by_email(email)
            if existing and existing.user_id != user_id:
                raise ConflictException(f"The email {email} is already in use")
            update["email"] = email
        if changes.get("role") is not None and changes["role"] != user.role:
            if user_id == actor_id:
                raise BadRequestException("You can't change your own role")
            await self._ensure_another_admin(user, "change the role of")
            update["role"] = changes["role"]

        if not update:
            return user
        updated = await self.user_repo.update_user(user_id, update)
        await self.audit.log(
            actor_id, "update", "user", user_id,
            old_value={k: getattr(user, k) for k in update},
            new_value=update,
        )
        return updated

    async def reset_password(
        self, user_id: str, new_password: str, actor_id: str, must_change_password: bool = True
    ) -> UserModel:
        """Admin sets a new password; the user is signed out everywhere"""
        await self._get_or_404(user_id)
        updated = await self.user_repo.update_user(user_id, {
            "password_hash": get_password_hash(new_password),
            "must_change_password": must_change_password,
        })
        revoked = await self.sessions.end_user_sessions(user_id, actor_id)
        await self.audit.log(actor_id, "reset_password", "user", user_id,
                             new_value={"sessions_signed_out": revoked})
        return updated

    async def deactivate_user(self, user_id: str, actor_id: str) -> int:
        """Block sign-in and sign out every session; returns how many were signed out"""
        user = await self._get_or_404(user_id)
        if user_id == actor_id:
            raise BadRequestException("You can't deactivate your own account")
        await self._ensure_another_admin(user, "deactivate")
        await self.user_repo.update_user(user_id, {"is_active": False})
        revoked = await self.sessions.end_user_sessions(user_id, actor_id)
        await self.audit.log(actor_id, "deactivate", "user", user_id,
                             new_value={"sessions_signed_out": revoked})
        return revoked

    async def activate_user(self, user_id: str, actor_id: str) -> UserModel:
        """Activate deactivated user"""
        await self._get_or_404(user_id)
        updated = await self.user_repo.update_user(user_id, {"is_active": True})
        await self.audit.log(actor_id, "activate", "user", user_id)
        return updated

    @staticmethod
    def permissions_view(user: UserModel) -> UserPermissionsResponse:
        if user.role == UserRole.ADMIN:
            all_codes = sorted(role_permissions(UserRole.ADMIN))
            return UserPermissionsResponse(user_id=user.user_id, role=user.role, role_permissions=all_codes,
                                           granted=[], revoked=[], effective=all_codes)
        return UserPermissionsResponse(
            user_id=user.user_id,
            role=user.role,
            role_permissions=sorted(role_permissions(user.role)),
            granted=sorted(user.granted_permissions),
            revoked=sorted(user.revoked_permissions),
            effective=sorted(effective_permissions(user)),
        )

    async def get_permissions(self, user_id: str) -> UserPermissionsResponse:
        return self.permissions_view(await self._get_or_404(user_id))

    async def set_permissions(
        self, user_id: str, data: UserPermissionsUpdate, actor_id: str
    ) -> UserPermissionsResponse:
        """Replace the user's own grants and revokes (on top of their role)"""
        user = await self._get_or_404(user_id)
        if user.role == UserRole.ADMIN:
            raise BadRequestException("Admins always have every permission")
        unknown = unknown_permissions([*data.granted, *data.revoked])
        if unknown:
            raise BadRequestException(f"Unknown permissions: {', '.join(unknown)}")
        both = set(data.granted) & set(data.revoked)
        if both:
            raise BadRequestException(f"Can't both grant and revoke: {', '.join(sorted(both))}")

        # Keep only real differences from the role, so later role changes still apply
        from_role = role_permissions(user.role)
        granted = sorted(set(data.granted) - from_role)
        revoked = sorted(set(data.revoked) & from_role)
        updated = await self.user_repo.update_user(
            user_id, {"granted_permissions": granted, "revoked_permissions": revoked}
        )
        await self.audit.log(
            actor_id, "update_permissions", "user", user_id,
            old_value={"granted": user.granted_permissions, "revoked": user.revoked_permissions},
            new_value={"granted": granted, "revoked": revoked},
        )
        return self.permissions_view(updated)

    async def bootstrap_admin(self, email: Optional[str], name: Optional[str], password: Optional[str]) -> Optional[UserModel]:
        """Create the first admin from configuration; never touches an existing account"""
        if not email or not password:
            return None
        email = email.strip().lower()
        if await self.user_repo.get_by_email(email):
            return None
        data = UserCreate(
            email=email,
            password=password,
            name=(name or "").strip() or email.split("@")[0],
            role=UserRole.ADMIN,
            must_change_password=True,
        )
        return await self.create_user(data, "config:bootstrap_admin")
