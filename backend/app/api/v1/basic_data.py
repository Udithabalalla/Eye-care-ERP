from typing import Optional
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.deps import get_current_user
from app.config.database import get_database
from app.models.user import UserModel
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.schemas.basic_data import (
    OtherExpenseTypeCreate,
    OtherExpenseTypeUpdate,
    OtherExpenseTypeStatusUpdate,
    OtherExpenseTypeResponse,
    LensMasterCreate,
    LensMasterUpdate,
    LensMasterStatusUpdate,
    LensMasterResponse,
    ComplimentaryItemCreate,
    ComplimentaryItemUpdate,
    ComplimentaryItemStatusUpdate,
    ComplimentaryItemResponse,
    CasePriceRuleCreate,
    CasePriceRuleUpdate,
    CasePriceRuleStatusUpdate,
    CasePriceRuleResponse,
)
from app.services.basic_data_service import (
    OtherExpenseTypeService,
    LensMasterService,
    ComplimentaryItemService,
    CasePriceRuleService,
)

router = APIRouter()


# ── Other Expenses ────────────────────────────────────────────────────────────

@router.get("/other-expenses", response_model=PaginatedResponse[OtherExpenseTypeResponse])
async def list_other_expenses(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await OtherExpenseTypeService(db).list_other_expenses(page, page_size, search, is_active)


@router.get("/other-expenses/{expense_type_id}", response_model=ResponseModel[OtherExpenseTypeResponse])
async def get_other_expense(
    expense_type_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await OtherExpenseTypeService(db).get_other_expense(expense_type_id)
    return ResponseModel(data=item)


@router.post("/other-expenses", response_model=ResponseModel[OtherExpenseTypeResponse])
async def create_other_expense(
    data: OtherExpenseTypeCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await OtherExpenseTypeService(db).create_other_expense(data)
    return ResponseModel(message="Other expense type created successfully", data=item)


@router.put("/other-expenses/{expense_type_id}", response_model=ResponseModel[OtherExpenseTypeResponse])
async def update_other_expense(
    expense_type_id: str,
    data: OtherExpenseTypeUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await OtherExpenseTypeService(db).update_other_expense(expense_type_id, data)
    return ResponseModel(message="Other expense type updated successfully", data=item)


@router.patch("/other-expenses/{expense_type_id}/status", response_model=ResponseModel[OtherExpenseTypeResponse])
async def update_other_expense_status(
    expense_type_id: str,
    data: OtherExpenseTypeStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await OtherExpenseTypeService(db).set_status(expense_type_id, data.is_active)
    return ResponseModel(message="Other expense type status updated successfully", data=item)


# ── Lenses ────────────────────────────────────────────────────────────────────

@router.get("/lenses", response_model=PaginatedResponse[LensMasterResponse])
async def list_lenses(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await LensMasterService(db).list_lenses(page, page_size, search, is_active)


@router.get("/lenses/{lens_id}", response_model=ResponseModel[LensMasterResponse])
async def get_lens(
    lens_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await LensMasterService(db).get_lens(lens_id)
    return ResponseModel(data=item)


@router.post("/lenses", response_model=ResponseModel[LensMasterResponse])
async def create_lens(
    data: LensMasterCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await LensMasterService(db).create_lens(data)
    return ResponseModel(message="Lens created successfully", data=item)


@router.put("/lenses/{lens_id}", response_model=ResponseModel[LensMasterResponse])
async def update_lens(
    lens_id: str,
    data: LensMasterUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await LensMasterService(db).update_lens(lens_id, data)
    return ResponseModel(message="Lens updated successfully", data=item)


@router.patch("/lenses/{lens_id}/status", response_model=ResponseModel[LensMasterResponse])
async def update_lens_status(
    lens_id: str,
    data: LensMasterStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await LensMasterService(db).set_status(lens_id, data.is_active)
    return ResponseModel(message="Lens status updated successfully", data=item)


# ── Complimentary Items (Cases & Bags) ────────────────────────────────────────

@router.get("/complimentary-items", response_model=PaginatedResponse[ComplimentaryItemResponse])
async def list_complimentary_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    item_type: str | None = None,
    is_active: bool | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await ComplimentaryItemService(db).list_items(page, page_size, search, item_type, is_active)


@router.get("/complimentary-items/{item_id}", response_model=ResponseModel[ComplimentaryItemResponse])
async def get_complimentary_item(
    item_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await ComplimentaryItemService(db).get_item(item_id)
    return ResponseModel(data=item)


@router.post("/complimentary-items", response_model=ResponseModel[ComplimentaryItemResponse])
async def create_complimentary_item(
    data: ComplimentaryItemCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await ComplimentaryItemService(db).create_item(data)
    return ResponseModel(message="Complimentary item created successfully", data=item)


@router.put("/complimentary-items/{item_id}", response_model=ResponseModel[ComplimentaryItemResponse])
async def update_complimentary_item(
    item_id: str,
    data: ComplimentaryItemUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await ComplimentaryItemService(db).update_item(item_id, data)
    return ResponseModel(message="Complimentary item updated successfully", data=item)


@router.patch("/complimentary-items/{item_id}/status", response_model=ResponseModel[ComplimentaryItemResponse])
async def update_complimentary_item_status(
    item_id: str,
    data: ComplimentaryItemStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await ComplimentaryItemService(db).set_status(item_id, data.is_active)
    return ResponseModel(message="Complimentary item status updated successfully", data=item)


# ── Case Price Rules ──────────────────────────────────────────────────────────

@router.get("/case-price-rules/suggest", response_model=ResponseModel[Optional[ComplimentaryItemResponse]])
async def suggest_case(
    frame_price: float = Query(..., ge=0),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    item = await CasePriceRuleService(db).suggest_case(frame_price)
    return ResponseModel(data=item)


@router.get("/case-price-rules", response_model=PaginatedResponse[CasePriceRuleResponse])
async def list_case_price_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    is_active: bool | None = None,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    return await CasePriceRuleService(db).list_rules(page, page_size, search, is_active)


@router.get("/case-price-rules/{rule_id}", response_model=ResponseModel[CasePriceRuleResponse])
async def get_case_price_rule(
    rule_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    rule = await CasePriceRuleService(db).get_rule(rule_id)
    return ResponseModel(data=rule)


@router.post("/case-price-rules", response_model=ResponseModel[CasePriceRuleResponse])
async def create_case_price_rule(
    data: CasePriceRuleCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    rule = await CasePriceRuleService(db).create_rule(data)
    return ResponseModel(message="Case price rule created successfully", data=rule)


@router.put("/case-price-rules/{rule_id}", response_model=ResponseModel[CasePriceRuleResponse])
async def update_case_price_rule(
    rule_id: str,
    data: CasePriceRuleUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    rule = await CasePriceRuleService(db).update_rule(rule_id, data)
    return ResponseModel(message="Case price rule updated successfully", data=rule)


@router.delete("/case-price-rules/{rule_id}", response_model=ResponseModel[None])
async def delete_case_price_rule(
    rule_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    await CasePriceRuleService(db).delete_rule(rule_id)
    return ResponseModel(message="Case price rule deleted successfully", data=None)


@router.patch("/case-price-rules/{rule_id}/status", response_model=ResponseModel[CasePriceRuleResponse])
async def update_case_price_rule_status(
    rule_id: str,
    data: CasePriceRuleStatusUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: UserModel = Depends(get_current_user),
):
    rule = await CasePriceRuleService(db).set_status(rule_id, data.is_active)
    return ResponseModel(message="Case price rule status updated successfully", data=rule)
