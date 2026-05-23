import math
from typing import Optional
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.quick_intake_repository import QuickIntakeRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.schemas.quick_intake import QuickIntakeCreate, QuickIntakeUpdate, QuickIntakeResponse
from app.schemas.responses import PaginatedResponse
from app.models.quick_intake import QuickIntakeModel
from app.core.exceptions import NotFoundException, BadRequestException


class QuickIntakeService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = QuickIntakeRepository(db)
        self.variant_repo = FrameVariantRepository(db)

    def _to_response(self, qi: QuickIntakeModel) -> QuickIntakeResponse:
        d = qi.dict()
        d["id"] = d.get("_id")
        total_qty = sum(item["qty"] for item in d.get("items", []))
        total_cost = sum(item["qty"] * item["cost_price"] for item in d.get("items", []))
        return QuickIntakeResponse(**d, total_qty=total_qty, total_cost=total_cost)

    async def list_intakes(
        self, page: int, page_size: int, status: Optional[str] = None, supplier_id: Optional[str] = None
    ) -> PaginatedResponse[QuickIntakeResponse]:
        skip = (page - 1) * page_size
        intakes, total = await self.repo.list_intakes(skip, page_size, status, supplier_id)
        return PaginatedResponse(
            data=[self._to_response(qi) for qi in intakes],
            total=total, page=page, page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    async def create_intake(
        self, data: QuickIntakeCreate, created_by: Optional[str] = None
    ) -> QuickIntakeResponse:
        intake_id = await self.repo.get_next_intake_number()
        intake_date = data.intake_date or datetime.now(timezone.utc)
        model = QuickIntakeModel(
            intake_id=intake_id,
            supplier_id=data.supplier_id,
            intake_date=intake_date,
            items=data.items,
            status="draft",
            notes=data.notes,
            created_by=created_by,
        )
        created = await self.repo.create_intake(model)
        return self._to_response(created)

    async def get_intake(self, intake_id: str) -> QuickIntakeResponse:
        qi = await self.repo.get_by_intake_id(intake_id)
        if not qi:
            raise NotFoundException(f"Quick intake {intake_id} not found")
        return self._to_response(qi)

    async def update_intake(self, intake_id: str, data: QuickIntakeUpdate) -> QuickIntakeResponse:
        qi = await self.repo.get_by_intake_id(intake_id)
        if not qi:
            raise NotFoundException(f"Quick intake {intake_id} not found")
        if qi.status == "committed":
            raise BadRequestException("Cannot edit a committed intake")
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update_intake(intake_id, update_dict)
        return await self.get_intake(intake_id)

    async def commit_intake(self, intake_id: str) -> QuickIntakeResponse:
        """Atomically apply stock increments for all rows, then mark as committed."""
        qi = await self.repo.get_by_intake_id(intake_id)
        if not qi:
            raise NotFoundException(f"Quick intake {intake_id} not found")
        if qi.status == "committed":
            raise BadRequestException("Intake already committed")
        if not qi.items:
            raise BadRequestException("Cannot commit an empty intake")

        for item in qi.items:
            v = await self.variant_repo.get_by_variant_id(item.variant_id)
            if not v:
                raise NotFoundException(f"Variant {item.variant_id} not found")
            await self.variant_repo.increment_stock_atomic(item.variant_id, item.qty)

        await self.repo.update_intake(intake_id, {
            "status": "committed",
            "committed_at": datetime.now(timezone.utc),
        })
        return await self.get_intake(intake_id)

    async def delete_draft(self, intake_id: str):
        qi = await self.repo.get_by_intake_id(intake_id)
        if not qi:
            raise NotFoundException(f"Quick intake {intake_id} not found")
        if qi.status == "committed":
            raise BadRequestException("Cannot delete a committed intake")
        await self.repo.delete_draft(intake_id)
