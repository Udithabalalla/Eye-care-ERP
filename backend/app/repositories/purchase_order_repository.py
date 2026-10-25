import re
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple, Dict
from datetime import datetime, timezone
from app.repositories.base import BaseRepository
from app.models.purchase_order import PurchaseOrderModel


class PurchaseOrderRepository(BaseRepository):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "purchase_orders")

    async def get_by_order_id(self, order_id: str) -> Optional[PurchaseOrderModel]:
        doc = await self.get_one({"id": order_id})
        if doc:
            return PurchaseOrderModel(**doc)
        return None

    async def list_purchase_orders(self, skip: int = 0, limit: int = 10, supplier_id: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None, matching_item_ids: Optional[List[str]] = None) -> Tuple[List[PurchaseOrderModel], int]:
        filter_query: dict = {}
        if search:
            # PO number, supplier or anything on the order
            pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
            filter_query["$or"] = [
                {"id": pattern},
                {"supplier_information.supplier_name": pattern},
                {"items.item_name": pattern},
                {"items.sku": pattern},
            ]
            if matching_item_ids:
                # Catalogue matches, so orders saved before lines carried names are found too
                filter_query["$or"].append({"items.product_id": {"$in": matching_item_ids}})
        if supplier_id:
            filter_query["supplier_id"] = supplier_id
        if status:
            # Comma-separated list, e.g. "Ordered,Partially Received"
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            filter_query["status"] = statuses[0] if len(statuses) == 1 else {"$in": statuses}

        docs, total = await self.get_many_with_count(filter_query, skip, limit, sort=[("created_at", -1)])
        orders = [PurchaseOrderModel(**d) for d in docs]
        return orders, total

    async def push_status_history(self, order_id: str, entry: dict) -> None:
        await self.collection.update_one(
            {"id": order_id},
            {"$push": {"status_history": entry}},
        )

    async def record_received_quantities(
        self,
        order_id: str,
        allowed_statuses: List[str],
        changes: Dict[int, Tuple[int, int]],
        status: str,
    ) -> bool:
        """Set ``items.<idx>.received_quantity`` old→new and the status in one guarded write.

        Matches only if the PO is still in ``allowed_statuses`` and every line still
        holds its old value, so a concurrent/duplicate receipt cannot book the same
        quantities twice. Returns False when nothing matched.
        """
        filter_query: dict = {"id": order_id, "status": {"$in": list(allowed_statuses)}}
        update: dict = {"status": status, "updated_at": datetime.now(timezone.utc)}
        for idx, (old, new) in changes.items():
            # Older POs have no received_quantity on their lines yet
            filter_query[f"items.{idx}.received_quantity"] = {"$in": [0, None]} if old == 0 else old
            update[f"items.{idx}.received_quantity"] = new
        result = await self.collection.update_one(filter_query, {"$set": update})
        return result.matched_count > 0

