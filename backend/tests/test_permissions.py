"""Role-based access checks for the API routers.

Runs without MongoDB: the database dependency is replaced by one that raises,
so an allowed request surfaces as 500/422 (it got past the guard) and a blocked
request as 403.
"""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.config.database import get_database
from app.core.permissions import has_permission
from app.main import app
from app.models.user import UserModel
from app.utils.constants import UserRole


def _user(role: UserRole) -> UserModel:
    return UserModel(
        user_id=f"USR-{role.value.upper()}",
        email=f"{role.value}@example.com",
        password_hash="x",
        name=role.value,
        role=role,
    )


class _NoDatabase:
    """Stands in for Motor; collections resolve lazily, queries fail."""

    def __getattr__(self, name):
        return _NoDatabase()

    __getitem__ = __getattr__

    def __call__(self, *args, **kwargs):
        raise RuntimeError("database not available in tests")


def _no_db():
    return _NoDatabase()


@pytest.fixture
def client_as():
    def make(role: UserRole) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: _user(role)
        app.dependency_overrides[get_database] = _no_db
        return TestClient(app, raise_server_exceptions=False)

    yield make
    app.dependency_overrides.clear()


BLOCKED = 403


@pytest.mark.parametrize(
    "role, method, path, allowed",
    [
        # Admin-only areas
        (UserRole.STAFF, "post", "/api/v1/users", False),
        (UserRole.STAFF, "put", "/api/v1/users/USR-OTHER", False),
        (UserRole.STAFF, "get", "/api/v1/roles/roles", False),
        (UserRole.STAFF, "put", "/api/v1/settings/company-profile", False),
        (UserRole.STAFF, "delete", "/api/v1/sales-orders/SO-1", False),
        (UserRole.STAFF, "delete", "/api/v1/doctors/DOC-1", False),
        (UserRole.ADMIN, "post", "/api/v1/users", True),
        (UserRole.ADMIN, "get", "/api/v1/roles/roles", True),
        (UserRole.ADMIN, "delete", "/api/v1/sales-orders/SO-1", True),
        # Front-counter work is open to every role
        (UserRole.RECEPTIONIST, "get", "/api/v1/patients", True),
        (UserRole.DOCTOR, "post", "/api/v1/sales-orders", True),
        (UserRole.OPTOMETRIST, "delete", "/api/v1/prescriptions/RX-1", True),
        (UserRole.RECEPTIONIST, "get", "/api/v1/users", True),
        # Inventory / purchasing / finance writes
        (UserRole.DOCTOR, "post", "/api/v1/products", False),
        (UserRole.STAFF, "post", "/api/v1/products", True),
        (UserRole.RECEPTIONIST, "post", "/api/v1/purchase-orders", False),
        (UserRole.STAFF, "post", "/api/v1/purchase-orders", True),
        (UserRole.DOCTOR, "get", "/api/v1/ledger/summary", False),
        (UserRole.RECEPTIONIST, "get", "/api/v1/ledger/summary", True),
        # Report export is a POST but only needs read access
        (UserRole.DOCTOR, "post", "/api/v1/reports/export", True),
        # Inventory tools: low stock is read-only, reorder creates POs, labels only read
        (UserRole.RECEPTIONIST, "get", "/api/v1/inventory/low-stock", True),
        (UserRole.DOCTOR, "post", "/api/v1/inventory/reorder", False),
        (UserRole.RECEPTIONIST, "post", "/api/v1/inventory/reorder", False),
        (UserRole.STAFF, "post", "/api/v1/inventory/reorder", True),
        (UserRole.DOCTOR, "post", "/api/v1/inventory/labels", True),
        (UserRole.DOCTOR, "post", "/api/v1/goods-receipts/GRN-1/commit", False),
    ],
)
def test_route_guards(client_as, role, method, path, allowed):
    client = client_as(role)
    if method in ("get", "delete"):
        response = getattr(client, method)(path)
    else:
        response = getattr(client, method)(path, json={})
    if allowed:
        assert response.status_code != BLOCKED, response.text
    else:
        assert response.status_code == BLOCKED, response.text


def test_change_password_only_for_own_account(client_as):
    client = client_as(UserRole.STAFF)
    body = {"old_password": "oldpassword", "new_password": "newpassword"}
    assert client.post("/api/v1/users/USR-OTHER/change-password", json=body).status_code == BLOCKED
    assert client.post("/api/v1/users/USR-STAFF/change-password", json=body).status_code != BLOCKED


def test_self_signup_disabled_by_default():
    client = TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides[get_database] = _no_db
    try:
        response = client.post(
            "/api/v1/auth/register",
            json={"email": "new@example.com", "password": "password123", "name": "New User", "role": "admin"},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == BLOCKED


def test_admin_has_every_permission():
    assert has_permission(UserRole.ADMIN, "anything.delete")
    assert not has_permission("not-a-role", "patients.read")
