from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
from datetime import datetime, date, timezone

from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.repositories.supplier_invoice_repository import SupplierInvoiceRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.stock_receipt_repository import StockReceiptRepository
from app.schemas.supplier_invoice import SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse, SupplierInvoiceItemCreate
from app.schemas.responses import PaginatedResponse
from app.models.supplier_invoice import SupplierInvoiceModel, SupplierInvoiceItemModel
from app.models.purchase_order import PurchaseOrderModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id


def _date_to_datetime(d) -> Optional[datetime]:
    """Convert a date to UTC midnight datetime for BSON compatibility."""
    if d is None:
        return None
    if isinstance(d, datetime):
        return d
    if isinstance(d, date):
        return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    return d


class SupplierInvoiceService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = SupplierInvoiceRepository(db)
        self.supplier_repo = SupplierRepository(db)
        self.purchase_order_repo = PurchaseOrderRepository(db)
        self.stock_receipt_repo = StockReceiptRepository(db)

    async def list_supplier_invoices(self, page: int, page_size: int, supplier_id: Optional[str] = None, status: Optional[str] = None):
        skip = (page - 1) * page_size
        invoices, total = await self.repo.list_supplier_invoices(skip=skip, limit=page_size, supplier_id=supplier_id, status=status)
        total_pages = math.ceil(total / page_size)
        return PaginatedResponse(
            data=[SupplierInvoiceResponse(**invoice.dict()) for invoice in invoices],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def create_supplier_invoice(self, data: SupplierInvoiceCreate) -> SupplierInvoiceResponse:
        supplier = await self.supplier_repo.get_by_supplier_id(data.supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID {data.supplier_id} not found")

        purchase_order: Optional[PurchaseOrderModel] = None
        if data.purchase_order_id:
            purchase_order = await self.purchase_order_repo.get_by_order_id(data.purchase_order_id)
            if not purchase_order:
                raise NotFoundException(f"Purchase order {data.purchase_order_id} not found")
            if purchase_order.supplier_id != data.supplier_id:
                raise BadRequestException("Supplier does not match the referenced purchase order")

        received_quantities: dict[str, int] = {}
        if purchase_order:
            receipts = await self.stock_receipt_repo.list_by_purchase_order_id(purchase_order.id)
            for receipt in receipts:
                for receipt_item in receipt.items:
                    received_quantities[receipt_item.product_id] = received_quantities.get(receipt_item.product_id, 0) + receipt_item.received_quantity

        invoice_items_input = list(data.items or [])
        if not invoice_items_input and purchase_order:
            invoice_items_input = [
                SupplierInvoiceItemCreate(
                    product_id=item.product_id,
                    product_name=None,
                    ordered_quantity=item.quantity,
                    received_quantity=received_quantities.get(item.product_id, item.quantity),
                    invoice_quantity=received_quantities.get(item.product_id, item.quantity),
                    unit_price=item.unit_cost,
                )
                for item in purchase_order.items
            ]

        order_item_map = {item.product_id: item for item in purchase_order.items} if purchase_order else {}
        normalized_items: list[SupplierInvoiceItemModel] = []
        matching_issues: list[str] = []
        computed_total = 0.0

        for item in invoice_items_input:
            order_item = order_item_map.get(item.product_id)
            if purchase_order and not order_item:
                raise BadRequestException(f"Product {item.product_id} is not part of this purchase order")
            ordered_quantity = order_item.quantity if order_item else item.ordered_quantity
            received_quantity = received_quantities.get(item.product_id, item.received_quantity)
            invoice_quantity = item.invoice_quantity
            unit_price = order_item.unit_cost if order_item else item.unit_price
            line_total = round(invoice_quantity * unit_price, 2)
            warnings: list[str] = []

            if purchase_order and ordered_quantity != received_quantity:
                warnings.append("Ordered quantity differs from received quantity.")
            if invoice_quantity > received_quantity:
                warnings.append("Invoice quantity exceeds received quantity.")
            if purchase_order and invoice_quantity != ordered_quantity:
                warnings.append("Invoice quantity differs from purchase order quantity.")

            if warnings:
                matching_issues.extend([f"{item.product_id}: {warning}" for warning in warnings])

            normalized_items.append(SupplierInvoiceItemModel(
                product_id=item.product_id,
                product_name=item.product_name,
                ordered_quantity=ordered_quantity,
                received_quantity=received_quantity,
                invoice_quantity=invoice_quantity,
                unit_price=unit_price,
                line_total=line_total,
                warnings=warnings,
            ))
            computed_total += line_total

        next_number = await self.repo.count({}) + 1
        invoice_id = generate_id("SINV", next_number)
        invoice = SupplierInvoiceModel(
            id=invoice_id,
            supplier_id=data.supplier_id,
            purchase_order_id=data.purchase_order_id,
            invoice_number=data.invoice_number,
            invoice_date=data.invoice_date,
            total_amount=round(computed_total if normalized_items else (data.total_amount or 0.0), 2),
            due_date=data.due_date,
            status=data.status,
            items=normalized_items,
            matching_status="Flagged" if matching_issues else "Matched",
            matching_issues=matching_issues,
        )
        doc = invoice.dict()
        # Convert date -> datetime for BSON compatibility
        doc["due_date"] = _date_to_datetime(doc.get("due_date"))
        await self.repo.create(doc)
        created = await self.repo.get_by_invoice_id(invoice_id)
        return SupplierInvoiceResponse(**created.dict())

    async def update_supplier_invoice(self, invoice_id: str, data: SupplierInvoiceUpdate) -> SupplierInvoiceResponse:
        existing = await self.repo.get_by_invoice_id(invoice_id)
        if not existing:
            raise NotFoundException(f"Supplier invoice {invoice_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if "due_date" in update_dict:
            update_dict["due_date"] = _date_to_datetime(update_dict["due_date"])
        if update_dict:
            await self.repo.update({"id": invoice_id}, update_dict)
        updated = await self.repo.get_by_invoice_id(invoice_id)
        return SupplierInvoiceResponse(**updated.dict())
