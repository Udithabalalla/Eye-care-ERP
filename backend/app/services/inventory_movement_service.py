from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple, Dict
from datetime import datetime, timezone
import math

from app.repositories.inventory_movement_repository import InventoryMovementRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.schemas.inventory_movement import InventoryMovementCreate, InventoryMovementResponse
from app.schemas.responses import PaginatedResponse
from app.utils.constants import InventoryMovementType, LedgerReferenceType
from app.utils.helpers import generate_id
from app.core.exceptions import BadRequestException, NotFoundException


class InventoryMovementService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = InventoryMovementRepository(db)
        self.product_repo = ProductRepository(db)
        self.frame_variant_repo = FrameVariantRepository(db)

    async def create_movement(self, data: InventoryMovementCreate, created_by: str, apply_stock_change: bool = True) -> InventoryMovementResponse:
        product = await self.product_repo.get_by_product_id(data.product_id)
        variant = None
        if not product:
            variant = await self.frame_variant_repo.get_by_variant_id(data.product_id)
            if not variant:
                raise NotFoundException(f"Product with ID {data.product_id} not found")

        if apply_stock_change:
            if data.movement_type == InventoryMovementType.SALE_OUT:
                ok = (
                    await self.product_repo.decrement_stock_atomic(data.product_id, abs(data.quantity))
                    if product
                    else await self.frame_variant_repo.decrement_stock_atomic(data.product_id, abs(data.quantity))
                )
                if not ok:
                    raise BadRequestException("Insufficient stock for sale movement")
            elif data.movement_type in (InventoryMovementType.PURCHASE_IN, InventoryMovementType.RETURN):
                ok = (
                    await self.product_repo.increment_stock_atomic(data.product_id, abs(data.quantity))
                    if product
                    else await self.frame_variant_repo.increment_stock_atomic(data.product_id, abs(data.quantity))
                )
                if not ok:
                    raise BadRequestException("Failed to increase stock for purchase/return movement")
            elif data.movement_type == InventoryMovementType.ADJUSTMENT:
                current_stock = product.current_stock if product else variant.current_stock
                updated_stock = current_stock + data.quantity
                if updated_stock < 0:
                    raise BadRequestException("Stock cannot be negative")
                if product:
                    await self.product_repo.update_stock(data.product_id, updated_stock)
                else:
                    await self.frame_variant_repo.set_stock_atomic(data.product_id, updated_stock)

        next_number = await self.repo.count({}) + 1
        movement_id = generate_id("MOV", next_number)
        payload = {
            "movement_id": movement_id,
            **data.dict(),
            "created_by": created_by,
            "created_at": datetime.now(timezone.utc),
        }
        await self.repo.create(payload)
        created = await self.repo.get_by_movement_id(movement_id)
        return InventoryMovementResponse(**created.dict())

    async def apply_stock_in(
        self,
        lines: List[Tuple[str, int]],
        reference_type: LedgerReferenceType,
        reference_id: str,
        created_by: str,
        reason: Optional[str] = None,
    ) -> None:
        """Book PURCHASE_IN movements (stock + movement row) for ``(product_or_variant_id, qty)`` lines.

        If one line fails, the lines already applied are reversed with ADJUSTMENT
        movements so stock is not left half-received, then the error is re-raised.
        """
        applied: List[Tuple[str, int]] = []
        try:
            for item_id, qty in lines:
                if qty <= 0:
                    continue
                await self.create_movement(
                    InventoryMovementCreate(
                        product_id=item_id,
                        movement_type=InventoryMovementType.PURCHASE_IN,
                        quantity=qty,
                        reference_type=reference_type,
                        reference_id=reference_id,
                        reason=reason,
                    ),
                    created_by,
                    apply_stock_change=True,
                )
                applied.append((item_id, qty))
        except Exception:
            for item_id, qty in reversed(applied):
                try:
                    await self.create_movement(
                        InventoryMovementCreate(
                            product_id=item_id,
                            movement_type=InventoryMovementType.ADJUSTMENT,
                            quantity=-qty,
                            reference_type=reference_type,
                            reference_id=reference_id,
                            reason="Reversal: receipt could not be completed",
                        ),
                        created_by,
                        apply_stock_change=True,
                    )
                except Exception:
                    pass
            raise

    async def _resolve_items(self, item_ids: List[str]) -> Dict[str, dict]:
        """Map product/variant id → {item_kind, item_name, sku} with one query per collection."""
        resolved: Dict[str, dict] = {}
        for product in await self.product_repo.get_many_by_product_ids(item_ids):
            resolved[product.product_id] = {"item_kind": "product", "item_name": product.name, "sku": product.sku}
        remaining = [i for i in set(item_ids) if i and i not in resolved]
        for v in await self.frame_variant_repo.get_many_by_variant_ids(remaining):
            ref = v.frame_master_ref
            resolved[v.variant_id] = {
                "item_kind": "frame",
                "item_name": f"{ref.brand} {ref.model_code} / {v.color} / {v.eye_size}",
                "sku": v.sku,
            }
        return resolved

    async def list_movements(
        self,
        page: int,
        page_size: int,
        product_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        movement_type: Optional[str] = None,
        reference_id: Optional[str] = None,
    ):
        skip = (page - 1) * page_size
        movements, total = await self.repo.list_movements(
            skip=skip, limit=page_size, product_id=product_id, reference_type=reference_type,
            reference_id=reference_id, movement_type=movement_type,
        )
        lookup = await self._resolve_items([m.product_id or m.variant_id for m in movements])
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[
                InventoryMovementResponse(**item.dict(), **lookup.get(item.product_id or item.variant_id, {}))
                for item in movements
            ],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )