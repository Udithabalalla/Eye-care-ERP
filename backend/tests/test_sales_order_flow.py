"""Sales order money/stock flows against an in-memory MongoDB (mongomock-motor).

Covers: discounts reaching order/ledger/invoice, cancellation reversing stock,
ledger and invoice, and edits to confirmed orders applying only the difference.
"""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import datetime, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.core.exceptions import BadRequestException
from app.schemas.sales_order import SalesOrderCreate, SalesOrderUpdate
from app.services.sales_order_service import SalesOrderService
from app.utils.constants import Gender, SalesOrderStatus

USER = "USR-TEST"


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_eye_care"]
    now = datetime.now(timezone.utc)
    await database["patients"].insert_one({
        "patient_id": "PAT000001", "name": "Test Patient", "date_of_birth": datetime(1990, 1, 1),
        "gender": list(Gender)[0].value, "phone": "0770000000", "is_active": True, "created_at": now,
    })
    await database["products"].insert_one({
        "product_id": "PRD001", "name": "Lens Cleaner", "category": "accessories", "sku": "LC-1",
        "cost_price": 40, "selling_price": 100, "mrp": 100, "current_stock": 5, "is_active": True, "created_at": now,
    })
    return database


def _order(**overrides) -> SalesOrderCreate:
    payload = {
        "patient_id": "PAT000001",
        "status": SalesOrderStatus.CREATED,
        "discount_amount": 20,
        "items": [
            {"product_id": "PRD001", "quantity": 2, "unit_price": 100, "line_type": "product", "track_stock": True},
            {"product_id": "EXP-1", "product_name": "Fitting", "quantity": 1, "unit_price": 50,
             "discount": 10, "line_type": "expense", "track_stock": False},
        ],
    }
    payload.update(overrides)
    return SalesOrderCreate(**payload)


async def _stock(db) -> int:
    return (await db["products"].find_one({"product_id": "PRD001"}))["current_stock"]


async def _net_sale(db, order_id: str) -> float:
    return await SalesOrderService(db)._posted_sale_amount(order_id)


async def test_discounts_reach_order_ledger_and_invoice(db):
    service = SalesOrderService(db)
    order = await service.create_sales_order(_order(), USER)

    # 2×100 + (50 − 10 line discount) = 240 subtotal, − 20 order discount = 220
    assert order.subtotal == 240
    assert order.discount_amount == 20
    assert order.total_amount == 220
    assert await _stock(db) == 3
    assert await _net_sale(db, order.order_id) == 220

    invoice = await service.generate_invoice(order.order_id, USER)
    stored = await db["invoices"].find_one({"invoice_id": invoice.invoice_id})
    assert stored["subtotal"] == 240
    assert stored["total_discount"] == 20
    assert stored["total_amount"] == 220
    assert stored["balance_due"] == 220


async def test_discount_falls_back_to_measurements_for_older_clients(db):
    order = await SalesOrderService(db).create_sales_order(
        _order(discount_amount=None, measurements={"discount": 15}), USER
    )
    assert order.total_amount == 225


async def test_discount_cannot_exceed_subtotal(db):
    with pytest.raises(BadRequestException):
        await SalesOrderService(db).create_sales_order(_order(discount_amount=1000), USER)
    assert await db["sales_orders"].count_documents({}) == 0
    assert await _stock(db) == 5


async def test_cancel_returns_stock_reverses_sale_and_cancels_invoice(db):
    service = SalesOrderService(db)
    order = await service.create_sales_order(_order(), USER)
    invoice = await service.generate_invoice(order.order_id, USER)

    await service.update_sales_order_status(order.order_id, SalesOrderStatus.CANCELLED, USER)

    assert await _stock(db) == 5
    assert await _net_sale(db, order.order_id) == 0
    stored = await db["invoices"].find_one({"invoice_id": invoice.invoice_id})
    assert stored["payment_status"] == "cancelled"
    assert stored["balance_due"] == 0


async def test_cancel_via_update_also_reverses(db):
    service = SalesOrderService(db)
    order = await service.create_sales_order(_order(), USER)
    await service.update_sales_order(order.order_id, SalesOrderUpdate(status=SalesOrderStatus.CANCELLED), USER)
    assert await _stock(db) == 5
    assert await _net_sale(db, order.order_id) == 0


async def test_editing_confirmed_order_applies_only_the_difference(db):
    service = SalesOrderService(db)
    order = await service.create_sales_order(_order(), USER)
    invoice = await service.generate_invoice(order.order_id, USER)

    items = [i.model_dump() for i in order.items]
    items[0]["quantity"] = 1
    updated = await service.update_sales_order(order.order_id, SalesOrderUpdate(items=items), USER)

    assert updated.total_amount == 120  # 100 + 40 − 20
    assert await _stock(db) == 4
    assert await _net_sale(db, order.order_id) == 120
    stored = await db["invoices"].find_one({"invoice_id": invoice.invoice_id})
    assert stored["total_amount"] == 120
    assert stored["balance_due"] == 120

    # Editing notes only must not move stock or touch the ledger again
    await service.update_sales_order(order.order_id, SalesOrderUpdate(notes="call when ready"), USER)
    assert await _stock(db) == 4
    assert await _net_sale(db, order.order_id) == 120


async def test_edit_needing_more_stock_than_available_is_rejected(db):
    service = SalesOrderService(db)
    order = await service.create_sales_order(_order(), USER)
    items = [i.model_dump() for i in order.items]
    items[0]["quantity"] = 9  # 2 already deducted, 3 left in stock

    with pytest.raises(BadRequestException):
        await service.update_sales_order(order.order_id, SalesOrderUpdate(items=items), USER)
    assert await _stock(db) == 3
    assert (await service.get_sales_order(order.order_id)).items[0].quantity == 2


async def test_draft_books_stock_and_sale_only_when_it_leaves_draft(db):
    service = SalesOrderService(db)
    draft = await service.create_sales_order(_order(status=SalesOrderStatus.DRAFT), USER)
    assert await _stock(db) == 5
    assert await _net_sale(db, draft.order_id) == 0

    await service.update_sales_order(draft.order_id, SalesOrderUpdate(status=SalesOrderStatus.CREATED), USER)
    assert await _stock(db) == 3
    assert await _net_sale(db, draft.order_id) == 220


async def test_confirming_draft_via_status_endpoint_deducts_stock(db):
    service = SalesOrderService(db)
    draft = await service.create_sales_order(_order(status=SalesOrderStatus.DRAFT), USER)
    await service.update_sales_order_status(draft.order_id, SalesOrderStatus.CONFIRMED, USER)
    assert await _stock(db) == 3
    assert await _net_sale(db, draft.order_id) == 220
