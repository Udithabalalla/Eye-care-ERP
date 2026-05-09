from __future__ import annotations

import math
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.basic_data import OtherExpenseTypeModel, LensMasterModel
from app.repositories.basic_data_repository import OtherExpenseTypeRepository, LensMasterRepository
from app.schemas.basic_data import (
    OtherExpenseTypeCreate,
    OtherExpenseTypeUpdate,
    OtherExpenseTypeResponse,
    LensMasterCreate,
    LensMasterUpdate,
    LensMasterResponse,
)
from app.schemas.responses import PaginatedResponse


class OtherExpenseTypeService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = OtherExpenseTypeRepository(db)

    async def list_other_expenses(self, page: int, page_size: int, search: str | None = None, is_active: bool | None = None) -> PaginatedResponse[OtherExpenseTypeResponse]:
        skip = (page - 1) * page_size
        items, total = await self.repo.list_other_expenses(skip=skip, limit=page_size, search=search, is_active=is_active)
        return PaginatedResponse(
            data=[OtherExpenseTypeResponse(**item.model_dump()) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size else 0,
        )

    async def get_other_expense(self, expense_type_id: str) -> OtherExpenseTypeResponse:
        item = await self.repo.get_by_id(expense_type_id)
        if not item:
            raise NotFoundException(f"Other expense type {expense_type_id} not found")
        return OtherExpenseTypeResponse(**item.model_dump())

    async def create_other_expense(self, data: OtherExpenseTypeCreate) -> OtherExpenseTypeResponse:
        existing = await self.repo.get_by_name(data.name)
        if existing:
            raise ConflictException("Other expense type with this name already exists")
        created = await self.repo.create_other_expense(OtherExpenseTypeModel(**data.model_dump()))
        return OtherExpenseTypeResponse(**created.model_dump())

    async def update_other_expense(self, expense_type_id: str, data: OtherExpenseTypeUpdate) -> OtherExpenseTypeResponse:
        existing = await self.repo.get_by_id(expense_type_id)
        if not existing:
            raise NotFoundException(f"Other expense type {expense_type_id} not found")

        update_dict = data.model_dump(exclude_unset=True)
        if "name" in update_dict and update_dict["name"]:
            conflict = await self.repo.get_by_name(update_dict["name"])
            if conflict and conflict.id != expense_type_id:
                raise ConflictException("Other expense type with this name already exists")
        if update_dict:
            await self.repo.update_by_id(expense_type_id, update_dict)
        updated = await self.repo.get_by_id(expense_type_id)
        return OtherExpenseTypeResponse(**updated.model_dump())

    async def set_status(self, expense_type_id: str, is_active: bool) -> OtherExpenseTypeResponse:
        existing = await self.repo.get_by_id(expense_type_id)
        if not existing:
            raise NotFoundException(f"Other expense type {expense_type_id} not found")
        await self.repo.update_by_id(expense_type_id, {"is_active": is_active})
        updated = await self.repo.get_by_id(expense_type_id)
        return OtherExpenseTypeResponse(**updated.model_dump())


class LensMasterService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = LensMasterRepository(db)

    async def list_lenses(self, page: int, page_size: int, search: str | None = None, is_active: bool | None = None) -> PaginatedResponse[LensMasterResponse]:
        skip = (page - 1) * page_size
        items, total = await self.repo.list_lenses(skip=skip, limit=page_size, search=search, is_active=is_active)
        return PaginatedResponse(
            data=[LensMasterResponse(**item.model_dump()) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size else 0,
        )

    async def get_lens(self, lens_id: str) -> LensMasterResponse:
        item = await self.repo.get_by_id(lens_id)
        if not item:
            raise NotFoundException(f"Lens {lens_id} not found")
        return LensMasterResponse(**item.model_dump())

    async def create_lens(self, data: LensMasterCreate) -> LensMasterResponse:
        existing = await self.repo.get_by_code(data.lens_code)
        if existing:
            raise ConflictException("Lens with this code already exists")
        created = await self.repo.create_lens(LensMasterModel(**data.model_dump()))
        return LensMasterResponse(**created.model_dump())

    async def update_lens(self, lens_id: str, data: LensMasterUpdate) -> LensMasterResponse:
        existing = await self.repo.get_by_id(lens_id)
        if not existing:
            raise NotFoundException(f"Lens {lens_id} not found")

        update_dict = data.model_dump(exclude_unset=True)
        if "lens_code" in update_dict and update_dict["lens_code"]:
            conflict = await self.repo.get_by_code(update_dict["lens_code"])
            if conflict and conflict.id != lens_id:
                raise ConflictException("Lens with this code already exists")
        if update_dict:
            await self.repo.update_by_id(lens_id, update_dict)
        updated = await self.repo.get_by_id(lens_id)
        return LensMasterResponse(**updated.model_dump())

    async def set_status(self, lens_id: str, is_active: bool) -> LensMasterResponse:
        existing = await self.repo.get_by_id(lens_id)
        if not existing:
            raise NotFoundException(f"Lens {lens_id} not found")
        await self.repo.update_by_id(lens_id, {"is_active": is_active})
        updated = await self.repo.get_by_id(lens_id)
        return LensMasterResponse(**updated.model_dump())
