from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
from datetime import datetime

from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderResponse, PurchaseOrderItemResponse, ReceiveStockRequest
from app.schemas.responses import PaginatedResponse
from app.models.purchase_order import PurchaseOrderModel, PurchaseOrderItemModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id


class PurchaseOrderService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = PurchaseOrderRepository(db)
        self.supplier_repo = SupplierRepository(db)
        self.product_repo = ProductRepository(db)

    async def list_purchase_orders(self, page: int, page_size: int, supplier_id: Optional[str] = None, status: Optional[str] = None):
        skip = (page - 1) * page_size
        orders, total = await self.repo.list_purchase_orders(skip=skip, limit=page_size, supplier_id=supplier_id, status=status)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[self._to_response(order) for order in orders],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def create_purchase_order(self, data: PurchaseOrderCreate, created_by: str) -> PurchaseOrderResponse:
        supplier = await self.supplier_repo.get_by_supplier_id(data.supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID {data.supplier_id} not found")

        next_number = await self.repo.count({}) + 1
        order_id = generate_id("PO", next_number)
        item_models = []
        total_amount = 0
        for index, item in enumerate(data.items, start=1):
            product = await self.product_repo.get_by_product_id(item.product_id)
            if not product:
                raise NotFoundException(f"Product with ID {item.product_id} not found")
            item_id = generate_id(f"POI{next_number}", index)
            item_models.append(PurchaseOrderItemModel(
                id=item_id,
                purchase_order_id=order_id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
            ))
            total_amount += item.quantity * item.unit_cost

        order_model = PurchaseOrderModel(
            id=order_id,
            supplier_id=data.supplier_id,
            order_date=data.order_date,
            expected_delivery_date=data.expected_delivery_date,
            status="Draft",
            total_amount=total_amount,
            created_by=created_by,
            items=item_models,
        )
        created = await self.repo.create(order_model.dict())
        return self._to_response(PurchaseOrderModel(**created))

    async def get_purchase_order(self, order_id: str) -> PurchaseOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        return self._to_response(order)

    async def update_status(self, order_id: str, status: str) -> PurchaseOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        if status not in {"Draft", "Sent", "Received"}:
            raise BadRequestException("Invalid purchase order status")
        await self.repo.update({"id": order_id}, {"status": status})
        updated = await self.repo.get_by_order_id(order_id)
        return self._to_response(updated)

    async def receive_stock(self, order_id: str, receipt: ReceiveStockRequest, received_by: str) -> PurchaseOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        if order.status == "Received":
            raise BadRequestException("Purchase order already received")

        item_map = {item.product_id: item for item in order.items}
        for receipt_item in receipt.items:
            order_item = item_map.get(receipt_item.product_id)
            if not order_item:
                raise BadRequestException(f"Product {receipt_item.product_id} is not part of this purchase order")
            if receipt_item.received_quantity > order_item.quantity:
                raise BadRequestException(f"Received quantity cannot exceed ordered quantity for {receipt_item.product_id}")
            if receipt_item.received_quantity > 0:
                ok = await self.product_repo.increment_stock_atomic(receipt_item.product_id, receipt_item.received_quantity)
                if not ok:
                    raise BadRequestException(f"Failed to update stock for {receipt_item.product_id}")

        await self.repo.update({"id": order_id}, {"status": "Received"})
        updated = await self.repo.get_by_order_id(order_id)
        return self._to_response(updated)

    def _to_response(self, order: PurchaseOrderModel) -> PurchaseOrderResponse:
        return PurchaseOrderResponse(
            id=order.id,
            supplier_id=order.supplier_id,
            order_date=order.order_date,
            expected_delivery_date=order.expected_delivery_date,
            status=order.status,
            total_amount=order.total_amount,
            created_by=order.created_by,
            items=[PurchaseOrderItemResponse(**item.dict()) for item in order.items],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )
