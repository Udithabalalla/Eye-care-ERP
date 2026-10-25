"""Purchase order writing against an in-memory MongoDB (mongomock-motor).

Covers: lines carry item names, older lines get named on read, draft edits
(and their refusal once approved), supplier payment terms and the PDF.
"""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.exceptions import BadRequestException
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderSendRequest
from app.schemas.supplier_invoice import SupplierInvoiceCreate
from app.schemas.supplier_payment import SupplierInvoicePaymentCreate
from app.services.purchase_order_service import PurchaseOrderService
from app.services.supplier_invoice_service import SupplierInvoiceService
from app.services.supplier_payment_service import SupplierPaymentService
from app.utils.constants import PurchaseOrderStatus

USER = "USR-TEST"


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_purchase_orders"]
    now = datetime.now(timezone.utc)
    await database["suppliers"].insert_one(
        {"id": "SUP000001", "supplier_name": "Acme Optics", "payment_terms": "30 days", "is_active": True, "created_at": now},
    )
    await database["users"].insert_one({"user_id": USER, "name": "Nimal Perera", "email": "n@example.com", "password_hash": "x", "role": "admin"})
    await database["frame_variants"].insert_one({
        "variant_id": "FV-000001", "sku": "BOS-1602-BLK-52-F", "barcode": "BOS-1602-BLK-52-F",
        "frame_master_id": "FM-000001",
        "frame_master_ref": {"brand": "Boss", "model_code": "1602", "frame_name": "Boss 1602"},
        "color": "Black", "eye_size": 52, "rim_type": "full",
        "cost_price": 1000.0, "selling_price": 4000.0, "mrp": 4500.0,
        "current_stock": 1, "reorder_level": 2, "is_active": True, "created_at": now,
    })
    await database["products"].insert_one({
        "product_id": "PRD000001", "name": "Lens Cleaner", "category": "accessories", "sku": "LC-1",
        "cost_price": 40, "selling_price": 100, "mrp": 100, "current_stock": 2, "min_stock_level": 10,
        "is_active": True, "created_at": now,
    })
    return database


def _order(**overrides) -> PurchaseOrderCreate:
    return PurchaseOrderCreate(**{
        "supplier_id": "SUP000001",
        "order_date": datetime.now(timezone.utc),
        "items": [
            {"frame_variant_id": "FV-000001", "quantity": 4, "unit_cost": 1000.0},
            {"product_id": "PRD000001", "quantity": 10, "unit_cost": 40.0},
        ],
        **overrides,
    })


async def test_lines_carry_item_names_and_supplier_terms(db):
    po = await PurchaseOrderService(db).create_purchase_order(_order(), USER)

    frame, product = po.items
    assert (frame.item_type, frame.item_name, frame.item_detail, frame.sku) == ("frame", "Boss 1602", "Black · 52 mm", "BOS-1602-BLK-52-F")
    assert (product.item_type, product.item_name, product.item_detail, product.sku) == ("product", "Lens Cleaner", "Accessories", "LC-1")
    assert po.total_amount == 4400.0
    assert po.payment_terms.payment_terms == "30 days"


async def test_older_lines_without_names_are_named_on_read(db):
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(_order(), USER)
    await db["purchase_orders"].update_one(
        {"id": po.id},
        {"$unset": {f"items.{i}.{field}": "" for i in range(2) for field in ("item_name", "item_detail", "sku", "item_type")}},
    )

    reread = await service.get_purchase_order(po.id)
    assert [item.item_name for item in reread.items] == ["Boss 1602", "Lens Cleaner"]


async def test_draft_edit_rewrites_lines_and_totals(db):
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(_order(), USER)

    edited = await service.update_draft(po.id, _order(
        items=[{"product_id": "PRD000001", "quantity": 25, "unit_cost": 38.0}],
        summary={"shipping_cost": 500, "discount": 50},
        notes={"supplier_notes": "Deliver before noon"},
    ), USER)

    assert edited.id == po.id and edited.status == "Draft"
    assert [(item.item_name, item.quantity) for item in edited.items] == [("Lens Cleaner", 25)]
    assert edited.order_summary.subtotal == 950.0
    assert edited.total_amount == 1400.0  # 950 − 50 + 500 shipping
    assert edited.notes.supplier_notes == "Deliver before noon"
    assert edited.created_by == USER


async def test_approved_orders_cannot_be_edited(db):
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(_order(), USER)
    await service.update_status(po.id, PurchaseOrderStatus.APPROVED.value, USER)

    with pytest.raises(BadRequestException):
        await service.update_draft(po.id, _order(), USER)


async def test_pdf_builds_for_draft_and_approved_orders(db):
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(_order(notes={"supplier_notes": "Fragile"}), USER)

    draft_pdf, filename = await service.generate_purchase_order_pdf(po.id)
    assert draft_pdf.startswith(b"%PDF") and filename == f"{po.id}.pdf"

    await service.update_status(po.id, PurchaseOrderStatus.APPROVED.value, USER)
    approved_pdf, _ = await service.generate_purchase_order_pdf(po.id)
    assert approved_pdf.startswith(b"%PDF") and approved_pdf != draft_pdf


# ── Purchase to pay: send, invoice, pay ──────────────────────────────────────

class _FakeMailer:
    def __init__(self, error: Exception | None = None):
        self.sent = []
        self.error = error

    async def send_purchase_order(self, **kwargs):
        if self.error:
            raise self.error
        self.sent.append(kwargs)


async def _approved(db) -> str:
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(_order(), USER)
    await service.update_status(po.id, PurchaseOrderStatus.APPROVED.value, USER)
    return po.id


async def test_sending_an_approved_order_emails_the_pdf_and_marks_it_ordered(db):
    po_id = await _approved(db)
    mailer = _FakeMailer()

    sent = await PurchaseOrderService(db).send_to_supplier(
        po_id, PurchaseOrderSendRequest(to="orders@acme.lk"), USER, email_service=mailer,
    )

    assert sent.status == "Ordered"
    assert sent.sent_to == "orders@acme.lk" and sent.sent_by == USER and sent.sent_at
    (mail,) = mailer.sent
    assert mail["recipient_email"] == "orders@acme.lk"
    assert mail["filename"] == f"{po_id}.pdf" and mail["pdf_bytes"].startswith(b"%PDF")
    assert po_id in mail["subject"] and "Dear" in mail["body"]


async def test_drafts_cannot_be_sent_and_mail_problems_are_explained(db):
    service = PurchaseOrderService(db)
    draft = await service.create_purchase_order(_order(), USER)
    with pytest.raises(BadRequestException):
        await service.send_to_supplier(draft.id, PurchaseOrderSendRequest(to="a@b.lk"), USER, email_service=_FakeMailer())

    po_id = await _approved(db)
    with pytest.raises(BadRequestException, match="isn't set up"):
        await service.send_to_supplier(po_id, PurchaseOrderSendRequest(to="a@b.lk"), USER, email_service=_FakeMailer(RuntimeError("no smtp")))
    assert (await service.get_purchase_order(po_id)).status == "Approved"  # nothing changed


async def test_order_shows_its_supplier_invoice_and_what_is_left_to_pay(db):
    service = PurchaseOrderService(db)
    po_id = await _approved(db)
    await service.update_status(po_id, PurchaseOrderStatus.ORDERED.value, USER)
    await service.apply_receipt(po_id, [("FV-000001", 4), ("PRD000001", 10)], USER)

    invoice = await SupplierInvoiceService(db).create_supplier_invoice(SupplierInvoiceCreate(
        supplier_id="SUP000001", purchase_order_id=po_id, invoice_number="ACME-77",
        invoice_date=datetime.now(timezone.utc), due_date=datetime(2020, 1, 1, tzinfo=timezone.utc),
    ), USER)
    assert [item.product_name for item in invoice.items] == ["Boss 1602", "Lens Cleaner"]
    assert (invoice.paid_amount, invoice.balance_due) == (0, 4400.0)

    await SupplierPaymentService(db).record_invoice_payment(invoice.id, SupplierInvoicePaymentCreate(
        payment_date=datetime.now(timezone.utc), payment_method="cash", amount_paid=1400,
    ), USER)

    order = await service.get_purchase_order(po_id)
    assert order.supplier_invoice.invoice_number == "ACME-77"
    assert (order.supplier_invoice.paid_amount, order.supplier_invoice.balance_due) == (1400.0, 3000.0)
    listed = (await service.list_purchase_orders(1, 10)).data
    assert next(o for o in listed if o.id == po_id).supplier_invoice.balance_due == 3000.0

    invoices = SupplierInvoiceService(db)
    assert (await invoices.get_supplier_invoice(invoice.id)).balance_due == 3000.0
    assert [i.id for i in (await invoices.list_supplier_invoices(1, 10, search="acme")).data] == [invoice.id]  # supplier name
    assert [i.id for i in (await invoices.list_supplier_invoices(1, 10, overdue=True)).data] == [invoice.id]

    (payment,) = (await SupplierPaymentService(db).list_payments(1, 10)).data
    assert (payment.supplier_name, payment.purchase_order_id, payment.invoice_number) == ("Acme Optics", po_id, "ACME-77")


async def test_order_search_finds_supplier_and_items_even_on_older_orders(db):
    service = PurchaseOrderService(db)
    po = await service.create_purchase_order(_order(), USER)
    # An order saved before lines carried names
    await db["purchase_orders"].update_one({"id": po.id}, {"$unset": {"items.0.item_name": "", "items.1.item_name": ""}})

    for text in ("acme", po.id.lower(), "boss", "lens clean"):
        assert [o.id for o in (await service.list_purchase_orders(1, 10, search=text)).data] == [po.id], text
    assert (await service.list_purchase_orders(1, 10, search="nothing-like-this")).data == []


# ── Advance payments ─────────────────────────────────────────────────────────

def _pay(amount: float) -> SupplierInvoicePaymentCreate:
    return SupplierInvoicePaymentCreate(payment_date=datetime.now(timezone.utc), payment_method="bank-transfer", amount_paid=amount)


async def _received(db, po_id: str) -> None:
    service = PurchaseOrderService(db)
    await service.update_status(po_id, PurchaseOrderStatus.ORDERED.value, USER)
    await service.apply_receipt(po_id, [("FV-000001", 4), ("PRD000001", 10)], USER)


async def _invoice(db, po_id: str, number: str = "ACME-88"):
    return await SupplierInvoiceService(db).create_supplier_invoice(SupplierInvoiceCreate(
        supplier_id="SUP000001", purchase_order_id=po_id, invoice_number=number, invoice_date=datetime.now(timezone.utc),
    ), USER)


async def test_advances_count_against_the_invoice_when_it_arrives(db):
    payments = SupplierPaymentService(db)
    po_id = await _approved(db)

    advance = await payments.record_advance(po_id, _pay(1000), USER)
    assert advance.is_advance and advance.invoice_id is None and advance.supplier_name == "Acme Optics"
    assert (await PurchaseOrderService(db).get_purchase_order(po_id)).advance_paid == 1000
    with pytest.raises(BadRequestException):  # more than the 4400 order total
        await payments.record_advance(po_id, _pay(3401), USER)

    await _received(db, po_id)
    invoice = await _invoice(db, po_id)
    assert (invoice.paid_amount, invoice.balance_due, invoice.status) == (1000, 3400, "Partial")

    order = await PurchaseOrderService(db).get_purchase_order(po_id)
    assert order.advance_paid == 0 and order.supplier_invoice.paid_amount == 1000
    with pytest.raises(BadRequestException, match="pay against the invoice"):
        await payments.record_advance(po_id, _pay(100), USER)

    await payments.record_invoice_payment(invoice.id, _pay(3400), USER)
    listed = (await payments.list_payments(1, 10, purchase_order_id=po_id)).data
    assert sorted((p.is_advance, p.amount_paid) for p in listed) == [(False, 3400), (True, 1000)]
    assert (await PurchaseOrderService(db).get_purchase_order(po_id)).status == "Closed"


async def test_paying_the_whole_order_ahead_settles_and_closes_it_on_invoice(db):
    po_id = await _approved(db)
    await SupplierPaymentService(db).record_advance(po_id, _pay(4400), USER)
    await _received(db, po_id)

    invoice = await _invoice(db, po_id)
    assert (invoice.status, invoice.balance_due) == ("Paid", 0)
    assert (await PurchaseOrderService(db).get_purchase_order(po_id)).status == "Closed"


async def test_drafts_cannot_be_paid_ahead(db):
    draft = await PurchaseOrderService(db).create_purchase_order(_order(), USER)
    with pytest.raises(BadRequestException, match="Approve"):
        await SupplierPaymentService(db).record_advance(draft.id, _pay(100), USER)


async def test_purchase_record_pdf_has_the_order_invoice_and_payments(db):
    service = PurchaseOrderService(db)
    po_id = await _approved(db)
    await SupplierPaymentService(db).record_advance(po_id, _pay(500), USER)

    before_invoice, filename = await service.generate_purchase_record_pdf(po_id)
    assert before_invoice.startswith(b"%PDF") and filename == f"{po_id}-record.pdf"

    await _received(db, po_id)
    invoice = await _invoice(db, po_id)
    await SupplierPaymentService(db).record_invoice_payment(invoice.id, _pay(3900), USER)
    settled, _ = await service.generate_purchase_record_pdf(po_id)
    assert settled.startswith(b"%PDF") and settled != before_invoice
