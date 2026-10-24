"""Role-based access control.

Permission codes follow ``<module>.<action>`` where action is one of
``read``, ``write`` or ``delete``. Admins bypass every check.

The matrix below is the single source of truth for what each role may do.
Adjust it here — routers only declare which module they belong to.
"""
from typing import Dict, FrozenSet

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

ROLE_PERMISSIONS: Dict[UserRole, FrozenSet[str]] = {
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


def has_permission(role: UserRole | str, code: str) -> bool:
    """Return True if ``role`` is allowed to perform ``code``."""
    try:
        role = UserRole(role)
    except ValueError:
        return False
    if role == UserRole.ADMIN:
        return True
    return code in ROLE_PERMISSIONS.get(role, frozenset())


def permissions_for(role: UserRole | str) -> list[str]:
    """All permission codes granted to ``role`` (``["*"]`` for admins)."""
    try:
        role = UserRole(role)
    except ValueError:
        return []
    if role == UserRole.ADMIN:
        return ["*"]
    return sorted(ROLE_PERMISSIONS.get(role, frozenset()))
