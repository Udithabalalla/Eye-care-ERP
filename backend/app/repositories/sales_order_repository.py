import re
from datetime import date, datetime, time, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple

from app.repositories.base import BaseRepository
from app.models.sales_order import SalesOrderModel
from app.utils.helpers import business_today, business_tz

# The status tabs on the Sales Orders page. Older statuses are listed (and counted) under
# the tab whose label they show: "confirmed" reads "Order Created", "in_production"
# "Lens Ordered" and "completed" sits with "Delivered".
STATUS_TABS = {
    "draft": ("draft",),
    "created": ("created", "confirmed"),
    "lens_ordered": ("lens_ordered", "in_production"),
    "fitting": ("fitting",),
    "ready": ("ready",),
    "delivered": ("delivered", "completed"),
    "cancelled": ("cancelled",),
}
# Orders still being made in the workshop: late once their delivery date has passed
IN_WORKSHOP = ("created", "confirmed", "lens_ordered", "in_production", "fitting")
SORTABLE = {"order_number", "created_at", "expected_delivery_date", "total_amount", "status"}


def shop_day_start(day: date) -> datetime:
    """Midnight at the shop on `day`, in UTC (how the database stores times)"""
    return datetime.combine(day, time.min, tzinfo=business_tz()).astimezone(timezone.utc)


def statuses_for(status: Optional[str]) -> Optional[Tuple[str, ...]]:
    """The stored statuses listed under a status tab (or that one status, for any other value)"""
    if not status:
        return None
    return STATUS_TABS.get(status, (status,))


class SalesOrderRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "sales_orders")

    async def get_by_order_id(self, order_id: str) -> Optional[SalesOrderModel]:
        order = await self.get_one({"order_id": order_id})
        return SalesOrderModel(**order) if order else None

    async def get_by_order_number(self, order_number: str) -> Optional[SalesOrderModel]:
        order = await self.get_one({"order_number": order_number})
        return SalesOrderModel(**order) if order else None

    async def list_sales_orders(
        self,
        skip: int = 0,
        limit: int = 10,
        patient_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        overdue: bool = False,
        invoiced: Optional[bool] = None,
        created_from: Optional[date] = None,
        created_to: Optional[date] = None,
        sort_by: Optional[str] = None,
        sort_desc: bool = True,
    ) -> Tuple[List[SalesOrderModel], int]:
        query: dict = {}
        if patient_id:
            query["patient_id"] = patient_id
        statuses = statuses_for(status)
        if overdue:
            # Late: past the delivery date promised to the customer and not ready yet
            statuses = tuple(s for s in (statuses or IN_WORKSHOP) if s in IN_WORKSHOP)
            query["expected_delivery_date"] = {"$lt": shop_day_start(business_today())}
        if statuses is not None:
            query["status"] = statuses[0] if len(statuses) == 1 else {"$in": list(statuses)}
        if invoiced is True:
            query["invoice_id"] = {"$nin": [None, ""]}
        elif invoiced is False:
            query["invoice_id"] = {"$in": [None, ""]}
        if created_from or created_to:
            created: dict = {}
            if created_from:
                created["$gte"] = shop_day_start(created_from)
            if created_to:
                created["$lt"] = shop_day_start(created_to + timedelta(days=1))
            query["created_at"] = created
        if search and search.strip():
            # Orders don't store the patient's name, so match names and phones on patients first
            pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
            patients = self.db["patients"].find({"$or": [{"name": pattern}, {"phone": pattern}]}, {"patient_id": 1})
            patient_ids = [p["patient_id"] async for p in patients.limit(500)]
            query["$or"] = [{"order_number": pattern}, {"order_id": pattern}, {"patient_id": {"$in": patient_ids}}]
        field = sort_by if sort_by in SORTABLE else "created_at"
        direction = -1 if sort_desc else 1
        # Newest first among equal values, so a page never shuffles between requests
        sort = [(field, direction)] + ([("created_at", -1)] if field != "created_at" else [])
        orders = await self.get_many(filter=query, skip=skip, limit=limit, sort=sort)
        total = await self.count(query)
        return [SalesOrderModel(**order) for order in orders], total
