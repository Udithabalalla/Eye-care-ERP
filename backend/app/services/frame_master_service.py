import math
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.frame_master_repository import FrameMasterRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.schemas.frame_master import FrameMasterCreate, FrameMasterUpdate, FrameMasterResponse
from app.schemas.responses import PaginatedResponse
from app.models.frame_master import FrameMasterModel
from app.core.exceptions import NotFoundException, ConflictException
from app.utils.helpers import generate_id


class FrameMasterService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = FrameMasterRepository(db)
        self.variant_repo = FrameVariantRepository(db)

    async def list_masters(
        self,
        page: int,
        page_size: int,
        search: Optional[str] = None,
        brand: Optional[str] = None,
        category: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> PaginatedResponse[FrameMasterResponse]:
        skip = (page - 1) * page_size
        masters, total = await self.repo.list_masters(skip, page_size, search, brand, category, gender)

        responses = []
        for m in masters:
            summary = await self.variant_repo.get_stock_summary_for_master(m.frame_master_id)
            r = FrameMasterResponse(
                **m.dict(),
                variant_count=summary["variant_count"],
                total_stock=summary["total_stock"],
            )
            responses.append(r)

        return PaginatedResponse(
            data=responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    async def get_master(self, frame_master_id: str) -> FrameMasterResponse:
        master = await self.repo.get_by_master_id(frame_master_id)
        if not master:
            raise NotFoundException(f"Frame master {frame_master_id} not found")
        summary = await self.variant_repo.get_stock_summary_for_master(frame_master_id)
        return FrameMasterResponse(**master.dict(), **summary)

    async def create_master(self, data: FrameMasterCreate) -> FrameMasterResponse:
        existing = await self.repo.get_by_brand_model(data.brand, data.model_code)
        if existing:
            raise ConflictException(f"Frame master {data.brand} {data.model_code} already exists")

        next_num = await self.repo.get_next_master_number()
        frame_master_id = generate_id("FM-", next_num, 6)

        model = FrameMasterModel(
            frame_master_id=frame_master_id,
            **data.dict(),
        )
        created = await self.repo.create_master(model)
        return FrameMasterResponse(**created.dict(), variant_count=0, total_stock=0)

    async def update_master(self, frame_master_id: str, data: FrameMasterUpdate) -> FrameMasterResponse:
        existing = await self.repo.get_by_master_id(frame_master_id)
        if not existing:
            raise NotFoundException(f"Frame master {frame_master_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update_master(frame_master_id, update_dict)
        return await self.get_master(frame_master_id)

    async def delete_master(self, frame_master_id: str):
        existing = await self.repo.get_by_master_id(frame_master_id)
        if not existing:
            raise NotFoundException(f"Frame master {frame_master_id} not found")
        await self.repo.update_master(frame_master_id, {"is_active": False})

    async def get_distinct_brands(self):
        return await self.repo.get_distinct_brands()
