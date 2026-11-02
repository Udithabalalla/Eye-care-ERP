"""Forgot-password OTP flow and email delivery, against an in-memory MongoDB (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

import argparse
import base64
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

import scripts.create_admin as create_admin
from app.config.database import get_database
from app.config.settings import settings
from app.core.security import get_password_hash, verify_password
from app.main import app
from app.services import email_service as email_module
from app.services.email_service import EmailService
from app.services.password_reset_service import PasswordResetService

EMAIL = "usr-doc@example.com"
PASSWORD = "correct-horse-1"


class FakeEmail:
    """Records the codes it would have emailed"""

    def __init__(self, fail: bool = False):
        self.sent: list[tuple[str, str]] = []
        self.fail = fail

    async def send_password_reset_otp(self, recipient_email, recipient_name, otp, expires_at):
        if self.fail:
            raise RuntimeError("SMTP blocked")
        self.sent.append((recipient_email, otp))


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_password_reset"]
    now = datetime.now(timezone.utc)
    await database["users"].insert_one({
        "user_id": "USR-DOC", "email": EMAIL, "name": "Doc", "password_hash": get_password_hash(PASSWORD),
        "role": "doctor", "is_active": True, "must_change_password": True, "created_at": now, "updated_at": now,
    })
    return database


@pytest.fixture
def outbox(monkeypatch):
    fake = FakeEmail()
    monkeypatch.setattr("app.services.password_reset_service.EmailService", lambda: fake)
    return fake


@pytest.fixture
async def http(db):
    app.dependency_overrides[get_database] = lambda: db
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as client:
        yield client
    app.dependency_overrides.clear()


async def test_otp_resets_the_password_and_signs_out_everywhere(http, db, outbox):
    login = await http.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    old_refresh = login.json()["refresh_token"]

    response = await http.post("/auth/password-reset/request", json={"email": EMAIL})
    assert response.status_code == 200
    assert len(outbox.sent) == 1
    sent_to, otp = outbox.sent[0]
    assert sent_to == EMAIL and len(otp) == 6 and otp.isdigit()
    stored = await db["password_reset_otps"].find_one({"email": EMAIL})
    assert stored["otp_hash"] != otp

    wrong = "000000" if otp != "000000" else "111111"
    bad = await http.post("/auth/password-reset/confirm", json={"email": EMAIL, "otp": wrong, "new_password": "brand-new-pass"})
    assert bad.status_code == 400

    ok = await http.post("/auth/password-reset/confirm", json={"email": EMAIL, "otp": otp, "new_password": "brand-new-pass"})
    assert ok.status_code == 200, ok.text

    user = await db["users"].find_one({"user_id": "USR-DOC"})
    assert verify_password("brand-new-pass", user["password_hash"])
    assert user["must_change_password"] is False
    assert (await http.post("/auth/refresh", json={"refresh_token": old_refresh})).status_code == 401
    # The code can't be used twice
    again = await http.post("/auth/password-reset/confirm", json={"email": EMAIL, "otp": otp, "new_password": "another-pass-1"})
    assert again.status_code == 400


async def test_unknown_email_gets_the_same_reply_and_no_email(http, outbox):
    known = await http.post("/auth/password-reset/request", json={"email": EMAIL})
    unknown = await http.post("/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()
    assert [to for to, _ in outbox.sent] == [EMAIL]


async def test_a_new_code_is_not_sent_within_the_resend_window(db, outbox):
    service = PasswordResetService(db)
    await service.request_reset(EMAIL)
    await service.request_reset(EMAIL)
    assert len(outbox.sent) == 1

    # Once the window has passed, a fresh code replaces the old one
    past = datetime.now(timezone.utc) - timedelta(seconds=settings.PASSWORD_RESET_RESEND_SECONDS + 1)
    await db["password_reset_otps"].update_one({"email": EMAIL}, {"$set": {"sent_at": past}})
    await service.request_reset(EMAIL)
    assert len(outbox.sent) == 2
    assert await db["password_reset_otps"].count_documents({"email": EMAIL}) == 1


async def test_a_failed_send_keeps_no_code_so_the_user_can_retry(db, monkeypatch):
    failing = FakeEmail(fail=True)
    monkeypatch.setattr("app.services.password_reset_service.EmailService", lambda: failing)
    response = await PasswordResetService(db).request_reset(EMAIL)
    assert "If the email address is registered" in response.message
    assert await db["password_reset_otps"].count_documents({"email": EMAIL}) == 0


async def test_brevo_sends_over_https_with_html_and_attachments(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "test-key")
    monkeypatch.setattr(settings, "EMAIL_PROVIDER", None)
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = request.headers
        captured["json"] = __import__("json").loads(request.content)
        return httpx.Response(201, json={"messageId": "x"})

    real_client = httpx.AsyncClient
    monkeypatch.setattr(email_module.httpx, "AsyncClient",
                        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))

    service = EmailService()
    assert service.provider == "brevo"
    await service.send_password_reset_otp(EMAIL, "Doc", "123456", datetime.now(timezone.utc))
    assert captured["url"] == email_module.BREVO_SEND_URL
    assert captured["headers"]["api-key"] == "test-key"
    payload = captured["json"]
    assert payload["to"] == [{"email": EMAIL}]
    assert payload["sender"]["email"] == settings.SMTP_FROM_EMAIL
    assert "123456" in payload["htmlContent"] and "123456" in payload["textContent"]

    await service.send_purchase_order("supplier@example.com", "PO-1", "Please see attached", b"%PDF-1", "PO-1.pdf",
                                      cc="buyer@example.com")
    payload = captured["json"]
    assert payload["attachment"] == [{"name": "PO-1.pdf", "content": base64.b64encode(b"%PDF-1").decode()}]
    assert payload["cc"] == [{"email": "buyer@example.com"}]
    assert "Please see attached" in payload["htmlContent"]


async def test_brevo_errors_are_raised(monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "test-key")
    real_client = httpx.AsyncClient
    monkeypatch.setattr(email_module.httpx, "AsyncClient", lambda **kw: real_client(
        transport=httpx.MockTransport(lambda r: httpx.Response(401, json={"message": "Key not found"})), **kw))
    message = EmailMessage()
    message["To"] = EMAIL
    message["Subject"] = "x"
    message.set_content("x")
    with pytest.raises(RuntimeError, match="Brevo refused"):
        await EmailService()._deliver(message)


async def test_create_admin_offers_to_deactivate_demo_accounts(db, monkeypatch):
    for email, password in [("admin@eyecare.com", "admin123"), ("doctor@eyecare.com", "changed-password")]:
        await db["users"].insert_one({
            "user_id": email, "email": email, "name": email, "password_hash": get_password_hash(password),
            "role": "admin", "is_active": True, "created_at": datetime.now(timezone.utc),
        })
    monkeypatch.setattr("builtins.input", lambda prompt="": "y")
    users = create_admin.UserService(db)
    await create_admin.offer_to_disable_demo_accounts(db, users, argparse.Namespace(yes=False), keep="me@example.com")

    # Only the account still using its published password is deactivated
    assert (await db["users"].find_one({"email": "admin@eyecare.com"}))["is_active"] is False
    assert (await db["users"].find_one({"email": "doctor@eyecare.com"}))["is_active"] is True
