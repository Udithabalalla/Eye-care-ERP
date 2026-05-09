from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import datetime, timezone
import math

from app.repositories.inventory_movement_repository import InventoryMovementRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.inventory_movement import InventoryMovementCreate, InventoryMovementResponse
from app.schemas.responses import PaginatedResponse
from app.utils.constants import InventoryMovementType
from app.utils.helpers import generate_id
from app.core.exceptions import BadRequestException, NotFoundException


class InventoryMovementService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = InventoryMovementRepository(db)
        self.product_repo = ProductRepository(db)

    async def create_movement(self, data: InventoryMovementCreate, created_by: str, apply_stock_change: bool = True) -> InventoryMovementResponse:
        product = await self.product_repo.get_by_product_id(data.product_id)
        if not product:
            raise NotFoundException(f"Product with ID {data.product_id} not found")

        if apply_stock_change:
            if data.movement_type == InventoryMovementType.SALE_OUT:
                ok = await self.product_repo.decrement_stock_atomic(data.product_id, abs(data.quantity))
                if not ok:
                    raise BadRequestException("Insufficient stock for sale movement")
            elif data.movement_type == InventoryMovementType.PURCHASE_IN:
                ok = await self.product_repo.increment_stock_atomic(data.product_id, abs(data.quantity))
                if not ok:
                    raise BadRequestException("Failed to increase stock for purchase movement")
            elif data.movement_type == InventoryMovementType.ADJUSTMENT:
                updated_stock = product.current_stock + data.quantity
                if updated_stock < 0:
                    raise BadRequestException("Stock cannot be negative")
                await self.product_repo.update_stock(data.product_id, updated_stock)

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

    async def list_movements(self, page: int, page_size: int, product_id: Optional[str] = None, reference_type: Optional[str] = None):
        skip = (page - 1) * page_size
        movements, total = await self.repo.list_movements(skip=skip, limit=page_size, product_id=product_id, reference_type=reference_type)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[InventoryMovementResponse(**item.dict()) for item in movements],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )