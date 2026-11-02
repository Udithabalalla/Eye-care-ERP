"""Self sign-up with a chosen role, confirmed by an emailed code (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime, timedelta, timezone

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

from app.config.database import get_database
from app.config.settings import settings
from app.main import app

EMAIL = "new.person@example.com"


class FakeEmail:
    def __init__(self, fail: bool = False):
        self.sent: list[tuple[str, str]] = []
        self.fail = fail

    async def send_signup_otp(self, recipient_email, recipient_name, otp, expires_at):
        if self.fail:
            raise RuntimeError("email down")
        self.sent.append((recipient_email, otp))


@pytest.fixture
async def db():
    return AsyncMongoMockClient()["test_signup"]


@pytest.fixture
def outbox(monkeypatch):
    fake = FakeEmail()
    monkeypatch.setattr("app.services.signup_service.EmailService", lambda: fake)
    return fake


@pytest.fixture
async def http(db):
    app.dependency_overrides[get_database] = lambda: db
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        yield client
    app.dependency_overrides.clear()


def signup_body(role: str = "admin", email: str = EMAIL) -> dict:
    return {"email": email, "password": "my-password-1", "name": "New Person", "role": role}


@pytest.mark.parametrize("role", ["admin", "receptionist"])
async def test_account_is_created_with_its_role_only_after_the_code(http, db, outbox, role):
    started = await http.post("/auth/register", json=signup_body(role))
    assert started.status_code == 200, started.text
    assert started.json()["email"] == EMAIL
    assert "access_token" not in started.json()
    assert await db["users"].count_documents({}) == 0
    stored = await db["signup_requests"].find_one({"email": EMAIL})
    assert stored["password_hash"] != "my-password-1"

    (sent_to, otp), = outbox.sent
    assert sent_to == EMAIL
    assert stored["otp_hash"] != otp

    verified = await http.post("/auth/register/verify", json={"email": EMAIL, "otp": otp})
    assert verified.status_code == 200, verified.text
    body = verified.json()
    assert body["user"]["role"] == role and body["refresh_token"]
    assert await db["signup_requests"].count_documents({}) == 0

    me = await http.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert (await http.post("/auth/login", json={"email": EMAIL, "password": "my-password-1"})).status_code == 200


async def test_wrong_codes_are_limited(http, db, outbox):
    await http.post("/auth/register", json=signup_body())
    _, otp = outbox.sent[0]
    wrong = "000000" if otp != "000000" else "111111"
    for _ in range(settings.PASSWORD_RESET_OTP_MAX_ATTEMPTS - 1):
        assert (await http.post("/auth/register/verify", json={"email": EMAIL, "otp": wrong})).status_code == 400
    last = await http.post("/auth/register/verify", json={"email": EMAIL, "otp": wrong})
    assert "Too many" in last.json()["detail"]
    # The request is gone, so even the right code no longer works
    assert (await http.post("/auth/register/verify", json={"email": EMAIL, "otp": otp})).status_code == 400
    assert await db["users"].count_documents({}) == 0


async def test_expired_code_is_refused(http, db, outbox):
    await http.post("/auth/register", json=signup_body())
    _, otp = outbox.sent[0]
    await db["signup_requests"].update_one(
        {"email": EMAIL}, {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(seconds=1)}}
    )
    response = await http.post("/auth/register/verify", json={"email": EMAIL, "otp": otp})
    assert response.status_code == 400 and "expired" in response.json()["detail"]


async def test_existing_email_and_resend_window(http, db, outbox):
    await db["users"].insert_one({
        "user_id": "USR-1", "email": "taken@example.com", "name": "Taken", "password_hash": "x",
        "role": "staff", "is_active": True, "created_at": datetime.now(timezone.utc),
    })
    assert (await http.post("/auth/register", json=signup_body(email="taken@example.com"))).status_code == 409

    await http.post("/auth/register", json=signup_body())
    await http.post("/auth/register", json=signup_body())
    assert len(outbox.sent) == 1


async def test_failed_email_is_reported_and_nothing_is_kept(http, db, monkeypatch):
    monkeypatch.setattr("app.services.signup_service.EmailService", lambda: FakeEmail(fail=True))
    response = await http.post("/auth/register", json=signup_body())
    assert response.status_code == 400 and "couldn't send" in response.json()["detail"]
    assert await db["signup_requests"].count_documents({}) == 0
