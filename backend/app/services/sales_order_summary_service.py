"""
The figures above the Sales Orders table, from the real records, in one call.

  * counts     — orders under each status tab (older statuses fold into the tab that shows
                 them), plus the late ones under "Overdue"
  * to_collect — what customers still owe on their orders: the invoice's balance, or for an
                 order without an invoice yet its total less the advance. Drafts and
                 cancelled orders are left out, and so are orders handed over without an
                 invoice (older records, settled at the counter before invoices were kept).
  * overdue    — orders past the delivery date promised to the customer that aren't ready yet
  * collected  — money taken this month: invoice payments, plus advances on orders that
                 have no invoice yet (an invoiced order's advance is one of its payments)
  * due_soon   — orders promised in the next 7 days that aren't ready yet

Each figure carries a short series for its sparkline.
"""
from collections import defaultdict
from datetime import date, timedelta
from typing import Any, Dict, Iterable, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.sales_order_repository import IN_WORKSHOP, STATUS_TABS, shop_day_start
from app.services.dashboard_overview_service import _day
from app.utils.helpers import business_today

TREND_DAYS = 30
DUE_SOON_DAYS = 7
NOT_OWED = ("draft", "cancelled")
HANDED_OVER = ("delivered", "completed")


def _advance(order: dict) -> float:
    measurements = order.get("measurements")
    if not isinstance(measurements, dict):
        return 0.0
    try:
        amount = float(measurements.get("advance_payment") or 0)
    except (TypeError, ValueError):
        return 0.0
    return amount if amount > 0 else 0.0


def order_payment(order: dict, invoice: Optional[dict]) -> tuple[float, float]:
    """(paid, balance) for an order, as its drawer shows them: the invoice's figures once
    there is one, before that the advance taken against the order's total."""
    if order.get("status") == "cancelled":
        return 0.0, 0.0
    if invoice:
        return round(float(invoice.get("paid_amount") or 0), 2), round(max(float(invoice.get("balance_due") or 0), 0.0), 2)
    total = float(order.get("total_amount") or 0)
    paid = round(min(_advance(order), total), 2)
    return paid, round(max(total - paid, 0.0), 2)


async def invoices_for(db: AsyncIOMotorDatabase, orders: Iterable[dict]) -> Dict[str, dict]:
    """Each order's invoice, by order_id. Where an invoice_id repeats (older data), the
    invoice raised for that order wins."""
    orders = list(orders)
    invoice_ids = list({o["invoice_id"] for o in orders if o.get("invoice_id")})
    if not invoice_ids:
        return {}
    by_id: Dict[str, list] = defaultdict(list)
    async for invoice in db["invoices"].find(
        {"invoice_id": {"$in": invoice_ids}},
        {"invoice_id": 1, "sales_order_id": 1, "paid_amount": 1, "balance_due": 1, "payment_status": 1},
    ):
        by_id[invoice["invoice_id"]].append(invoice)
    found = {}
    for order in orders:
        candidates = by_id.get(order.get("invoice_id") or "", [])
        if candidates:
            found[order["order_id"]] = next(
                (i for i in candidates if i.get("sales_order_id") == order["order_id"]), candidates[0]
            )
    return found


class SalesOrderSummaryService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db

    async def get_summary(self, today: Optional[date] = None) -> Dict[str, Any]:
        today = today or business_today()
        window = [today - timedelta(days=n) for n in range(TREND_DAYS - 1, -1, -1)]
        ahead = [today + timedelta(days=n) for n in range(DUE_SOON_DAYS)]

        orders = [
            o async for o in self.db["sales_orders"].find(
                {},
                {"order_id": 1, "status": 1, "total_amount": 1, "invoice_id": 1, "created_at": 1,
                 "expected_delivery_date": 1, "measurements.advance_payment": 1},
            )
        ]
        invoices = await invoices_for(self.db, (o for o in orders if o.get("status") not in NOT_OWED))

        # ── Tabs ─────────────────────────────────────────────────────────────
        by_status: Dict[str, int] = defaultdict(int)
        for order in orders:
            by_status[order.get("status") or ""] += 1
        counts = {tab: sum(by_status[s] for s in statuses) for tab, statuses in STATUS_TABS.items()}
        counts["all"] = len(orders)

        # ── Owed, late and due soon ──────────────────────────────────────────
        owed_by_day: Dict[date, float] = defaultdict(float)
        owed_before = owed_total = 0.0
        owed_orders = 0
        late_by_day: Dict[date, float] = defaultdict(float)
        late_before = late_total = 0.0
        late_orders = oldest_late = 0
        due_by_day: Dict[date, float] = defaultdict(float)
        due_orders = 0
        for order in orders:
            status = order.get("status")
            total = float(order.get("total_amount") or 0)
            invoice = invoices.get(order["order_id"])
            if status not in NOT_OWED and (invoice or status not in HANDED_OVER):
                _, balance = order_payment(order, invoice)
                if balance > 0.005:
                    owed_total += balance
                    owed_orders += 1
                    created = _day(order.get("created_at"))
                    if created and created >= window[0]:
                        owed_by_day[created] += balance
                    else:
                        owed_before += balance
            if status not in IN_WORKSHOP:
                continue
            promised = _day(order.get("expected_delivery_date"))
            if not promised:
                continue
            if promised < today:
                late_total += total
                late_orders += 1
                oldest_late = max(oldest_late, (today - promised).days)
                if promised >= window[0]:
                    late_by_day[promised] += total
                else:
                    late_before += total
            elif promised <= ahead[-1]:
                due_by_day[promised] += total
                due_orders += 1

        def running(before: float, by_day: Dict[date, float], days: list) -> list:
            series, value = [], before
            for d in days:
                value += by_day.get(d, 0.0)
                series.append(round(value, 2))
            return series

        # ── Collected this month ─────────────────────────────────────────────
        month_start = today.replace(day=1)
        month = [month_start + timedelta(days=n) for n in range((today - month_start).days + 1)]
        collected_by_day: Dict[date, float] = defaultdict(float)
        payments = 0
        # An invoice lists an order's advance when it's raised, after the advance was taken
        since = shop_day_start(month_start)
        linked_transactions = set()
        async for payment in self.db["payments"].find(
            {"reference_type": "INVOICE", "payment_date": {"$gte": since}}, {"payment_date": 1, "amount": 1, "transaction_id": 1}
        ):
            if payment.get("transaction_id"):
                linked_transactions.add(payment["transaction_id"])
            paid_on = _day(payment.get("payment_date"))
            if paid_on and month_start <= paid_on <= today:
                collected_by_day[paid_on] += float(payment.get("amount") or 0)
                payments += 1
        async for txn in self.db["transactions"].find(
            {"transaction_type": "CUSTOMER_PAYMENT", "reference_type": "SALES_ORDER", "created_at": {"$gte": since}},
            {"created_at": 1, "amount": 1, "transaction_id": 1},
        ):
            # An advance listed on the order's invoice is already counted above
            if txn.get("transaction_id") and txn["transaction_id"] in linked_transactions:
                continue
            paid_on = _day(txn.get("created_at"))
            if paid_on and month_start <= paid_on <= today:
                collected_by_day[paid_on] += float(txn.get("amount") or 0)
                payments += 1

        counts["overdue"] = late_orders
        return {
            "counts": counts,
            "to_collect": {
                "amount": round(owed_total, 2),
                "orders": owed_orders,
                "trend": running(owed_before, owed_by_day, window),
            },
            "overdue": {
                "amount": round(late_total, 2),
                "orders": late_orders,
                "oldest_days": oldest_late,
                "trend": running(late_before, late_by_day, window),
            },
            "collected": {
                "amount": round(sum(collected_by_day.values()), 2),
                "payments": payments,
                "trend": [round(collected_by_day.get(d, 0.0), 2) for d in month],
            },
            "due_soon": {
                "amount": round(sum(due_by_day.values()), 2),
                "orders": due_orders,
                "days": DUE_SOON_DAYS,
                "trend": [round(due_by_day.get(d, 0.0), 2) for d in ahead],
            },
        }
