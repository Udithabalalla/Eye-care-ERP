"""User, role and session administration against an in-memory MongoDB (mongomock-motor).

Requests go through the real app and the real sign-in, so the guards, the
session checks and the role permission cache are all exercised end to end.
"""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

from app.api.deps import PASSWORD_CHANGE_REQUIRED
from app.config.database import get_database
from app.core.security import get_password_hash
from app.main import app
from app.services.session_service import SessionService, hash_token
from app.utils.constants import UserRole

PASSWORD = "correct-horse-1"
# One bcrypt hash for every seeded user keeps the suite quick
PASSWORD_HASH = get_password_hash(PASSWORD)


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_admin_access"]
    now = datetime.now(timezone.utc)
    for user_id, role in [
        ("USR-ADMIN", UserRole.ADMIN),
        ("USR-STAFF", UserRole.STAFF),
        ("USR-DOC", UserRole.DOCTOR),
        ("USR-RECEPTION", UserRole.RECEPTIONIST),
    ]:
        await database["users"].insert_one({
            "user_id": user_id, "email": f"{user_id.lower()}@example.com", "name": user_id.title(),
            "password_hash": PASSWORD_HASH, "role": role.value, "is_active": True,
            "created_at": now, "updated_at": now,
        })
    return database


@pytest.fixture
async def http(db):
    app.dependency_overrides[get_database] = lambda: db
    transport = httpx.ASGITransport(app=app, client=("203.0.113.7", 50000), raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        yield client
    app.dependency_overrides.clear()


async def sign_in(http, user_id: str, password: str = PASSWORD, agent: str = "pytest-browser") -> dict:
    response = await http.post(
        "/auth/login",
        json={"email": f"{user_id.lower()}@example.com", "password": password},
        headers={"User-Agent": agent},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    return {"token": body["access_token"], "refresh": body["refresh_token"], "user": body["user"]}


def auth(session: dict) -> dict:
    return {"Authorization": f"Bearer {session['token']}"}


# ── Admin-only enforcement ────────────────────────────────────────────────────

ADMIN_ONLY = [
    ("post", "/users", {"email": "x@example.com", "password": "password123", "name": "X Y", "role": "staff"}),
    ("put", "/users/USR-DOC", {"role": "staff"}),
    ("post", "/users/USR-DOC/reset-password", {"new_password": "password123"}),
    ("post", "/users/USR-DOC/deactivate", None),
    ("post", "/users/USR-DOC/activate", None),
    ("get", "/users/USR-DOC/permissions", None),
    ("put", "/users/USR-DOC/permissions", {"granted": ["finance.read"], "revoked": []}),
    ("get", "/users/USR-DOC/sessions", None),
    ("post", "/users/USR-DOC/sessions/revoke", None),
    ("get", "/roles/roles", None),
    ("get", "/roles/permissions", None),
    ("put", "/roles/roles/doctor", {"permission_ids": ["patients.read"]}),
    ("post", "/roles/roles/doctor/reset", None),
    ("get", "/sessions", None),
    ("delete", "/sessions/000000000000000000000000", None),
]


@pytest.mark.parametrize("method, path, body", ADMIN_ONLY)
async def test_admin_only_routes_refuse_other_roles(http, db, method, path, body):
    staff = await sign_in(http, "USR-STAFF")
    response = await http.request(method, path, json=body, headers=auth(staff))
    assert response.status_code == 403, response.text

    admin = await sign_in(http, "USR-ADMIN")
    response = await http.request(method, path, json=body, headers=auth(admin))
    assert response.status_code != 403, response.text


async def test_admin_only_routes_need_sign_in(http):
    for method, path, body in ADMIN_ONLY:
        response = await http.request(method, path, json=body)
        assert response.status_code in (401, 403), (method, path)
        assert response.status_code != 200


async def test_granting_every_permission_does_not_make_an_admin(http):
    admin = await sign_in(http, "USR-ADMIN")
    modules = (await http.get("/roles/permissions", headers=auth(admin))).json()["data"]
    every_code = [p["code"] for p in modules]
    response = await http.put("/users/USR-STAFF/permissions", json={"granted": every_code, "revoked": []},
                              headers=auth(admin))
    assert response.status_code == 200, response.text

    staff = await sign_in(http, "USR-STAFF")
    assert (await http.get("/sessions", headers=auth(staff))).status_code == 403
    assert (await http.post("/users", json=ADMIN_ONLY[0][2], headers=auth(staff))).status_code == 403


async def test_staff_list_never_includes_password_hashes(http):
    reception = await sign_in(http, "USR-RECEPTION")
    response = await http.get("/users", headers=auth(reception))
    assert response.status_code == 200
    for user in response.json()["data"]:
        assert "password_hash" not in user
        assert "granted_permissions" not in user

    admin = await sign_in(http, "USR-ADMIN")
    for user in (await http.get("/users", headers=auth(admin))).json()["data"]:
        assert "password_hash" not in user
        assert "active_sessions" in user


# ── Role and per-user permissions ─────────────────────────────────────────────

async def test_role_permission_changes_apply_on_the_next_request(http, db):
    admin = await sign_in(http, "USR-ADMIN")
    reception = await sign_in(http, "USR-RECEPTION")
    doctor = await sign_in(http, "USR-DOC")

    assert (await http.get("/ledger/summary", headers=auth(doctor))).status_code == 403

    roles = {r["role_id"]: r for r in (await http.get("/roles/roles", headers=auth(admin))).json()["data"]}
    assert roles["admin"]["editable"] is False
    assert roles["doctor"]["matches_defaults"] is True

    doctor_perms = set(roles["doctor"]["permission_ids"]) | {"finance.read"}
    response = await http.put("/roles/roles/doctor", json={"permission_ids": sorted(doctor_perms)}, headers=auth(admin))
    assert response.status_code == 200, response.text
    assert response.json()["data"]["matches_defaults"] is False

    reception_perms = set(roles["receptionist"]["permission_ids"]) - {"patients.read"}
    response = await http.put("/roles/roles/receptionist", json={"permission_ids": sorted(reception_perms)},
                              headers=auth(admin))
    assert response.status_code == 200, response.text

    assert (await http.get("/ledger/summary", headers=auth(doctor))).status_code != 403
    assert (await http.get("/patients", headers=auth(reception))).status_code == 403
    assert (await db["roles"].find_one({"role_id": "receptionist"}))["updated_by"] == "USR-ADMIN"

    response = await http.post("/roles/roles/receptionist/reset", headers=auth(admin))
    assert response.json()["data"]["matches_defaults"] is True
    assert (await http.get("/patients", headers=auth(reception))).status_code != 403


async def test_role_edits_reject_unknown_codes_and_the_admin_role(http):
    admin = await sign_in(http, "USR-ADMIN")
    response = await http.put("/roles/roles/staff", json={"permission_ids": ["users.manage"]}, headers=auth(admin))
    assert response.status_code == 400
    response = await http.put("/roles/roles/admin", json={"permission_ids": []}, headers=auth(admin))
    assert response.status_code == 400
    response = await http.put("/roles/roles/manager", json={"permission_ids": []}, headers=auth(admin))
    assert response.status_code == 404


async def test_user_grants_and_revokes_override_the_role(http):
    admin = await sign_in(http, "USR-ADMIN")
    doctor = await sign_in(http, "USR-DOC")
    assert (await http.post("/products", json={}, headers=auth(doctor))).status_code == 403
    assert (await http.get("/patients", headers=auth(doctor))).status_code != 403

    response = await http.put(
        "/users/USR-DOC/permissions",
        json={"granted": ["inventory.write"], "revoked": ["patients.read"]},
        headers=auth(admin),
    )
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert "inventory.write" in data["effective"] and "patients.read" not in data["effective"]

    # Got past the guard: 422 is the empty body failing validation
    assert (await http.post("/products", json={}, headers=auth(doctor))).status_code == 422
    assert (await http.get("/patients", headers=auth(doctor))).status_code == 403

    me = (await http.get("/auth/me", headers=auth(doctor))).json()["data"]
    assert "inventory.write" in me["permissions"] and "patients.read" not in me["permissions"]

    response = await http.put("/users/USR-DOC/permissions", json={"granted": ["x.read"], "revoked": []},
                              headers=auth(admin))
    assert response.status_code == 400


# ── Creating and managing accounts ────────────────────────────────────────────

async def test_admin_creates_an_account_that_must_change_its_password(http, db):
    admin = await sign_in(http, "USR-ADMIN")
    response = await http.post("/users", headers=auth(admin), json={
        "email": "New.Person@Example.com", "password": "temporary-pass", "name": "New Person",
        "role": "receptionist", "department": "Front desk",
    })
    assert response.status_code == 201, response.text
    created = response.json()["data"]
    assert created["email"] == "new.person@example.com"
    assert created["role"] == "receptionist"
    assert created["must_change_password"] is True
    assert "password_hash" not in created
    stored = await db["users"].find_one({"user_id": created["user_id"]})
    assert stored["password_hash"] != "temporary-pass"

    duplicate = await http.post("/users", headers=auth(admin), json={
        "email": "new.person@example.com", "password": "another-pass", "name": "Copy", "role": "staff",
    })
    assert duplicate.status_code == 409

    login = await http.post("/auth/login", json={"email": "new.person@example.com", "password": "temporary-pass"})
    assert login.status_code == 200
    new_user = {"token": login.json()["access_token"]}
    assert login.json()["user"]["must_change_password"] is True

    blocked = await http.get("/patients", headers=auth(new_user))
    assert blocked.status_code == 403 and blocked.json()["detail"] == PASSWORD_CHANGE_REQUIRED
    assert (await http.get("/auth/me", headers=auth(new_user))).status_code == 200

    changed = await http.post("/auth/change-password", headers=auth(new_user),
                              json={"old_password": "temporary-pass", "new_password": "my-own-password"})
    assert changed.status_code == 200, changed.text
    assert changed.json()["data"]["must_change_password"] is False
    assert (await http.get("/patients", headers=auth(new_user))).status_code != 403


async def test_admin_updates_role_and_details(http, db):
    admin = await sign_in(http, "USR-ADMIN")
    response = await http.put("/users/USR-DOC", headers=auth(admin),
                              json={"role": "optometrist", "department": "Clinic", "phone": ""})
    assert response.status_code == 200, response.text
    stored = await db["users"].find_one({"user_id": "USR-DOC"})
    assert stored["role"] == "optometrist" and stored["department"] == "Clinic" and stored["phone"] is None

    taken = await http.put("/users/USR-DOC", headers=auth(admin), json={"email": "usr-staff@example.com"})
    assert taken.status_code == 409


async def test_admin_cannot_lock_themselves_out(http, db):
    admin = await sign_in(http, "USR-ADMIN")
    assert (await http.post("/users/USR-ADMIN/deactivate", headers=auth(admin))).status_code == 400
    assert (await http.put("/users/USR-ADMIN", json={"role": "staff"}, headers=auth(admin))).status_code == 400

    # With a second admin, one admin can demote the other, who loses admin access at once
    await db["users"].update_one({"user_id": "USR-STAFF"}, {"$set": {"role": "admin"}})
    second = await sign_in(http, "USR-STAFF")
    assert (await http.put("/users/USR-ADMIN", json={"role": "staff"}, headers=auth(second))).status_code == 200
    assert (await http.get("/sessions", headers=auth(admin))).status_code == 403


async def test_deactivating_signs_the_user_out_everywhere(http):
    admin = await sign_in(http, "USR-ADMIN")
    doctor = await sign_in(http, "USR-DOC")

    response = await http.post("/users/USR-DOC/deactivate", headers=auth(admin))
    assert response.status_code == 200, response.text
    assert response.json()["data"]["revoked"] == 1

    assert (await http.get("/patients", headers=auth(doctor))).status_code == 401
    assert (await http.post("/auth/refresh", json={"refresh_token": doctor["refresh"]})).status_code == 401
    login = await http.post("/auth/login", json={"email": "usr-doc@example.com", "password": PASSWORD})
    assert login.status_code == 401

    assert (await http.post("/users/USR-DOC/activate", headers=auth(admin))).status_code == 200
    await sign_in(http, "USR-DOC")


async def test_password_reset_by_admin_ends_sessions_and_forces_a_change(http):
    admin = await sign_in(http, "USR-ADMIN")
    doctor = await sign_in(http, "USR-DOC")
    response = await http.post("/users/USR-DOC/reset-password", headers=auth(admin),
                               json={"new_password": "temporary-pass"})
    assert response.status_code == 200, response.text
    assert (await http.post("/auth/refresh", json={"refresh_token": doctor["refresh"]})).status_code == 401
    assert (await http.post("/auth/login", json={"email": "usr-doc@example.com", "password": PASSWORD})).status_code == 401
    relogin = await sign_in(http, "USR-DOC", password="temporary-pass")
    assert relogin["user"]["must_change_password"] is True


# ── Sessions ──────────────────────────────────────────────────────────────────

async def test_sessions_list_who_is_signed_in(http, db):
    admin = await sign_in(http, "USR-ADMIN")
    await sign_in(http, "USR-DOC", agent="Mozilla/5.0 (Windows NT 10.0) Chrome/130.0")

    response = await http.get("/sessions", headers=auth(admin))
    assert response.status_code == 200
    sessions = response.json()["data"]
    assert {s["user_id"] for s in sessions} == {"USR-ADMIN", "USR-DOC"}
    doctor_session = next(s for s in sessions if s["user_id"] == "USR-DOC")
    assert doctor_session["user_name"] == "Usr-Doc"
    assert doctor_session["user_role"] == "doctor"
    assert doctor_session["ip_address"] == "203.0.113.7"
    assert "Chrome" in doctor_session["user_agent"]
    assert doctor_session["signed_in_at"] and doctor_session["last_seen_at"]
    assert doctor_session["is_current"] is False
    assert next(s for s in sessions if s["user_id"] == "USR-ADMIN")["is_current"] is True

    # Only hashes are stored, and the API never returns them
    stored = await db["refresh_tokens"].find_one({"user_id": "USR-DOC"})
    assert "token" not in stored and stored["token_hash"]
    assert "token_hash" not in doctor_session


async def test_revoking_a_session_stops_its_refresh_and_access_tokens(http):
    admin = await sign_in(http, "USR-ADMIN")
    laptop = await sign_in(http, "USR-DOC", agent="laptop")
    phone = await sign_in(http, "USR-DOC", agent="phone")

    sessions = (await http.get("/sessions", params={"user_id": "USR-DOC"}, headers=auth(admin))).json()["data"]
    assert len(sessions) == 2
    laptop_id = next(s["session_id"] for s in sessions if s["user_agent"] == "laptop")

    assert (await http.delete(f"/sessions/{laptop_id}", headers=auth(admin))).status_code == 200
    assert (await http.delete(f"/sessions/{laptop_id}", headers=auth(admin))).status_code == 404

    assert (await http.post("/auth/refresh", json={"refresh_token": laptop["refresh"]})).status_code == 401
    assert (await http.get("/patients", headers=auth(laptop))).status_code == 401

    # The other device is untouched
    refreshed = await http.post("/auth/refresh", json={"refresh_token": phone["refresh"]})
    assert refreshed.status_code == 200
    assert (await http.get("/patients", headers={"Authorization": f"Bearer {refreshed.json()['access_token']}"})).status_code != 401

    remaining = (await http.get("/sessions", params={"user_id": "USR-DOC"}, headers=auth(admin))).json()["data"]
    assert [s["user_agent"] for s in remaining] == ["phone"]


async def test_revoking_all_of_a_users_sessions(http):
    admin = await sign_in(http, "USR-ADMIN")
    first = await sign_in(http, "USR-DOC")
    second = await sign_in(http, "USR-DOC")

    response = await http.post("/users/USR-DOC/sessions/revoke", headers=auth(admin))
    assert response.status_code == 200
    assert response.json()["data"]["revoked"] == 2
    for session in (first, second):
        assert (await http.post("/auth/refresh", json={"refresh_token": session["refresh"]})).status_code == 401
        assert (await http.get("/patients", headers=auth(session))).status_code == 401
    # The admin's own session is not affected
    assert (await http.get("/sessions", headers=auth(admin))).status_code == 200


async def test_logout_ends_the_session(http):
    doctor = await sign_in(http, "USR-DOC")
    assert (await http.post("/auth/logout", headers=auth(doctor))).status_code == 200
    assert (await http.post("/auth/refresh", json={"refresh_token": doctor["refresh"]})).status_code == 401


async def test_expired_and_revoked_sessions_are_not_listed(http, db):
    admin = await sign_in(http, "USR-ADMIN")
    doctor = await sign_in(http, "USR-DOC")
    await db["refresh_tokens"].update_many(
        {"user_id": "USR-DOC"}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=1)}}
    )
    sessions = (await http.get("/sessions", headers=auth(admin))).json()["data"]
    assert {s["user_id"] for s in sessions} == {"USR-ADMIN"}
    assert (await http.post("/auth/refresh", json={"refresh_token": doctor["refresh"]})).status_code == 401


async def test_plain_text_refresh_tokens_are_hashed_and_keep_working(http, db):
    await db["refresh_tokens"].insert_one({
        "token": "legacy-token", "user_id": "USR-DOC",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
    })
    assert await SessionService(db).hash_plain_tokens() == 1
    stored = await db["refresh_tokens"].find_one({"user_id": "USR-DOC"})
    assert "token" not in stored and stored["token_hash"] == hash_token("legacy-token")

    refreshed = await http.post("/auth/refresh", json={"refresh_token": "legacy-token"})
    assert refreshed.status_code == 200

    admin = await sign_in(http, "USR-ADMIN")
    legacy = next(s for s in (await http.get("/sessions", headers=auth(admin))).json()["data"]
                  if s["user_id"] == "USR-DOC")
    assert legacy["signed_in_at"]
    assert (await http.delete(f"/sessions/{legacy['session_id']}", headers=auth(admin))).status_code == 200
    assert (await http.post("/auth/refresh", json={"refresh_token": "legacy-token"})).status_code == 401
