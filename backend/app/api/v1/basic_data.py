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
)
from app.services.basic_data_service import OtherExpenseTypeService, LensMasterService

router = APIRouter()


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
)
from app.services.basic_data_service import OtherExpenseTypeService, LensMasterService

router = APIRouter()


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
