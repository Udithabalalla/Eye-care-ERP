import math
from typing import Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.goods_receipt_repository import GoodsReceiptRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.schemas.goods_receipt import GoodsReceiptCreate, GoodsReceiptUpdate, GoodsReceiptResponse
from app.schemas.responses import PaginatedResponse
from app.models.goods_receipt import GoodsReceiptModel
from app.core.exceptions import NotFoundException, BadRequestException


class GoodsReceiptService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = GoodsReceiptRepository(db)
        self.variant_repo = FrameVariantRepository(db)

    def _to_response(self, grn: GoodsReceiptModel) -> GoodsReceiptResponse:
        d = grn.dict()
        d["id"] = d.get("_id")
        return GoodsReceiptResponse(**d)

    async def list_receipts(
        self,
        page: int,
        page_size: int,
        supplier_id: Optional[str] = None,
        purchase_order_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> PaginatedResponse[GoodsReceiptResponse]:
        skip = (page - 1) * page_size
        grns, total = await self.repo.list_receipts(skip, page_size, supplier_id, purchase_order_id, search)
        return PaginatedResponse(
            data=[self._to_response(g) for g in grns],
            total=total, page=page, page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    async def create_receipt(
        self, data: GoodsReceiptCreate, created_by: Optional[str] = None
    ) -> GoodsReceiptResponse:
        grn_number = await self.repo.get_next_grn_number()
        receipt_date = data.receipt_date or datetime.now(timezone.utc)

        # Validate all variants exist
        for item in data.items:
            v = await self.variant_repo.get_by_variant_id(item.variant_id)
            if not v:
                raise NotFoundException(f"Variant {item.variant_id} not found")

        model = GoodsReceiptModel(
            grn_number=grn_number,
            purchase_order_id=data.purchase_order_id,
            supplier_id=data.supplier_id,
            receipt_date=receipt_date,
            items=data.items,
            status="complete",
            notes=data.notes,
            created_by=created_by,
        )
        created = await self.repo.create_receipt(model)
        return self._to_response(created)

    async def get_receipt(self, grn_number: str) -> GoodsReceiptResponse:
        grn = await self.repo.get_by_grn_number(grn_number)
        if not grn:
            raise NotFoundException(f"GRN {grn_number} not found")
        return self._to_response(grn)

    async def update_receipt(self, grn_number: str, data: GoodsReceiptUpdate) -> GoodsReceiptResponse:
        grn = await self.repo.get_by_grn_number(grn_number)
        if not grn:
            raise NotFoundException(f"GRN {grn_number} not found")
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update_receipt(grn_number, update_dict)
        return await self.get_receipt(grn_number)

    async def commit_receipt(self, grn_number: str, committed_by: Optional[str] = None) -> GoodsReceiptResponse:
        """Apply stock increments atomically for each received item."""
        grn = await self.repo.get_by_grn_number(grn_number)
        if not grn:
            raise NotFoundException(f"GRN {grn_number} not found")

        for item in grn.items:
            net_qty = item.received_qty - item.damaged_qty
            if net_qty > 0:
                result = await self.variant_repo.increment_stock_atomic(item.variant_id, net_qty)
                if not result:
                    raise BadRequestException(f"Failed to update stock for variant {item.variant_id}")

        # Determine partial vs complete
        has_missing = any(item.missing_qty > 0 or item.received_qty < item.expected_qty for item in grn.items if item.expected_qty > 0)
        status = "partial" if has_missing else "complete"
        await self.repo.update_receipt(grn_number, {"status": status})
        return await self.get_receipt(grn_number)
