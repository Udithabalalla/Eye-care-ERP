from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.supplier_repository import SupplierRepository
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse
from app.schemas.responses import PaginatedResponse
from app.models.supplier import SupplierModel
from app.core.exceptions import NotFoundException, ConflictException
from app.utils.helpers import generate_id


class SupplierService:
    """Supplier business logic"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SupplierRepository(db)

    async def list_suppliers(self, page: int, page_size: int, search: Optional[str] = None) -> PaginatedResponse[SupplierResponse]:
        skip = (page - 1) * page_size
        suppliers, total = await self.repo.list_suppliers(skip=skip, limit=page_size, search=search)
        total_pages = math.ceil(total / page_size)
        supplier_responses = [SupplierResponse(**s.model_dump()) for s in suppliers]
        return PaginatedResponse(
            data=supplier_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_supplier(self, supplier_id: str) -> SupplierResponse:
        s = await self.repo.get_by_supplier_id(supplier_id)
        if not s:
            raise NotFoundException(f"Supplier {supplier_id} not found")
        return SupplierResponse(**s.model_dump())

    async def create_supplier(self, supplier_data: SupplierCreate) -> SupplierResponse:
        # generate id
        next_num = await self.repo.get_next_supplier_number()
        supplier_id = generate_id("SUP", next_num)

        supplier_model = SupplierModel(
            id=supplier_id,
            supplier_name=supplier_data.supplier_name,
            company_name=supplier_data.company_name,
            contact_person=supplier_data.contact_person,
            phone=supplier_data.phone,
            email=supplier_data.email,
            address=supplier_data.address,
            payment_terms=supplier_data.payment_terms,
            notes=supplier_data.notes,
        )

        created = await self.repo.create_supplier(supplier_model)
        return SupplierResponse(**created.model_dump())

    async def update_supplier(self, supplier_id: str, supplier_data: SupplierUpdate) -> SupplierResponse:
        existing = await self.repo.get_by_supplier_id(supplier_id)
        if not existing:
            raise NotFoundException(f"Supplier {supplier_id} not found")

        update_dict = supplier_data.model_dump(exclude_unset=True)
        if update_dict:
            await self.repo.update_supplier(supplier_id, update_dict)

        updated = await self.repo.get_by_supplier_id(supplier_id)
        return SupplierResponse(**updated.model_dump())

    async def delete_supplier(self, supplier_id: str):
        existing = await self.repo.get_by_supplier_id(supplier_id)
        if not existing:
            raise NotFoundException(f"Supplier {supplier_id} not found")
        await self.repo.delete_supplier(supplier_id)
