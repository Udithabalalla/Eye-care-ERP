from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
import re
from datetime import datetime, date, timezone

from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.repositories.supplier_invoice_repository import SupplierInvoiceRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.stock_receipt_repository import StockReceiptRepository
from app.repositories.supplier_payment_repository import SupplierPaymentRepository
from app.schemas.supplier_invoice import SupplierInvoiceCreate, SupplierInvoiceUpdate, SupplierInvoiceResponse, SupplierInvoiceItemCreate
from app.schemas.responses import PaginatedResponse
from app.models.supplier_invoice import SupplierInvoiceModel, SupplierInvoiceItemModel
from app.models.purchase_order import PurchaseOrderModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id
from pymongo import ReturnDocument


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
        self.payment_repo = SupplierPaymentRepository(db)

    @staticmethod
    def _with_money(data: dict, paid: float) -> dict:
        total = data.get("total_amount") or 0.0
        data["paid_amount"] = round(paid, 2)
        data["balance_due"] = round(max(0.0, total - paid), 2)
        # Advances can come to more than the bill (e.g. a short delivery)
        data["overpaid_amount"] = round(max(0.0, paid - total), 2)
        return data

    async def _to_response(self, invoice: SupplierInvoiceModel) -> SupplierInvoiceResponse:
        supplier = await self.supplier_repo.get_by_supplier_id(invoice.supplier_id)
        data = invoice.dict()
        data["supplier_name"] = supplier.supplier_name if supplier else None
        paid = await self.payment_repo.sum_paid_for_invoice(invoice.id)
        return SupplierInvoiceResponse(**self._with_money(data, paid))

    async def get_supplier_invoice(self, invoice_id: str) -> SupplierInvoiceResponse:
        invoice = await self.repo.get_by_invoice_id(invoice_id)
        if not invoice:
            raise NotFoundException(f"Supplier invoice {invoice_id} not found")
        response = await self._to_response(invoice)
        await self._name_lines(response)
        return response

    async def _name_lines(self, invoice: SupplierInvoiceResponse) -> None:
        """Older invoices were saved without line names; take them from the order they bill."""
        # Older screens stored the ID itself as the name
        unnamed = [item for item in invoice.items if not item.product_name or item.product_name == item.product_id]
        if not unnamed or not invoice.purchase_order_id:
            return
        # Lazy import: the PO service pulls in a lot, and only this path needs it
        from app.services.purchase_order_service import PurchaseOrderService

        try:
            order = await PurchaseOrderService(self.repo.db).get_purchase_order(invoice.purchase_order_id)
        except NotFoundException:
            return
        names ={item.product_id: item.item_name for item in order.items if item.item_name}
        for item in unnamed:
            item.product_name = names.get(item.product_id, item.product_name)

    async def list_supplier_invoices(
        self,
        page: int,
        page_size: int,
        supplier_id: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        overdue: bool = False,
    ):
        skip = (page - 1) * page_size
        search = (search or "").strip() or None
        matching_supplier_ids = None
        if search:
            # Searching by supplier name finds that supplier's invoices too
            suppliers = await self.supplier_repo.get_many(
                {"supplier_name": {"$regex": re.escape(search), "$options": "i"}}, limit=0
            )
            matching_supplier_ids = [s["id"] for s in suppliers if s.get("id")]
        invoices, total = await self.repo.list_supplier_invoices(
            skip=skip,
            limit=page_size,
            supplier_id=supplier_id,
            status=status,
            search=search,
            matching_supplier_ids=matching_supplier_ids,
            overdue_before=datetime.now(timezone.utc) if overdue else None,
        )
        total_pages = math.ceil(total / page_size)
        paid_by_invoice = await self.payment_repo.sum_paid_by_invoice([inv.id for inv in invoices])

        # Build supplier lookup to avoid N+1 queries
        unique_supplier_ids = list({inv.supplier_id for inv in invoices})
        supplier_map: dict[str, str] = {}
        for sid in unique_supplier_ids:
            sup = await self.supplier_repo.get_by_supplier_id(sid)
            if sup:
                supplier_map[sid] = sup.supplier_name

        def _make_response(invoice: SupplierInvoiceModel) -> SupplierInvoiceResponse:
            data = invoice.dict()
            data["supplier_name"] = supplier_map.get(invoice.supplier_id)
            return SupplierInvoiceResponse(**self._with_money(data, paid_by_invoice.get(invoice.id, 0.0)))

        return PaginatedResponse(
            data=[_make_response(inv) for inv in invoices],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def create_supplier_invoice(self, data: SupplierInvoiceCreate, created_by: Optional[str] = None) -> SupplierInvoiceResponse:
        supplier = await self.supplier_repo.get_by_supplier_id(data.supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID {data.supplier_id} not found")

        # Check for duplicate invoice number
        existing_invoice = await self.repo.get_by_invoice_number(data.invoice_number)
        if existing_invoice:
            raise BadRequestException(f"Invoice number '{data.invoice_number}' already exists. Please use a unique invoice number.")

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
                    product_name=item.item_name,
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

            # Name lines after what was ordered, so the invoice never shows a bare ID
            product_name = item.product_name or (order_item.item_name if order_item else None)
            if warnings:
                matching_issues.extend([f"{product_name or item.product_id}: {warning}" for warning in warnings])

            normalized_items.append(SupplierInvoiceItemModel(
                product_id=item.product_id,
                product_name=product_name,
                ordered_quantity=ordered_quantity,
                received_quantity=received_quantity,
                invoice_quantity=invoice_quantity,
                unit_price=unit_price,
                line_total=line_total,
                warnings=warnings,
            ))
            computed_total += line_total

        # Use an atomic counter to avoid race conditions when generating sequential IDs
        counters = self.repo.db['counters']
        seq = await counters.find_one_and_update(
            {"_id": "supplier_invoice"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        next_number = int(seq.get('seq', 1))
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
            created_by=created_by,
            updated_by=created_by,
        )
        doc = invoice.dict()
        # Convert date -> datetime for BSON compatibility
        doc["due_date"] = _date_to_datetime(doc.get("due_date"))
        doc["invoice_date"] = _date_to_datetime(doc.get("invoice_date"))
        await self.repo.create(doc)
        if purchase_order:
            await self._apply_advances(purchase_order, invoice_id, created_by)
        created = await self.repo.get_by_invoice_id(invoice_id)
        return await self._to_response(created)

    async def _apply_advances(self, purchase_order: PurchaseOrderModel, invoice_id: str, user_id: Optional[str]) -> None:
        """Advances paid on the order count towards its invoice; settling it in full closes the order."""
        moved = await self.payment_repo.apply_advances_to_invoice(purchase_order.id, invoice_id)
        if not moved:
            return
        invoice = await self.repo.get_by_invoice_id(invoice_id)
        paid = await self.payment_repo.sum_paid_for_invoice(invoice_id)
        status = "Paid" if paid >= invoice.total_amount - 0.005 else "Partial"
        await self.repo.update_invoice_status(invoice_id, status)
        if status == "Paid":
            from app.services.purchase_order_service import PurchaseOrderService

            try:
                await PurchaseOrderService(self.repo.db).update_status(purchase_order.id, "Closed", updated_by=user_id or "system")
            except BadRequestException:
                # Still waiting on part of the delivery; it closes when that's sorted
                pass

    async def update_supplier_invoice(self, invoice_id: str, data: SupplierInvoiceUpdate, updated_by: Optional[str] = None) -> SupplierInvoiceResponse:
        existing = await self.repo.get_by_invoice_id(invoice_id)
        if not existing:
            raise NotFoundException(f"Supplier invoice {invoice_id} not found")
        update_dict = data.dict(exclude_unset=True)
        if "due_date" in update_dict:
            update_dict["due_date"] = _date_to_datetime(update_dict["due_date"])
        if updated_by:
            update_dict["updated_by"] = updated_by
        if update_dict:
            await self.repo.update({"id": invoice_id}, update_dict)
        updated = await self.repo.get_by_invoice_id(invoice_id)
        return await self._to_response(updated)
