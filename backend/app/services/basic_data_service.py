from __future__ import annotations

import math
from typing import List, Optional
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.basic_data import (
    OtherExpenseTypeModel,
    LensMasterModel,
    ProductCategoryModel,
    ComplimentaryItemModel,
    CasePriceRuleModel,
)
from app.repositories.basic_data_repository import (
    OtherExpenseTypeRepository,
    LensMasterRepository,
    ProductCategoryRepository,
    ComplimentaryItemRepository,
    CasePriceRuleRepository,
)
from app.repositories.product_repository import ProductRepository
from app.schemas.basic_data import (
    OtherExpenseTypeCreate,
    OtherExpenseTypeUpdate,
    OtherExpenseTypeResponse,
    LensMasterCreate,
    LensMasterUpdate,
    LensMasterResponse,
    ProductCategoryCreate,
    ProductCategoryUpdate,
    ProductCategoryResponse,
    ComplimentaryItemCreate,
    ComplimentaryItemUpdate,
    ComplimentaryItemResponse,
    CasePriceRuleCreate,
    CasePriceRuleUpdate,
    CasePriceRuleResponse,
    ComplimentaryProductSuggestion,
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


class ProductCategoryService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = ProductCategoryRepository(db)

    async def list_categories(self, page: int, page_size: int, search: str | None = None, is_active: bool | None = None) -> PaginatedResponse[ProductCategoryResponse]:
        skip = (page - 1) * page_size
        items, total = await self.repo.list_categories(skip=skip, limit=page_size, search=search, is_active=is_active)
        return PaginatedResponse(
            data=[ProductCategoryResponse(**item.model_dump()) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size else 0,
        )

    async def get_category(self, category_id: str) -> ProductCategoryResponse:
        item = await self.repo.get_by_id(category_id)
        if not item:
            raise NotFoundException(f"Product category {category_id} not found")
        return ProductCategoryResponse(**item.model_dump())

    async def create_category(self, data: ProductCategoryCreate) -> ProductCategoryResponse:
        existing = await self.repo.get_by_name(data.name)
        if existing:
            raise ConflictException("A product category with this name already exists")
        created = await self.repo.create_category(ProductCategoryModel(**data.model_dump()))
        return ProductCategoryResponse(**created.model_dump())

    async def update_category(self, category_id: str, data: ProductCategoryUpdate) -> ProductCategoryResponse:
        existing = await self.repo.get_by_id(category_id)
        if not existing:
            raise NotFoundException(f"Product category {category_id} not found")
        update_dict = data.model_dump(exclude_unset=True)
        if "name" in update_dict and update_dict["name"]:
            conflict = await self.repo.get_by_name(update_dict["name"])
            if conflict and conflict.id != category_id:
                raise ConflictException("A product category with this name already exists")
        if update_dict:
            await self.repo.update_by_id(category_id, update_dict)
        updated = await self.repo.get_by_id(category_id)
        return ProductCategoryResponse(**updated.model_dump())

    async def set_status(self, category_id: str, is_active: bool) -> ProductCategoryResponse:
        existing = await self.repo.get_by_id(category_id)
        if not existing:
            raise NotFoundException(f"Product category {category_id} not found")
        await self.repo.update_by_id(category_id, {"is_active": is_active})
        updated = await self.repo.get_by_id(category_id)
        return ProductCategoryResponse(**updated.model_dump())


class ComplimentaryItemService:
    """Kept for backward-compat with existing complimentary_items documents."""
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = ComplimentaryItemRepository(db)

    async def list_items(self, page: int, page_size: int, search: str | None = None, item_type: str | None = None, is_active: bool | None = None) -> PaginatedResponse[ComplimentaryItemResponse]:
        skip = (page - 1) * page_size
        items, total = await self.repo.list_items(skip=skip, limit=page_size, search=search, item_type=item_type, is_active=is_active)
        return PaginatedResponse(
            data=[ComplimentaryItemResponse(**item.model_dump()) for item in items],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size else 0,
        )

    async def get_item(self, item_id: str) -> ComplimentaryItemResponse:
        item = await self.repo.get_by_id(item_id)
        if not item:
            raise NotFoundException(f"Complimentary item {item_id} not found")
        return ComplimentaryItemResponse(**item.model_dump())

    async def create_item(self, data: ComplimentaryItemCreate) -> ComplimentaryItemResponse:
        existing = await self.repo.get_by_name_and_type(data.name, data.item_type)
        if existing:
            raise ConflictException("A complimentary item with this name and type already exists")
        created = await self.repo.create_item(ComplimentaryItemModel(**data.model_dump()))
        return ComplimentaryItemResponse(**created.model_dump())

    async def update_item(self, item_id: str, data: ComplimentaryItemUpdate) -> ComplimentaryItemResponse:
        existing = await self.repo.get_by_id(item_id)
        if not existing:
            raise NotFoundException(f"Complimentary item {item_id} not found")
        update_dict = data.model_dump(exclude_unset=True)
        if "name" in update_dict and update_dict["name"]:
            conflict = await self.repo.get_by_name_and_type(update_dict["name"], update_dict.get("item_type", existing.item_type))
            if conflict and conflict.id != item_id:
                raise ConflictException("A complimentary item with this name and type already exists")
        if update_dict:
            await self.repo.update_by_id(item_id, update_dict)
        updated = await self.repo.get_by_id(item_id)
        return ComplimentaryItemResponse(**updated.model_dump())

    async def set_status(self, item_id: str, is_active: bool) -> ComplimentaryItemResponse:
        existing = await self.repo.get_by_id(item_id)
        if not existing:
            raise NotFoundException(f"Complimentary item {item_id} not found")
        await self.repo.update_by_id(item_id, {"is_active": is_active})
        updated = await self.repo.get_by_id(item_id)
        return ComplimentaryItemResponse(**updated.model_dump())


class CasePriceRuleService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = CasePriceRuleRepository(db)
        self.product_repo = ProductRepository(db)

    async def list_rules(self, page: int, page_size: int, search: str | None = None, is_active: bool | None = None) -> PaginatedResponse[CasePriceRuleResponse]:
        skip = (page - 1) * page_size
        rules, total = await self.repo.list_rules(skip=skip, limit=page_size, search=search, is_active=is_active)
        return PaginatedResponse(
            data=[CasePriceRuleResponse(**r.model_dump()) for r in rules],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if page_size else 0,
        )

    async def get_rule(self, rule_id: str) -> CasePriceRuleResponse:
        rule = await self.repo.get_by_id(rule_id)
        if not rule:
            raise NotFoundException(f"Price rule {rule_id} not found")
        return CasePriceRuleResponse(**rule.model_dump())

    async def create_rule(self, data: CasePriceRuleCreate) -> CasePriceRuleResponse:
        product = await self.product_repo.get_by_product_id(data.product_id)
        if not product:
            raise NotFoundException(f"Product {data.product_id} not found")
        payload = CasePriceRuleModel(**{**data.model_dump(), "product_name": product.name})
        created = await self.repo.create_rule(payload)
        return CasePriceRuleResponse(**created.model_dump())

    async def update_rule(self, rule_id: str, data: CasePriceRuleUpdate) -> CasePriceRuleResponse:
        existing = await self.repo.get_by_id(rule_id)
        if not existing:
            raise NotFoundException(f"Price rule {rule_id} not found")
        update_dict = data.model_dump(exclude_unset=True)
        if "product_id" in update_dict and update_dict["product_id"]:
            product = await self.product_repo.get_by_product_id(update_dict["product_id"])
            if not product:
                raise NotFoundException(f"Product {update_dict['product_id']} not found")
            update_dict["product_name"] = product.name
        if update_dict:
            await self.repo.update_by_id(rule_id, update_dict)
        updated = await self.repo.get_by_id(rule_id)
        return CasePriceRuleResponse(**updated.model_dump())

    async def delete_rule(self, rule_id: str) -> None:
        existing = await self.repo.get_by_id(rule_id)
        if not existing:
            raise NotFoundException(f"Price rule {rule_id} not found")
        await self.repo.collection.delete_one({"_id": ObjectId(rule_id)})

    async def set_status(self, rule_id: str, is_active: bool) -> CasePriceRuleResponse:
        existing = await self.repo.get_by_id(rule_id)
        if not existing:
            raise NotFoundException(f"Price rule {rule_id} not found")
        await self.repo.update_by_id(rule_id, {"is_active": is_active})
        updated = await self.repo.get_by_id(rule_id)
        return CasePriceRuleResponse(**updated.model_dump())

    async def suggest_complimentary(self, frame_price: float) -> Optional[ComplimentaryProductSuggestion]:
        """Return the best matching product for the given frame price based on active rules."""
        rules = await self.repo.get_active_rules()
        matching = [
            r for r in rules
            if r.min_price <= frame_price and (r.max_price is None or frame_price <= r.max_price)
        ]
        if not matching:
            return None
        best = sorted(matching, key=lambda r: (r.priority, -r.min_price))[0]
        product = await self.product_repo.get_by_product_id(best.product_id)
        if not product or not product.is_active:
            return None
        return ComplimentaryProductSuggestion(
            rule_id=best.id or "",
            rule_name=best.name,
            product_id=product.product_id,
            product_name=product.name,
            sku=product.sku,
            category=product.category,
        )
