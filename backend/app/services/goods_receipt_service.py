import math
from typing import Optional, List, Dict
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.goods_receipt_repository import GoodsReceiptRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.schemas.goods_receipt import GoodsReceiptCreate, GoodsReceiptUpdate, GoodsReceiptResponse, GoodsReceiptPrefill
from app.schemas.responses import PaginatedResponse
from app.models.goods_receipt import GoodsReceiptModel, GoodsReceiptItem
from app.core.exceptions import NotFoundException, BadRequestException
from app.services.inventory_movement_service import InventoryMovementService
from app.services.purchase_order_service import PurchaseOrderService
from app.utils.constants import GoodsReceiptStatus, LedgerReferenceType


class GoodsReceiptService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = GoodsReceiptRepository(db)
        self.variant_repo = FrameVariantRepository(db)
        self.po_repo = PurchaseOrderRepository(db)
        self.po_service = PurchaseOrderService(db)
        self.inventory_service = InventoryMovementService(db)

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

    @staticmethod
    def _accepted_qty(item: GoodsReceiptItem) -> int:
        """Units that go into stock: received minus damaged."""
        return max(item.received_qty - item.damaged_qty, 0)

    def _accepted_by_variant(self, items: List[GoodsReceiptItem]) -> Dict[str, int]:
        totals: Dict[str, int] = {}
        for item in items:
            totals[item.variant_id] = totals.get(item.variant_id, 0) + self._accepted_qty(item)
        return totals

    async def _validate_items(self, items: List[GoodsReceiptItem]) -> None:
        for item in items:
            if item.damaged_qty > item.received_qty:
                raise BadRequestException(f"{item.sku or item.variant_id}: damaged quantity cannot exceed received quantity")
            v = await self.variant_repo.get_by_variant_id(item.variant_id)
            if not v:
                raise NotFoundException(f"Variant {item.variant_id} not found")

    async def _validate_against_po(self, purchase_order_id: str, supplier_id: str, items: List[GoodsReceiptItem]) -> None:
        """Early feedback for a PO-linked GRN; commit re-checks through PurchaseOrderService.apply_receipt."""
        order = await self.po_repo.get_by_order_id(purchase_order_id)
        if not order:
            raise NotFoundException(f"Purchase order {purchase_order_id} not found")
        if order.supplier_id != supplier_id:
            raise BadRequestException(f"Purchase order {purchase_order_id} belongs to supplier {order.supplier_id}, not {supplier_id}")
        receivable = [st.value for st in PurchaseOrderService.RECEIVABLE_STATUSES]
        if order.status not in receivable:
            raise BadRequestException(f"Purchase order {purchase_order_id} is '{order.status}' and cannot be received against")
        lines = {line.product_id: line for line in order.items}
        for variant_id, qty in self._accepted_by_variant(items).items():
            line = lines.get(variant_id)
            if not line:
                raise BadRequestException(f"Variant {variant_id} is not on purchase order {purchase_order_id}")
            outstanding = max(line.quantity - line.received_quantity, 0)
            if qty > outstanding:
                raise BadRequestException(
                    f"Variant {variant_id}: {qty} accepted but only {outstanding} outstanding on {purchase_order_id}"
                )

    async def create_receipt(
        self, data: GoodsReceiptCreate, created_by: Optional[str] = None
    ) -> GoodsReceiptResponse:
        """Save a GRN as pending; stock moves only when it is committed."""
        await self._validate_items(data.items)
        if data.purchase_order_id:
            await self._validate_against_po(data.purchase_order_id, data.supplier_id, data.items)

        grn_number = await self.repo.get_next_grn_number()
        receipt_date = data.receipt_date or datetime.now(timezone.utc)
        model = GoodsReceiptModel(
            grn_number=grn_number,
            purchase_order_id=data.purchase_order_id,
            supplier_id=data.supplier_id,
            receipt_date=receipt_date,
            items=data.items,
            status=GoodsReceiptStatus.PENDING.value,
            notes=data.notes,
            created_by=created_by,
        )
        created = await self.repo.create_receipt(model)
        return self._to_response(created)

    async def prefill_from_po(self, purchase_order_id: str) -> GoodsReceiptPrefill:
        """Outstanding frame lines of a PO (expected = still outstanding, received = 0 to be counted)."""
        order = await self.po_repo.get_by_order_id(purchase_order_id)
        if not order:
            raise NotFoundException(f"Purchase order {purchase_order_id} not found")
        variants = {
            v.variant_id: v
            for v in await self.variant_repo.get_many_by_variant_ids(
                [line.frame_variant_id for line in order.items if line.frame_variant_id]
            )
        }
        items: List[GoodsReceiptItem] = []
        for line in order.items:
            outstanding = line.quantity - line.received_quantity
            if not line.frame_variant_id or outstanding <= 0:
                continue
            v = variants.get(line.frame_variant_id)
            label = (
                f"{v.frame_master_ref.brand} {v.frame_master_ref.model_code} / {v.color} / {v.eye_size}" if v else ""
            )
            items.append(GoodsReceiptItem(
                variant_id=line.frame_variant_id,
                sku=v.sku if v else line.frame_variant_id,
                variant_label=label,
                expected_qty=outstanding,
                received_qty=0,
                cost_price=line.unit_cost,
            ))
        return GoodsReceiptPrefill(supplier_id=order.supplier_id, purchase_order_id=order.id, items=items)

    async def get_receipt(self, grn_number: str) -> GoodsReceiptResponse:
        grn = await self.repo.get_by_grn_number(grn_number)
        if not grn:
            raise NotFoundException(f"GRN {grn_number} not found")
        return self._to_response(grn)

    async def update_receipt(self, grn_number: str, data: GoodsReceiptUpdate) -> GoodsReceiptResponse:
        grn = await self.repo.get_by_grn_number(grn_number)
        if not grn:
            raise NotFoundException(f"GRN {grn_number} not found")
        if grn.status != GoodsReceiptStatus.PENDING.value:
            raise BadRequestException(f"GRN {grn_number} is already committed and cannot be edited")
        if data.items is not None:
            await self._validate_items(data.items)
            if grn.purchase_order_id:
                await self._validate_against_po(grn.purchase_order_id, grn.supplier_id, data.items)
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update_receipt(grn_number, update_dict)
        return await self.get_receipt(grn_number)

    async def commit_receipt(self, grn_number: str, committed_by: Optional[str] = None) -> GoodsReceiptResponse:
        """Apply stock for a pending GRN exactly once.

        Accepted units (received minus damaged) go into stock with GOODS_RECEIPT
        movements. A GRN linked to a purchase order is booked through
        PurchaseOrderService.apply_receipt, so the PO received quantities and
        status move with it and the same units cannot also be received on the PO.
        """
        grn = await self.repo.get_by_grn_number(grn_number)
        if not grn:
            raise NotFoundException(f"GRN {grn_number} not found")
        if grn.status != GoodsReceiptStatus.PENDING.value or not await self.repo.claim_for_commit(grn_number):
            raise BadRequestException(f"GRN {grn_number} has already been committed")

        user = committed_by or "system"
        lines = [(vid, qty) for vid, qty in self._accepted_by_variant(grn.items).items() if qty > 0]
        try:
            for variant_id, _ in lines:
                v = await self.variant_repo.get_by_variant_id(variant_id)
                if not v or not v.is_active:
                    raise BadRequestException(f"Variant {variant_id} no longer exists or is inactive")
            if grn.purchase_order_id:
                if lines:
                    await self.po_service.apply_receipt(
                        grn.purchase_order_id, lines, user,
                        reference_type=LedgerReferenceType.GOODS_RECEIPT, reference_id=grn_number,
                    )
            else:
                await self.inventory_service.apply_stock_in(lines, LedgerReferenceType.GOODS_RECEIPT, grn_number, user)
        except Exception:
            await self.repo.update_receipt(grn_number, {"status": GoodsReceiptStatus.PENDING.value})
            raise

        # Determine partial vs complete
        has_missing = any(item.missing_qty > 0 or item.received_qty < item.expected_qty for item in grn.items if item.expected_qty > 0)
        status = GoodsReceiptStatus.PARTIAL if has_missing else GoodsReceiptStatus.COMPLETE
        await self.repo.update_receipt(grn_number, {
            "status": status.value,
            "committed_at": datetime.now(timezone.utc),
            "committed_by": committed_by,
        })
        return await self.get_receipt(grn_number)
