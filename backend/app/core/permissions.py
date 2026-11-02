"""Role-based access control.

Permission codes follow ``<module>.<action>`` where action is one of
``read``, ``write`` or ``delete``. Admins bypass every check, and managing
users, roles and sessions is reserved for the admin role itself.

``DEFAULT_ROLE_PERMISSIONS`` is what each role starts with. Admins can change a
role's permissions (stored in the ``roles`` collection) and grant or revoke
single permissions per user; the cache below holds the stored role permissions
so the checks stay synchronous.
"""
import time
from typing import Dict, FrozenSet, Iterable, Optional

from app.utils.constants import UserRole

# HTTP method → action, used by module-level router guards
METHOD_ACTIONS: Dict[str, str] = {
    "GET": "read",
    "HEAD": "read",
    "OPTIONS": "read",
    "POST": "write",
    "PUT": "write",
    "PATCH": "write",
    "DELETE": "delete",
}

ACTION_LABELS: Dict[str, str] = {"read": "View", "write": "Add and edit", "delete": "Delete"}

# Every permission a route checks. The admin screens list exactly these,
# so a permission can't be granted unless some route enforces it.
PERMISSION_MODULES: list[dict] = [
    {"module": "patients", "label": "Patients", "description": "Patient records.", "actions": ["read", "write", "delete"]},
    {"module": "prescriptions", "label": "Prescriptions", "description": "Eye prescriptions.", "actions": ["read", "write", "delete"]},
    {"module": "appointments", "label": "Appointments", "description": "Bookings and the schedule.", "actions": ["read", "write", "delete"]},
    {"module": "sales", "label": "Sales", "description": "Sales orders, invoices and customer payments.", "actions": ["read", "write", "delete"]},
    {"module": "catalog", "label": "Master data", "description": "Lenses, categories, charge types and free item rules.", "actions": ["read", "write", "delete"]},
    {"module": "inventory", "label": "Inventory", "description": "Products, frames, stock receiving and adjustments.", "actions": ["read", "write", "delete"]},
    {"module": "purchasing", "label": "Purchasing", "description": "Suppliers, purchase orders, supplier invoices and payments.", "actions": ["read", "write", "delete"]},
    {"module": "finance", "label": "Finance", "description": "Transactions and the ledger.", "actions": ["read", "write", "delete"]},
    {"module": "doctors", "label": "Doctors", "description": "Doctor and optometrist records.", "actions": ["read", "write", "delete"]},
    {"module": "reports", "label": "Reports", "description": "Reports and exports.", "actions": ["read"]},
    {"module": "dashboard", "label": "Dashboard", "description": "The dashboard figures.", "actions": ["read"]},
    {"module": "audit", "label": "Activity logs", "description": "Who changed what, and when.", "actions": ["read"]},
    {"module": "settings", "label": "Company profile", "description": "Business details and document defaults.", "actions": ["read", "write"]},
    {"module": "users", "label": "Staff list", "description": "See who uses the system, e.g. to pick a doctor.", "actions": ["read"]},
]

ALL_PERMISSIONS: FrozenSet[str] = frozenset(
    f"{m['module']}.{action}" for m in PERMISSION_MODULES for action in m["actions"]
)


def _module(module: str, *actions: str) -> set[str]:
    return {f"{module}.{action}" for action in actions}


# Everyone who signs in works the front counter: patients, prescriptions,
# appointments and sales. Patient/prescription deletes are included because the
# sales-order wizard deletes them to roll back a failed order.
_COMMON = (
    _module("patients", "read", "write", "delete")
    | _module("prescriptions", "read", "write", "delete")
    | _module("appointments", "read", "write")
    | _module("sales", "read", "write")
    | _module("catalog", "read", "write")
    | _module("inventory", "read")
    | _module("doctors", "read")
    | _module("reports", "read")
    | _module("dashboard", "read")
    | _module("audit", "read")
    | _module("settings", "read")
    | _module("users", "read")
)

DEFAULT_ROLE_PERMISSIONS: Dict[UserRole, FrozenSet[str]] = {
    UserRole.DOCTOR: frozenset(_COMMON),
    UserRole.OPTOMETRIST: frozenset(_COMMON),
    UserRole.RECEPTIONIST: frozenset(
        _COMMON
        | _module("finance", "read", "write")
    ),
    UserRole.STAFF: frozenset(
        _COMMON
        | _module("inventory", "write", "delete")
        | _module("purchasing", "read", "write")
        | _module("finance", "read", "write")
    ),
}

ROLE_LABELS: Dict[UserRole, str] = {
    UserRole.ADMIN: "Admin",
    UserRole.DOCTOR: "Doctor",
    UserRole.OPTOMETRIST: "Optometrist",
    UserRole.RECEPTIONIST: "Receptionist",
    UserRole.STAFF: "Staff",
}

ROLE_DESCRIPTIONS: Dict[UserRole, str] = {
    UserRole.ADMIN: "Full access, including users, roles and sessions.",
    UserRole.DOCTOR: "Clinical work at the front counter.",
    UserRole.OPTOMETRIST: "Clinical work at the front counter.",
    UserRole.RECEPTIONIST: "Front counter work plus payments and finance.",
    UserRole.STAFF: "Front counter work plus inventory, purchasing and finance.",
}

# How long a worker trusts its copy of the stored role permissions. Each worker
# reloads after this, so an edit reaches every worker within this many seconds.
ROLE_CACHE_TTL_SECONDS = 30.0

_role_permissions: Dict[UserRole, FrozenSet[str]] = dict(DEFAULT_ROLE_PERMISSIONS)
_role_permissions_loaded_at: Optional[float] = None


def set_role_permissions(mapping: Dict[UserRole, Iterable[str]]) -> None:
    """Replace the cached role permissions (roles missing from ``mapping`` use defaults)."""
    global _role_permissions, _role_permissions_loaded_at
    merged = dict(DEFAULT_ROLE_PERMISSIONS)
    for role, codes in mapping.items():
        if role != UserRole.ADMIN:
            merged[role] = frozenset(codes) & ALL_PERMISSIONS
    _role_permissions = merged
    _role_permissions_loaded_at = time.monotonic()


def reset_role_permissions_cache() -> None:
    """Back to the defaults and marked stale (used by tests)."""
    global _role_permissions, _role_permissions_loaded_at
    _role_permissions = dict(DEFAULT_ROLE_PERMISSIONS)
    _role_permissions_loaded_at = None


def role_permissions_stale() -> bool:
    return (
        _role_permissions_loaded_at is None
        or time.monotonic() - _role_permissions_loaded_at > ROLE_CACHE_TTL_SECONDS
    )


def _as_role(role: UserRole | str) -> Optional[UserRole]:
    try:
        return UserRole(role)
    except ValueError:
        return None


def role_permissions(role: UserRole | str) -> FrozenSet[str]:
    """Permission codes the role grants (not including per-user changes)."""
    role = _as_role(role)
    if role is None:
        return frozenset()
    if role == UserRole.ADMIN:
        return ALL_PERMISSIONS
    return _role_permissions.get(role, frozenset())


def has_permission(role: UserRole | str, code: str) -> bool:
    """Return True if ``role`` is allowed to perform ``code``."""
    role = _as_role(role)
    if role is None:
        return False
    if role == UserRole.ADMIN:
        return True
    return code in _role_permissions.get(role, frozenset())


def effective_permissions(user) -> FrozenSet[str]:
    """The user's role permissions plus their grants, minus their revokes."""
    role = _as_role(user.role)
    if role is None:
        return frozenset()
    if role == UserRole.ADMIN:
        return ALL_PERMISSIONS
    granted = set(getattr(user, "granted_permissions", None) or [])
    revoked = set(getattr(user, "revoked_permissions", None) or [])
    return frozenset((role_permissions(role) | granted) - revoked) & ALL_PERMISSIONS


def user_has_permission(user, code: str) -> bool:
    """Like ``has_permission`` but includes the user's own grants and revokes."""
    if _as_role(user.role) == UserRole.ADMIN:
        return True
    return code in effective_permissions(user)


def permissions_for(role: UserRole | str) -> list[str]:
    """All permission codes granted to ``role`` (``["*"]`` for admins)."""
    role = _as_role(role)
    if role is None:
        return []
    if role == UserRole.ADMIN:
        return ["*"]
    return sorted(role_permissions(role))


def unknown_permissions(codes: Iterable[str]) -> list[str]:
    return sorted(set(codes) - ALL_PERMISSIONS)
