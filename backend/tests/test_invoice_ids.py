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
    """Make invoice numbering think it is the given year at the shop."""
    monkeypatch.setattr(invoice_service_module, "business_today", lambda: date(year, 1, 2))


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


def test_business_today_is_the_shops_date_not_the_servers(monkeypatch):
    from datetime import datetime as real_datetime
    from app.utils import helpers

    # 23:30 UTC on 1 Jan is already 05:00 on 2 Jan in Sri Lanka
    class _Clock(real_datetime):
        @classmethod
        def now(cls, tz=None):
            moment = real_datetime(2027, 1, 1, 23, 30, tzinfo=timezone.utc)
            return moment.astimezone(tz) if tz else moment.replace(tzinfo=None)

    monkeypatch.setattr(helpers, "datetime", _Clock)
    assert helpers.business_today() == date(2027, 1, 2)


def _line(name, line_type, total, discount=0):
    from types import SimpleNamespace
    return SimpleNamespace(product_name=name, line_type=line_type, sku="SKU", quantity=1, unit_price=total + discount, discount=discount, total=total)


def test_customer_invoice_groups_the_glasses_into_one_line():
    lines = InvoiceService._customer_lines([
        _line("Ray-Ban RB5154", "frame", 38500),
        _line("Blue cut", "lens", 10000),
        _line("Fitting", "expense", 1000, discount=500),
        _line("Lens cleaner", "product", 900),
        _line("Free case", "complimentary", 0),
    ])
    assert [(l["name"], l["total"]) for l in lines] == [("Pair of spectacles", 49500), ("Lens cleaner", 900)]
    assert lines[0]["discount"] == 500 and lines[0]["unit_price"] == 50000


def test_own_frame_with_new_lenses_is_a_pair_of_lenses():
    lines = InvoiceService._customer_lines([_line("OG", "frame", 0), _line("Blue cut", "lens", 10000), _line("Nose pads", "expense", 200)])
    assert [(l["name"], l["total"]) for l in lines] == [("Pair of lenses", 10200)]


def test_new_frame_without_new_lenses_is_frame_lenses_og():
    lines = InvoiceService._customer_lines([_line("2 Star 2236", "frame", 4000), _line("Own lenses", "lens", 0)])
    assert [(l["name"], l["total"]) for l in lines] == [("Frame (lenses OG)", 4000)]


def test_services_only_order_lists_its_services():
    lines = InvoiceService._customer_lines([_line("Soldering", "expense", 750)])
    assert [(l["name"], l["grouped"]) for l in lines] == [("Soldering", False)]
