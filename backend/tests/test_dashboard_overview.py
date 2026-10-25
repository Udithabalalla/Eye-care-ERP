"""The dashboard overview adds up the real records (mongomock-motor)."""
import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("SECRET_KEY", "test-secret")

from datetime import date, datetime, timedelta, timezone

import pytest
from mongomock_motor import AsyncMongoMockClient

from app.services.dashboard_overview_service import DashboardOverviewService

TODAY = date(2026, 10, 25)


def at(d: date, hour: int = 10) -> datetime:
    return datetime(d.year, d.month, d.day, hour, tzinfo=timezone.utc)


@pytest.fixture
async def db():
    database = AsyncMongoMockClient()["test_dashboard"]
    yesterday, last_month = TODAY - timedelta(days=1), date(2026, 9, 10)
    await database["invoices"].insert_many([
        {"invoice_id": "I1", "invoice_date": at(TODAY), "total_amount": 1000, "balance_due": 400, "payment_status": "partial",
         "due_date": at(TODAY + timedelta(days=5))},
        {"invoice_id": "I2", "invoice_date": at(yesterday), "total_amount": 500, "balance_due": 500, "payment_status": "overdue",
         "due_date": at(yesterday)},
        {"invoice_id": "I3", "invoice_date": at(last_month), "total_amount": 800, "balance_due": 0, "payment_status": "paid"},
        {"invoice_id": "I4", "invoice_date": at(TODAY), "total_amount": 9999, "balance_due": 0, "payment_status": "cancelled"},
    ])
    await database["payments"].insert_one({"reference_type": "INVOICE", "reference_id": "I1", "amount": 600, "payment_date": at(TODAY)})
    await database["transactions"].insert_one(
        {"transaction_type": "CUSTOMER_PAYMENT", "reference_type": "SALES_ORDER", "amount": 250, "created_at": at(yesterday)}
    )
    await database["patients"].insert_many([
        {"patient_id": "P1", "name": "Nimali", "phone": "0771", "is_active": True, "created_at": at(TODAY)},
        {"patient_id": "P2", "name": "Kamal", "phone": "0772", "is_active": True, "created_at": at(last_month)},
    ])
    await database["sales_orders"].insert_many([
        {"order_id": "S1", "order_number": "SO-1", "patient_id": "P1", "status": "ready", "invoice_id": "I1",
         "created_at": at(TODAY), "updated_at": at(TODAY - timedelta(days=3)),
         "items": [
             {"product_id": "F1", "product_name": "Boss 1602", "line_type": "frame", "quantity": 1, "total": 6000},
             {"product_id": "L1", "product_name": "Single Vision", "line_type": "lens", "quantity": 1, "total": 2000},
             {"product_id": "C1", "product_name": "Cloth", "line_type": "complimentary", "quantity": 1, "total": 0},
         ]},
        {"order_id": "S2", "order_number": "SO-2", "patient_id": "P2", "status": "lens_ordered", "created_at": at(TODAY),
         "items": [{"product_id": "F1", "product_name": "Boss 1602", "line_type": "frame", "quantity": 2, "total": 12000}]},
        {"order_id": "S3", "order_number": "SO-3", "patient_id": "P2", "status": "draft", "created_at": at(TODAY),
         "items": [{"product_id": "X", "product_name": "Draft only", "line_type": "product", "quantity": 1, "total": 999}]},
    ])
    await database["supplier_invoices"].insert_many([
        {"id": "SI1", "status": "Partial", "total_amount": 3000, "due_date": at(TODAY - timedelta(days=2)), "purchase_order_id": "PO1"},
        {"id": "SI2", "status": "Unpaid", "total_amount": 1000, "due_date": at(TODAY + timedelta(days=3))},
    ])
    await database["supplier_payments"].insert_one({"id": "SP1", "invoice_id": "SI1", "amount_paid": 1000})
    await database["purchase_orders"].insert_many([
        {"id": "PO1", "status": "Received"},
        {"id": "PO2", "status": "Received"},
        {"id": "PO3", "status": "Ordered"},
    ])
    await database["appointments"].insert_one({
        "appointment_id": "A1", "patient_id": "P1", "patient_name": "Nimali", "doctor_name": "Silva",
        "appointment_date": at(TODAY, 0), "appointment_time": at(TODAY, 9), "type": "consultation", "status": "scheduled",
    })
    return database


async def test_overview_adds_up_money_work_and_stock(db):
    o = await DashboardOverviewService(db).get_overview(today=TODAY)

    assert o["sales"] == {"today": 1000, "yesterday": 500, "invoices_today": 1, "month": 1500, "last_month_same_period": 800}
    assert o["collected"] == {"today": 600, "month": 850}
    assert len(o["daily"]) == 30 and o["daily"][-1] == {"date": "2026-10-25", "sales": 1000, "collected": 600, "invoices": 1}

    assert o["receivables"] == {"total": 900, "count": 2, "overdue_total": 500, "overdue_count": 1}
    assert o["payables"] == {"total": 3000, "count": 2, "overdue_total": 2000, "overdue_count": 1, "due_this_week": 1000}

    assert {p["stage"]: p["count"] for p in o["pipeline"]} == {"new": 0, "lens_ordered": 1, "fitting": 0, "ready": 1}
    (ready,) = o["ready_for_collection"]
    assert (ready["patient_name"], ready["balance_due"], ready["waiting_days"]) == ("Nimali", 400, 3)
    assert o["appointments_today"][0]["time"] == "09:00"

    mix = {m["kind"]: m["amount"] for m in o["sales_mix"]}
    assert mix == {"frame": 18000, "lens": 2000, "product": 0, "expense": 0}  # free items and drafts left out
    assert o["top_items"][0] == {"name": "Boss 1602", "kind": "frame", "quantity": 3, "amount": 18000}

    assert o["purchasing"] == {"awaiting_delivery": 1, "awaiting_invoice": 1}
    assert o["patients"] == {"total": 2, "new_this_month": 1}
