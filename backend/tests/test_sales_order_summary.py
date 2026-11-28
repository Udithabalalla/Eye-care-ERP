"""The figures above the Sales Orders table and the list's tabs, filters and sorting (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.services.sales_order_service import SalesOrderService
from app.services.sales_order_summary_service import SalesOrderSummaryService

TODAY = date(2026, 11, 20)


def at(d: date, hour: int = 10) -> datetime:
    return datetime(d.year, d.month, d.day, hour, tzinfo=timezone.utc)


def order(order_id: str, status: str, total: float, created: date, **extra) -> dict:
    return {
        "order_id": order_id, "order_number": f"SO-{order_id}", "patient_id": "P1", "status": status,
        "items": [], "subtotal": total, "total_amount": total, "created_by": "U", "created_at": at(created),
        "updated_at": at(created), **extra,
    }


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_so_summary"]
    await database["patients"].insert_one({
        "patient_id": "P1", "name": "Nimali", "phone": "0771", "date_of_birth": datetime(1990, 1, 1), "gender": "female",
        "is_active": True, "created_at": at(TODAY),
    })
    late = TODAY - timedelta(days=4)
    await database["sales_orders"].insert_many([
        # Invoiced, part paid, promised 4 days ago, still at the lab: late and owing
        order("S1", "lens_ordered", 1000, TODAY - timedelta(days=10), invoice_id="I1", expected_delivery_date=at(late, 0)),
        # No invoice yet, 300 advance; promised in 3 days
        order("S2", "created", 800, TODAY - timedelta(days=1), measurements={"advance_payment": 300},
              expected_delivery_date=at(TODAY + timedelta(days=3), 0)),
        # Older status shown as "Order Created"; promised long ago (before the 30-day window)
        order("S3", "confirmed", 500, date(2026, 8, 1), expected_delivery_date=at(date(2026, 8, 10), 0)),
        # Ready (not late, even though its date has passed), fully paid invoice
        order("S4", "ready", 600, TODAY - timedelta(days=2), invoice_id="I4", expected_delivery_date=at(late, 0)),
        order("S5", "draft", 999, TODAY),
        order("S6", "cancelled", 700, TODAY, invoice_id="I6"),
        order("S7", "completed", 400, date(2026, 10, 1)),
    ])
    await database["invoices"].insert_many([
        {"invoice_id": "I1", "sales_order_id": "S1", "paid_amount": 250, "balance_due": 750, "payment_status": "partial"},
        # The same invoice_id raised for another order (older data): S1 keeps its own
        {"invoice_id": "I1", "sales_order_id": "SX", "paid_amount": 0, "balance_due": 5, "payment_status": "pending"},
        {"invoice_id": "I4", "sales_order_id": "S4", "paid_amount": 600, "balance_due": 0, "payment_status": "paid"},
        {"invoice_id": "I6", "sales_order_id": "S6", "paid_amount": 0, "balance_due": 700, "payment_status": "cancelled"},
    ])
    await database["transactions"].insert_many([
        # S1's advance: also listed as a payment on its invoice, so counted once
        {"transaction_id": "T1", "transaction_type": "CUSTOMER_PAYMENT", "reference_type": "SALES_ORDER",
         "reference_id": "S1", "amount": 250, "created_at": at(TODAY - timedelta(days=10))},
        # S2's advance: no invoice yet
        {"transaction_id": "T2", "transaction_type": "CUSTOMER_PAYMENT", "reference_type": "SALES_ORDER",
         "reference_id": "S2", "amount": 300, "created_at": at(TODAY - timedelta(days=1))},
        # Last month: not this month's takings
        {"transaction_id": "T3", "transaction_type": "CUSTOMER_PAYMENT", "reference_type": "SALES_ORDER",
         "reference_id": "S7", "amount": 400, "created_at": at(date(2026, 10, 1))},
    ])
    await database["payments"].insert_many([
        {"payment_id": "PAY1", "reference_type": "INVOICE", "reference_id": "I1", "amount": 250,
         "payment_date": at(TODAY - timedelta(days=9)), "transaction_id": "T1"},
        {"payment_id": "PAY2", "reference_type": "INVOICE", "reference_id": "I4", "amount": 600, "payment_date": at(TODAY)},
    ])
    return database


async def test_summary_counts_and_money(db):
    summary = await SalesOrderSummaryService(db).get_summary(today=TODAY)

    assert summary["counts"] == {
        "all": 7, "draft": 1, "created": 2, "lens_ordered": 1, "fitting": 0, "ready": 1,
        "delivered": 1, "cancelled": 1, "overdue": 2,
    }
    # S1 owes its invoice balance, S2 its total less the advance, S3 all of it; drafts and cancelled left out
    assert summary["to_collect"]["amount"] == 750 + 500 + 500
    assert summary["to_collect"]["orders"] == 3
    trend = summary["to_collect"]["trend"]
    assert len(trend) == 30 and trend[0] == 500 and trend[-1] == 1750  # S3 is older than the window

    # Late: S1 (4 days) and S3 (since 10 Aug); a ready order is waiting for the customer, not late
    assert summary["overdue"]["orders"] == 2
    assert summary["overdue"]["amount"] == 1500
    assert summary["overdue"]["oldest_days"] == (TODAY - date(2026, 8, 10)).days
    assert summary["overdue"]["trend"][-1] == 1500

    # This month: S1's advance once, S2's advance, S4's payment
    assert summary["collected"]["amount"] == 250 + 300 + 600
    assert summary["collected"]["payments"] == 3
    assert len(summary["collected"]["trend"]) == TODAY.day

    assert summary["due_soon"] == {"amount": 800, "orders": 1, "days": 7, "trend": [0, 0, 0, 800, 0, 0, 0]}


async def test_list_rows_carry_paid_and_balance(db):
    with patch("app.repositories.sales_order_repository.business_today", return_value=TODAY):
        page = await SalesOrderService(db).list_sales_orders(1, 20)
    rows = {o.order_id: (o.paid_amount, o.balance_due) for o in page.data}
    assert rows["S1"] == (250, 750)
    assert rows["S2"] == (300, 500)
    assert rows["S4"] == (600, 0)
    assert rows["S6"] == (0, 0)


async def ids(db, **filters) -> list:
    with patch("app.repositories.sales_order_repository.business_today", return_value=TODAY):
        page = await SalesOrderService(db).list_sales_orders(1, 20, **filters)
    return [o.order_id for o in page.data]


async def test_status_tabs_include_older_statuses(db):
    assert sorted(await ids(db, status="created")) == ["S2", "S3"]
    assert await ids(db, status="delivered") == ["S7"]
    assert await ids(db, status="ready") == ["S4"]


async def test_overdue_invoiced_and_created_filters(db):
    assert sorted(await ids(db, overdue=True)) == ["S1", "S3"]
    assert await ids(db, overdue=True, status="lens_ordered") == ["S1"]
    assert sorted(await ids(db, invoiced=True)) == ["S1", "S4", "S6"]
    assert sorted(await ids(db, invoiced=False)) == ["S2", "S3", "S5", "S7"]
    assert sorted(await ids(db, created_from=TODAY - timedelta(days=2), created_to=TODAY)) == ["S2", "S4", "S5", "S6"]


async def test_sorting(db):
    assert (await ids(db, sort_by="total_amount", sort_desc=False))[:2] == ["S7", "S3"]
    assert (await ids(db, sort_by="total_amount"))[0] == "S1"
    assert (await ids(db))[0] in {"S5", "S6"}  # newest first by default
    assert (await ids(db, sort_by="nonsense"))[0] in {"S5", "S6"}
