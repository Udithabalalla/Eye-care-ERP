"""invoice_id uniqueness against an in-memory MongoDB (mongomock-motor).

invoice_number restarts at 000001 every year, so invoice_id comes from a global counter.
Covers: invoices in different years, the first invoice after seeding, a counter that is
behind stored ids, and the startup guard that makes invoice_id unique.
"""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import date, datetime, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient
from pymongo.errors import DuplicateKeyError

from app.config.database import ensure_unique_invoice_id_index
from app.repositories.invoice_repository import InvoiceRepository
from app.schemas.invoice import InvoiceCreate
from app.services import invoice_service as invoice_service_module
from app.services.invoice_service import InvoiceService
from app.utils.constants import Gender
from scripts.seed_data import seed_invoices

USER = "USR-TEST"


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_eye_care"]
    await database["patients"].insert_one({
        "patient_id": "PAT000001", "name": "Test Patient", "date_of_birth": datetime(1990, 1, 1),
        "gender": list(Gender)[0].value, "phone": "0770000000", "is_active": True,
        "created_at": datetime.now(timezone.utc),
    })
    return database


def _invoice() -> InvoiceCreate:
    return InvoiceCreate(
        patient_id="PAT000001",
        invoice_date=date.today(),
        due_date=date.today(),
        items=[{
            "product_id": "EXP-1", "product_name": "Fitting", "sku": "EXP-1", "quantity": 1,
            "unit_price": 50, "total": 50, "line_type": "expense", "track_stock": False,
        }],
    )


def _set_year(monkeypatch, year: int):
    """Make invoice numbering think it is the given year."""
    class _Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            return datetime(year, 1, 2, tzinfo=tz)

    monkeypatch.setattr(invoice_service_module, "datetime", _Clock)


async def test_invoices_in_different_years_get_different_ids(db, monkeypatch):
    service = InvoiceService(db)

    _set_year(monkeypatch, 2026)
    first = await service.create_invoice(_invoice(), USER)
    _set_year(monkeypatch, 2027)
    second = await service.create_invoice(_invoice(), USER)

    # Both are the first invoice of their year, but their ids must differ
    assert first.invoice_number == "INV-2026-000001"
    assert second.invoice_number == "INV-2027-000001"
    assert first.invoice_id != second.invoice_id

    # An update by id lands on that invoice only
    repo = InvoiceRepository(db)
    await repo.update_invoice(second.invoice_id, {"paid_amount": 20})
    assert (await repo.get_by_invoice_id(first.invoice_id)).paid_amount == 0
    assert (await repo.get_by_invoice_id(second.invoice_id)).paid_amount == 20


async def test_first_invoice_after_seeding_does_not_reuse_a_seeded_id(db, monkeypatch):
    await seed_invoices(db)
    seeded = {doc["invoice_id"]: doc async for doc in db["invoices"].find()}

    _set_year(monkeypatch, 2026)
    invoice = await InvoiceService(db).create_invoice(_invoice(), USER)

    # Under the old scheme INV-2026-000001 became INV000001, the seeded INV-2024-000001's id
    assert invoice.invoice_number == "INV-2026-000001"
    assert invoice.invoice_id not in seeded
    assert invoice.invoice_id == "INV000004"
    assert await db["invoices"].count_documents({"invoice_id": "INV000001"}) == 1


async def test_counter_behind_stored_ids_skips_past_them(db):
    # Ids written before the counter existed (old per-year scheme), and no counter document
    for invoice_id in ("INV000001", "INV000007"):
        await db["invoices"].insert_one({"invoice_id": invoice_id})

    repo = InvoiceRepository(db)
    assert await repo.next_invoice_id() == "INV000008"
    assert await repo.next_invoice_id() == "INV000009"


async def test_unique_invoice_id_index_is_added_when_ids_are_clean(db):
    invoices = db["invoices"]
    await invoices.create_index("invoice_id")
    await invoices.insert_one({"invoice_id": "INV000001"})

    assert await ensure_unique_invoice_id_index(invoices) is True
    assert (await invoices.index_information())["invoice_id_1"].get("unique") is True
    with pytest.raises(DuplicateKeyError):
        await invoices.insert_one({"invoice_id": "INV000001"})


async def test_unique_invoice_id_index_waits_while_ids_repeat(db):
    invoices = db["invoices"]
    await invoices.insert_many([{"invoice_id": "INV000001"}, {"invoice_id": "INV000001"}])

    assert await ensure_unique_invoice_id_index(invoices) is False
    assert not (await invoices.index_information())["invoice_id_1"].get("unique")
