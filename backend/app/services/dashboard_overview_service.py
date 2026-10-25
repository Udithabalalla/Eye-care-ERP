"""
Everything the dashboard shows, from real records, in one call.

Money:
  * sales      — invoiced amount (not cancelled), by invoice date
  * collected  — money in from patients: invoice payments by payment date, plus
                 advances taken on sales orders (customer-payment transactions)
  * to collect — balances still open on patient invoices
  * owed       — supplier invoices less what's been paid on them
Work:
  * orders by workshop stage, glasses waiting to be collected, today's appointments
Stock & buying:
  * low / out of stock, purchase orders awaiting delivery or their invoice
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.supplier_payment_repository import SupplierPaymentRepository
from app.services.inventory_service import InventoryService

# Workshop stages in order; older statuses fold into the nearest one
STAGES = [
    ("new", ("created", "confirmed")),
    ("lens_ordered", ("lens_ordered",)),
    ("fitting", ("fitting", "in_production")),
    ("ready", ("ready",)),
]
MIX_LABELS = {"frame": "Frames", "lens": "Lenses", "product": "Products", "expense": "Services"}
CLOSED_ORDER = ("draft", "cancelled")
OPEN_INVOICE = ("pending", "partial", "overdue")


def _utc(value) -> Optional[datetime]:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, date):
        return datetime.combine(value, time.min, tzinfo=timezone.utc)
    return None


def _day(value) -> Optional[date]:
    moment = _utc(value)
    return moment.date() if moment else None


def _start(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=timezone.utc)


class DashboardOverviewService:
    DAYS = 30

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_overview(self, today: Optional[date] = None) -> Dict[str, Any]:
        today = today or datetime.now(timezone.utc).date()
        days = [today - timedelta(days=n) for n in range(self.DAYS - 1, -1, -1)]
        month_start = today.replace(day=1)
        last_month_end = month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        # The same stretch of last month, for a fair month-to-date comparison
        last_month_same = min(last_month_start + timedelta(days=today.day - 1), last_month_end)
        window = _start(min(days[0], last_month_start))

        # ── Money in ─────────────────────────────────────────────────────────
        sales: dict[date, float] = defaultdict(float)
        invoices_on: dict[date, int] = defaultdict(int)
        async for inv in self.db.invoices.find(
            {"invoice_date": {"$gte": window}, "payment_status": {"$ne": "cancelled"}},
            {"invoice_date": 1, "total_amount": 1},
        ):
            d = _day(inv.get("invoice_date"))
            if d:
                sales[d] += float(inv.get("total_amount") or 0)
                invoices_on[d] += 1

        collected: dict[date, float] = defaultdict(float)
        async for pay in self.db.payments.find(
            {"reference_type": "INVOICE", "payment_date": {"$gte": window}}, {"payment_date": 1, "amount": 1}
        ):
            d = _day(pay.get("payment_date"))
            if d:
                collected[d] += float(pay.get("amount") or 0)
        async for txn in self.db.transactions.find(
            {"transaction_type": "CUSTOMER_PAYMENT", "reference_type": "SALES_ORDER", "created_at": {"$gte": window}},
            {"created_at": 1, "amount": 1},
        ):
            d = _day(txn.get("created_at"))
            if d:
                collected[d] += float(txn.get("amount") or 0)

        def total(series: dict, start: date, end: date) -> float:
            return round(sum(v for d, v in series.items() if start <= d <= end), 2)

        # ── Money owed to us ─────────────────────────────────────────────────
        receivables = {"total": 0.0, "count": 0, "overdue_total": 0.0, "overdue_count": 0}
        async for inv in self.db.invoices.find(
            {"payment_status": {"$in": list(OPEN_INVOICE)}, "balance_due": {"$gt": 0}},
            {"balance_due": 1, "due_date": 1, "payment_status": 1},
        ):
            balance = float(inv.get("balance_due") or 0)
            receivables["total"] += balance
            receivables["count"] += 1
            due = _day(inv.get("due_date"))
            if inv.get("payment_status") == "overdue" or (due and due < today):
                receivables["overdue_total"] += balance
                receivables["overdue_count"] += 1

        # ── Money we owe suppliers ───────────────────────────────────────────
        bills = [b async for b in self.db.supplier_invoices.find({"status": {"$ne": "Paid"}}, {"id": 1, "total_amount": 1, "due_date": 1})]
        paid_on = await SupplierPaymentRepository(self.db).sum_paid_by_invoice([b["id"] for b in bills if b.get("id")])
        payables = {"total": 0.0, "count": 0, "overdue_total": 0.0, "overdue_count": 0, "due_this_week": 0.0}
        for bill in bills:
            owed = max(0.0, float(bill.get("total_amount") or 0) - paid_on.get(bill.get("id"), 0.0))
            if owed <= 0:
                continue
            payables["total"] += owed
            payables["count"] += 1
            due = _day(bill.get("due_date"))
            if due and due < today:
                payables["overdue_total"] += owed
                payables["overdue_count"] += 1
            elif due and due <= today + timedelta(days=7):
                payables["due_this_week"] += owed

        # ── Workshop ─────────────────────────────────────────────────────────
        status_counts: dict[str, int] = defaultdict(int)
        async for row in self.db.sales_orders.aggregate([{"$group": {"_id": "$status", "n": {"$sum": 1}}}]):
            status_counts[str(row["_id"])] = row["n"]
        pipeline = [{"stage": key, "count": sum(status_counts.get(s, 0) for s in statuses)} for key, statuses in STAGES]

        ready_orders = [
            o async for o in self.db.sales_orders.find(
                {"status": "ready"}, {"order_id": 1, "order_number": 1, "patient_id": 1, "invoice_id": 1, "total_amount": 1, "updated_at": 1},
            ).sort("updated_at", 1).limit(6)
        ]
        patients = {
            p["patient_id"]: p async for p in self.db.patients.find(
                {"patient_id": {"$in": [o.get("patient_id") for o in ready_orders]}}, {"patient_id": 1, "name": 1, "phone": 1}
            )
        }
        balances = {
            i["invoice_id"]: float(i.get("balance_due") or 0) async for i in self.db.invoices.find(
                {"invoice_id": {"$in": [o.get("invoice_id") for o in ready_orders if o.get("invoice_id")]}}, {"invoice_id": 1, "balance_due": 1}
            )
        }
        ready = []
        for order in ready_orders:
            patient = patients.get(order.get("patient_id"), {})
            waiting_since = _day(order.get("updated_at"))
            ready.append({
                "order_id": order.get("order_id"),
                "order_number": order.get("order_number"),
                "patient_id": order.get("patient_id"),
                "patient_name": patient.get("name"),
                "phone": patient.get("phone"),
                "balance_due": round(balances.get(order.get("invoice_id"), 0.0), 2),
                "waiting_days": (today - waiting_since).days if waiting_since else None,
            })

        appointments = []
        async for appt in self.db.appointments.find(
            {"appointment_date": {"$gte": _start(today), "$lt": _start(today + timedelta(days=1))}},
        ).sort("appointment_time", 1):
            when = _utc(appt.get("appointment_time"))
            appointments.append({
                "appointment_id": appt.get("appointment_id"),
                "patient_id": appt.get("patient_id"),
                "patient_name": appt.get("patient_name"),
                "doctor_name": appt.get("doctor_name"),
                "time": when.strftime("%H:%M") if when else None,
                "type": appt.get("type"),
                "status": appt.get("status"),
            })

        # ── What sold this month ─────────────────────────────────────────────
        mix: dict[str, dict] = {key: {"amount": 0.0, "count": 0} for key in MIX_LABELS}
        top: dict[tuple, dict] = {}
        async for order in self.db.sales_orders.find(
            {"created_at": {"$gte": _start(month_start)}, "status": {"$nin": list(CLOSED_ORDER)}}, {"items": 1}
        ):
            for item in order.get("items") or []:
                kind = item.get("line_type") or "product"
                if kind not in MIX_LABELS:
                    continue  # free items carry no sales value
                amount = float(item.get("total") or 0)
                qty = int(item.get("quantity") or 0)
                mix[kind]["amount"] += amount
                mix[kind]["count"] += qty
                key = (kind, item.get("product_name") or item.get("sku") or item.get("product_id"))
                entry = top.setdefault(key, {"name": key[1], "kind": kind, "quantity": 0, "amount": 0.0})
                entry["quantity"] += qty
                entry["amount"] += amount

        # ── Stock & buying ───────────────────────────────────────────────────
        low = await InventoryService(self.db).list_low_stock()
        low_sorted = sorted(low, key=lambda i: (not i.out_of_stock, i.current_stock - i.reorder_level))
        awaiting_delivery = await self.db.purchase_orders.count_documents({"status": {"$in": ["Ordered", "Partially Received"]}})
        invoiced_orders = {i.get("purchase_order_id") async for i in self.db.supplier_invoices.find({"purchase_order_id": {"$ne": None}}, {"purchase_order_id": 1})}
        received = [o["id"] async for o in self.db.purchase_orders.find({"status": "Received"}, {"id": 1})]
        awaiting_invoice = len([oid for oid in received if oid not in invoiced_orders])

        new_patients = await self.db.patients.count_documents({"is_active": True, "created_at": {"$gte": _start(month_start)}})
        total_patients = await self.db.patients.count_documents({"is_active": True})

        round2 = lambda d: {k: round(v, 2) if isinstance(v, float) else v for k, v in d.items()}
        return {
            "date": today.isoformat(),
            "sales": {
                "today": round(sales.get(today, 0.0), 2),
                "yesterday": round(sales.get(today - timedelta(days=1), 0.0), 2),
                "invoices_today": invoices_on.get(today, 0),
                "month": total(sales, month_start, today),
                "last_month_same_period": total(sales, last_month_start, last_month_same),
            },
            "collected": {
                "today": round(collected.get(today, 0.0), 2),
                "month": total(collected, month_start, today),
            },
            "daily": [
                {"date": d.isoformat(), "sales": round(sales.get(d, 0.0), 2), "collected": round(collected.get(d, 0.0), 2), "invoices": invoices_on.get(d, 0)}
                for d in days
            ],
            "receivables": round2(receivables),
            "payables": round2(payables),
            "pipeline": pipeline,
            "ready_for_collection": ready,
            "ready_count": status_counts.get("ready", 0),
            "appointments_today": appointments,
            "sales_mix": [
                {"kind": kind, "label": MIX_LABELS[kind], "amount": round(v["amount"], 2), "count": v["count"]}
                for kind, v in mix.items()
            ],
            "top_items": [
                {**entry, "amount": round(entry["amount"], 2)}
                for entry in sorted(top.values(), key=lambda e: e["amount"], reverse=True)[:5]
            ],
            "stock": {
                "low": len([i for i in low if not i.out_of_stock]),
                "out": len([i for i in low if i.out_of_stock]),
                "items": [
                    {"kind": i.kind, "id": i.id, "name": i.name, "detail": i.detail, "current_stock": i.current_stock,
                     "reorder_level": i.reorder_level, "out_of_stock": i.out_of_stock}
                    for i in low_sorted[:5]
                ],
            },
            "purchasing": {"awaiting_delivery": awaiting_delivery, "awaiting_invoice": awaiting_invoice},
            "patients": {"total": total_patients, "new_this_month": new_patients},
        }
