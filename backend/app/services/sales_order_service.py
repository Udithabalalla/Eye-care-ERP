from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math

from app.repositories.sales_order_repository import SalesOrderRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.prescription_repository import PrescriptionRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.sales_order import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
from app.schemas.responses import PaginatedResponse
from app.models.sales_order import SalesOrderModel, SalesOrderItemModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id
from app.services.audit_service import AuditService
from app.services.inventory_movement_service import InventoryMovementService
from app.services.transaction_service import TransactionService
from app.schemas.inventory_movement import InventoryMovementCreate
from app.schemas.transaction import TransactionCreate
from app.utils.constants import (
    SalesOrderStatus,
    InventoryMovementType,
    LedgerReferenceType,
    LedgerTransactionType,
)
from datetime import datetime


class SalesOrderService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SalesOrderRepository(db)
        self.patient_repo = PatientRepository(db)
        self.prescription_repo = PrescriptionRepository(db)
        self.product_repo = ProductRepository(db)
        self.audit_service = AuditService(db)
        self.inventory_movement_service = InventoryMovementService(db)
        self.transaction_service = TransactionService(db)

    def _allowed_status_transitions(self):
        return {
            SalesOrderStatus.DRAFT: {SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.CONFIRMED: {SalesOrderStatus.IN_PRODUCTION, SalesOrderStatus.READY, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.IN_PRODUCTION: {SalesOrderStatus.READY, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.READY: {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.COMPLETED: set(),
            SalesOrderStatus.CANCELLED: set(),
        }

    async def _build_validated_items(self, items):
        item_models = []
        subtotal = 0.0

        for raw_item in items:
            if isinstance(raw_item, dict):
                product_id = raw_item.get("product_id")
                quantity = int(raw_item.get("quantity", 0))
                unit_price = float(raw_item.get("unit_price", 0))
                product_name = raw_item.get("product_name")
                sku = raw_item.get("sku")
            else:
                product_id = raw_item.product_id
                quantity = raw_item.quantity
                unit_price = raw_item.unit_price
                product_name = raw_item.product_name
                sku = raw_item.sku

            if quantity <= 0:
                raise BadRequestException("Item quantity must be greater than zero")

            if unit_price < 0:
                raise BadRequestException("Item unit price cannot be negative")

            product = await self.product_repo.get_by_product_id(product_id)
            if not product:
                raise NotFoundException(f"Product with ID {product_id} not found")

            line_total = round(quantity * unit_price, 2)
            subtotal += line_total

            item_models.append(
                SalesOrderItemModel(
                    product_id=product_id,
                    product_name=product_name or product.name,
                    sku=sku or product.sku,
                    quantity=quantity,
                    unit_price=unit_price,
                    total=line_total,
                )
            )

        return item_models, round(subtotal, 2)

    async def _ensure_stock_available(self, items):
        for item in items:
            product = await self.product_repo.get_by_product_id(item.product_id)
            if not product:
                raise NotFoundException(f"Product with ID {item.product_id} not found")
            if product.current_stock < item.quantity:
                raise BadRequestException(
                    f"Insufficient stock for {product.name}. Available: {product.current_stock}, required: {item.quantity}"
                )

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

        if data.status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED}:
            raise BadRequestException("New sales orders must start in draft/active workflow states")

        next_number = await self.repo.count({}) + 1
        order_id = generate_id("SO", next_number)
        order_number = f"SO-{datetime.utcnow().year}-{str(next_number).zfill(6)}"
        item_models, subtotal = await self._build_validated_items(data.items)
        order_model = SalesOrderModel(
            order_id=order_id,
            order_number=order_number,
            patient_id=data.patient_id,
            prescription_id=data.prescription_id,
            items=item_models,
            subtotal=subtotal,
            total_amount=subtotal,
            notes=data.notes,
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

        if data.prescription_id:
            prescription = await self.prescription_repo.get_by_prescription_id(data.prescription_id)
            if not prescription:
                raise NotFoundException(f"Prescription with ID {data.prescription_id} not found")

        update_dict = data.dict(exclude_unset=True)
        old_status = existing.status
        target_status = update_dict.get("status", old_status)

        if target_status != old_status:
            allowed = self._allowed_status_transitions().get(old_status, set())
            if target_status not in allowed:
                raise BadRequestException(f"Invalid status transition from {old_status} to {target_status}")

        if "items" in update_dict and update_dict["items"] is not None:
            if old_status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.CANCELLED}:
                raise BadRequestException("Cannot modify items of completed/cancelled sales orders")
            item_models, subtotal = await self._build_validated_items(update_dict["items"])
            update_dict["items"] = [item.dict() for item in item_models]
            update_dict["subtotal"] = subtotal
            update_dict["total_amount"] = subtotal

        if target_status == SalesOrderStatus.COMPLETED and old_status != SalesOrderStatus.COMPLETED:
            completion_items = update_dict.get("items", [item.dict() for item in existing.items])
            await self._ensure_stock_available([SalesOrderItemModel(**item) for item in completion_items])

        await self.repo.update({"order_id": order_id}, update_dict)
        updated = await self.repo.get_by_order_id(order_id)

        if target_status == SalesOrderStatus.COMPLETED and old_status != SalesOrderStatus.COMPLETED:
            for item in updated.items:
                await self.inventory_movement_service.create_movement(
                    InventoryMovementCreate(
                        product_id=item.product_id,
                        movement_type=InventoryMovementType.SALE_OUT,
                        quantity=item.quantity,
                        reference_type=LedgerReferenceType.SALES_ORDER,
                        reference_id=updated.order_id,
                    ),
                    created_by=created_by,
                    apply_stock_change=True,
                )

            await self.transaction_service.create_transaction(
                TransactionCreate(
                    transaction_type=LedgerTransactionType.SALE,
                    reference_type=LedgerReferenceType.SALES_ORDER,
                    reference_id=updated.order_id,
                    amount=updated.total_amount,
                    status="completed",
                ),
                created_by=created_by,
            )

        await self.audit_service.log(created_by, "sales_order_updated", "SalesOrder", order_id, old_value=existing.dict(), new_value=updated.dict())
        return SalesOrderResponse(**updated.dict())