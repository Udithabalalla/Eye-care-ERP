from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.sales_order_repository import SalesOrderRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.prescription_repository import PrescriptionRepository
from app.schemas.sales_order import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
from app.schemas.responses import PaginatedResponse
from app.models.sales_order import SalesOrderModel, SalesOrderItemModel
from app.core.exceptions import NotFoundException
from app.utils.helpers import generate_id
from app.services.audit_service import AuditService


class SalesOrderService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SalesOrderRepository(db)
        self.patient_repo = PatientRepository(db)
        self.prescription_repo = PrescriptionRepository(db)
        self.audit_service = AuditService(db)

    async def list_sales_orders(self, page: int, page_size: int, patient_id: Optional[str] = None, status: Optional[str] = None):
        skip = (page - 1) * page_size
        orders, total = await self.repo.list_sales_orders(skip=skip, limit=page_size, patient_id=patient_id, status=status)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[SalesOrderResponse(**order.dict()) for order in orders],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_sales_order(self, order_id: str) -> SalesOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Sales order {order_id} not found")
        return SalesOrderResponse(**order.dict())

    async def create_sales_order(self, data: SalesOrderCreate, created_by: str) -> SalesOrderResponse:
        patient = await self.patient_repo.get_by_patient_id(data.patient_id)
        if not patient:
            raise NotFoundException(f"Patient with ID {data.patient_id} not found")
        if data.prescription_id:
            prescription = await self.prescription_repo.get_by_prescription_id(data.prescription_id)
            if not prescription:
                raise NotFoundException(f"Prescription with ID {data.prescription_id} not found")

        next_number = await self.repo.count({}) + 1
        order_id = generate_id("SO", next_number)
        order_number = f"SO-2026-{str(next_number).zfill(6)}"
        item_models = [SalesOrderItemModel(**item.dict()) for item in data.items]
        order_model = SalesOrderModel(
            order_id=order_id,
            order_number=order_number,
            patient_id=data.patient_id,
            prescription_id=data.prescription_id,
            items=item_models,
            status=data.status,
            created_by=created_by,
        )
        created = await self.repo.create(order_model.dict())
        await self.audit_service.log(created_by, "sales_order_created", "SalesOrder", order_id, new_value=created)
        return SalesOrderResponse(**created)

    async def update_sales_order(self, order_id: str, data: SalesOrderUpdate, created_by: str) -> SalesOrderResponse:
        existing = await self.repo.get_by_order_id(order_id)
        if not existing:
            raise NotFoundException(f"Sales order {order_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if "items" in update_dict and update_dict["items"] is not None:
            update_dict["items"] = [SalesOrderItemModel(**item.dict()).dict() for item in update_dict["items"]]
        await self.repo.update({"order_id": order_id}, update_dict)
        updated = await self.repo.get_by_order_id(order_id)
        await self.audit_service.log(created_by, "sales_order_updated", "SalesOrder", order_id, old_value=existing.dict(), new_value=updated.dict())
        return SalesOrderResponse(**updated.dict())