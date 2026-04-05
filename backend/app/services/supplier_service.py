from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.supplier_repository import SupplierRepository
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.schemas.responses import ResponseModel, PaginatedResponse
from app.models.supplier import SupplierModel
from app.core.exceptions import NotFoundException, ConflictException
from app.utils.helpers import generate_id


class SupplierService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SupplierRepository(db)

    async def list_suppliers(self, page: int, page_size: int, search: Optional[str] = None) -> PaginatedResponse[SupplierResponse]:
        skip = (page - 1) * page_size
        suppliers, total = await self.repo.list_suppliers(skip=skip, limit=page_size, search=search)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[SupplierResponse(**s.dict()) for s in suppliers],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def create_supplier(self, data: SupplierCreate) -> SupplierResponse:
        existing = await self.repo.get_one({"supplier_name": data.supplier_name})
        if existing:
            raise ConflictException("Supplier with this name already exists")
        next_number = await self.repo.count({}) + 1
        supplier_id = generate_id("SUP", next_number)
        supplier = SupplierModel(id=supplier_id, **data.dict())
        created = await self.repo.create(supplier.dict())
        return SupplierResponse(**created)

    async def get_supplier(self, supplier_id: str) -> SupplierResponse:
        supplier = await self.repo.get_by_supplier_id(supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID {supplier_id} not found")
        return SupplierResponse(**supplier.dict())

    async def update_supplier(self, supplier_id: str, data: SupplierUpdate) -> SupplierResponse:
        existing = await self.repo.get_by_supplier_id(supplier_id)
        if not existing:
            raise NotFoundException(f"Supplier with ID {supplier_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if update_dict:
            await self.repo.update({"id": supplier_id}, update_dict)
        updated = await self.repo.get_by_supplier_id(supplier_id)
        return SupplierResponse(**updated.dict())

    async def delete_supplier(self, supplier_id: str):
        existing = await self.repo.get_by_supplier_id(supplier_id)
        if not existing:
            raise NotFoundException(f"Supplier with ID {supplier_id} not found")
        await self.repo.delete({"id": supplier_id})
