from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
import re
from datetime import datetime, date, timezone
from pathlib import Path
import io

from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.repositories.stock_receipt_repository import StockReceiptRepository
from app.repositories.user_repository import UserRepository
from app.repositories.supplier_invoice_repository import SupplierInvoiceRepository
from app.repositories.supplier_payment_repository import SupplierPaymentRepository
from app.services.email_service import EmailService
from app.services.company_profile_service import CompanyProfileService
from app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderItemResponse,
    ReceiveStockRequest,
    ReceiveStockResponseItem,
    PurchaseOrderReceiptSummary,
    PurchaseOrderInvoiceSummary,
    PurchaseOrderSendRequest,
)
from app.schemas.responses import PaginatedResponse
from app.models.purchase_order import (
    PurchaseOrderModel,
    PurchaseOrderItemModel,
    BuyerInformationModel,
    SupplierInformationModel,
    ShippingInformationModel,
    OrderSummaryModel,
    PaymentTermsModel,
    NotesModel,
    AuthorizationModel,
    FooterModel,
)
from app.models.stock_receipt import StockReceiptModel, StockReceiptItemModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id
from app.config.settings import settings
from app.services.inventory_movement_service import InventoryMovementService
from app.schemas.inventory_movement import InventoryMovementCreate
from app.utils.constants import InventoryMovementType, LedgerReferenceType, PurchaseOrderStatus

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether


def _date_to_datetime(d: Optional[date]) -> Optional[datetime]:
    """Convert a date to a UTC midnight datetime so BSON can store it."""
    if d is None:
        return None
    if isinstance(d, datetime):
        return d
    return datetime(d.year, d.month, d.day, tzinfo=timezone.utc)


class PurchaseOrderService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = PurchaseOrderRepository(db)
        self.supplier_repo = SupplierRepository(db)
        self.product_repo = ProductRepository(db)
        self.frame_variant_repo = FrameVariantRepository(db)
        self.stock_receipt_repo = StockReceiptRepository(db)
        self.user_repo = UserRepository(db)
        self.supplier_invoice_repo = SupplierInvoiceRepository(db)
        self.supplier_payment_repo = SupplierPaymentRepository(db)
        self.company_profile_service = CompanyProfileService(db)
        self.inventory_service = InventoryMovementService(db)

    async def list_purchase_orders(self, page: int, page_size: int, supplier_id: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None):
        skip = (page - 1) * page_size
        search = (search or "").strip() or None
        matching_item_ids = await self._catalogue_ids_matching(search) if search else None
        orders, total = await self.repo.list_purchase_orders(
            skip=skip, limit=page_size, supplier_id=supplier_id, status=status,
            search=search, matching_item_ids=matching_item_ids,
        )
        total_pages = math.ceil(total / page_size)
        invoices = await self._invoice_summaries([order.id for order in orders])
        advances = await self.supplier_payment_repo.sum_unapplied_advances([order.id for order in orders])
        return PaginatedResponse(
            data=[await self._to_response(order, invoices, advances) for order in orders],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def _get_supplier(self, supplier_id: str):
        supplier = await self.supplier_repo.get_by_supplier_id(supplier_id)
        if not supplier:
            raise NotFoundException(f"Supplier with ID {supplier_id} not found")
        return supplier

    @staticmethod
    def _variant_label(variant) -> dict:
        ref = variant.frame_master_ref
        name = " ".join(part for part in [getattr(ref, "brand", None), getattr(ref, "model_code", None)] if part)
        detail = " · ".join(part for part in [variant.color, f"{variant.eye_size} mm" if variant.eye_size else None] if part)
        return {"item_type": "frame", "item_name": name or variant.sku, "item_detail": detail or None, "sku": variant.sku}

    @staticmethod
    def _product_label(product) -> dict:
        category = getattr(product.category, "value", product.category) or ""
        return {
            "item_type": "product",
            "item_name": product.name,
            "item_detail": str(category).replace("_", " ").capitalize() or None,
            "sku": product.sku,
        }

    async def _build_lines(self, items, order_id: str, item_prefix: str) -> tuple[list, float, float]:
        """Check every line exists, name it and price it. Returns (lines, subtotal, line discounts)."""
        variants = {
            v.variant_id: v
            for v in await self.frame_variant_repo.get_many_by_variant_ids([i.frame_variant_id for i in items if i.frame_variant_id])
        }
        products = {
            p.product_id: p
            for p in await self.product_repo.get_many_by_product_ids([i.product_id for i in items if not i.frame_variant_id])
        }
        lines = []
        subtotal = 0.0
        line_discount_total = 0.0
        for index, item in enumerate(items, start=1):
            if item.frame_variant_id:
                variant = variants.get(item.frame_variant_id)
                if not variant:
                    raise NotFoundException(f"Frame variant with ID {item.frame_variant_id} not found")
                resolved_product_id = variant.variant_id
                label = self._variant_label(variant)
            else:
                product = products.get(item.product_id)
                if not product:
                    raise NotFoundException(f"Product with ID {item.product_id} not found")
                resolved_product_id = product.product_id
                label = self._product_label(product)

            line_subtotal = item.quantity * item.unit_cost
            line_discount_amount = self._calculate_line_discount(
                line_subtotal=line_subtotal,
                line_discount_type=item.line_discount_type,
                line_discount_value=item.line_discount_value,
            )
            lines.append(PurchaseOrderItemModel(
                id=generate_id(item_prefix, index),
                purchase_order_id=order_id,
                product_id=resolved_product_id,
                frame_variant_id=item.frame_variant_id,
                supplier_sku=item.supplier_sku,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                line_discount_type=item.line_discount_type,
                line_discount_value=item.line_discount_value,
                line_discount_amount=line_discount_amount,
                total_price=max(0.0, line_subtotal - line_discount_amount),
                **label,
            ))
            subtotal += line_subtotal
            line_discount_total += line_discount_amount
        return lines, subtotal, line_discount_total

    async def _order_fields(self, data: PurchaseOrderCreate, supplier, company_profile, order_id: str, item_prefix: str) -> dict:
        """Everything about an order that comes from what was entered (shared by create and draft edits)."""
        item_models, subtotal, line_discount_total = await self._build_lines(data.items, order_id, item_prefix)

        summary_input = data.summary or None
        tax_rate = summary_input.tax_rate if summary_input else 0.0
        shipping_cost = summary_input.shipping_cost if summary_input else 0.0
        po_discount = summary_input.discount if summary_input else 0.0
        taxable_amount = max(0.0, subtotal - line_discount_total - po_discount)
        tax_amount = taxable_amount * tax_rate
        total_amount = taxable_amount + tax_amount + shipping_cost

        supplier_information = SupplierInformationModel(
            supplier_name=supplier.supplier_name,
            company_name=supplier.company_name,
            contact_person=supplier.contact_person,
            phone=supplier.phone,
            email=str(supplier.email) if supplier.email else None,
            address=supplier.address,
            supplier_id=supplier.id,
        )

        buyer_payload = company_profile.dict(exclude={"id", "created_at", "updated_at"})
        if data.buyer_information:
            buyer_payload.update(data.buyer_information.dict(exclude_unset=True))
        buyer_information = BuyerInformationModel(
            company_name=buyer_payload.get("company_name"),
            company_logo=buyer_payload.get("company_logo") or "Logo.png",
            company_address=buyer_payload.get("address") or buyer_payload.get("company_address"),
            phone=buyer_payload.get("phone"),
            email=buyer_payload.get("email"),
            tax_number=buyer_payload.get("tax_number"),
        )

        shipping_dict = {
            "ship_to_location": getattr(company_profile, "default_ship_to_location", None),
            "delivery_address": getattr(company_profile, "default_delivery_address", None) or getattr(company_profile, "address", None),
            "receiving_department": getattr(company_profile, "default_receiving_department", None),
            "delivery_instructions": getattr(company_profile, "default_delivery_instructions", None),
        }
        if data.shipping_information:
            for key, value in data.shipping_information.dict().items():
                if isinstance(value, str):
                    cleaned = value.strip()
                    if cleaned:
                        shipping_dict[key] = cleaned
                elif value is not None:
                    shipping_dict[key] = value

        payment_terms = PaymentTermsModel(currency="LKR")
        if data.payment_terms:
            payment_dict = data.payment_terms.dict()
            payment_dict["currency"] = "LKR"
            payment_terms = PaymentTermsModel(**payment_dict)
        elif getattr(supplier, "payment_terms", None):
            # Default to the terms agreed with this supplier
            payment_terms = PaymentTermsModel(payment_terms=supplier.payment_terms, currency="LKR")

        return {
            "total_amount": round(total_amount, 2),
            "items": item_models,
            "buyer_information": buyer_information,
            "supplier_information": supplier_information,
            "shipping_information": ShippingInformationModel(**shipping_dict),
            "order_summary": OrderSummaryModel(
                subtotal=round(subtotal, 2),
                line_discount_total=round(line_discount_total, 2),
                tax_rate=round(tax_rate, 4),
                tax_amount=round(tax_amount, 2),
                shipping_cost=round(shipping_cost, 2),
                discount=round(po_discount, 2),
                total_amount=round(total_amount, 2),
            ),
            "payment_terms": payment_terms,
            "notes": NotesModel(**data.notes.dict()) if data.notes else None,
            "authorization": AuthorizationModel(**data.authorization.dict()) if data.authorization else None,
            "footer": FooterModel(**data.footer.dict()) if data.footer else None,
        }

    async def _catalogue_ids_matching(self, text: str) -> list[str]:
        """Frame variants and products whose name, model or SKU matches the search text."""
        pattern = {"$regex": re.escape(text), "$options": "i"}
        variants = await self.frame_variant_repo.get_many({"$or": [
            {"sku": pattern}, {"color": pattern},
            {"frame_master_ref.brand": pattern}, {"frame_master_ref.model_code": pattern}, {"frame_master_ref.frame_name": pattern},
        ]}, limit=300, projection={"variant_id": 1})
        products = await self.product_repo.get_many(
            {"$or": [{"name": pattern}, {"sku": pattern}]}, limit=300, projection={"product_id": 1},
        )
        return [v["variant_id"] for v in variants if v.get("variant_id")] + [p["product_id"] for p in products if p.get("product_id")]

    async def create_purchase_order(self, data: PurchaseOrderCreate, created_by: str) -> PurchaseOrderResponse:
        supplier = await self._get_supplier(data.supplier_id)
        company_profile = await self.company_profile_service.get_company_profile()

        next_number = await self.repo.count({}) + 1
        order_id = generate_id("PO", next_number)
        fields = await self._order_fields(data, supplier, company_profile, order_id, f"POI{next_number}")

        order_model = PurchaseOrderModel(
            id=order_id,
            supplier_id=data.supplier_id,
            order_date=data.order_date,
            expected_delivery_date=data.expected_delivery_date,
            status="Draft",
            created_by=created_by,
            is_locked=False,
            **fields,
        )
        doc = order_model.dict()
        # Convert date -> datetime so BSON/Motor can store them
        doc["expected_delivery_date"] = _date_to_datetime(doc.get("expected_delivery_date"))
        if doc.get("authorization") and doc["authorization"].get("approval_date"):
            doc["authorization"]["approval_date"] = _date_to_datetime(doc["authorization"].get("approval_date"))
        await self.repo.create(doc)
        # Fetch freshly from DB to get server-set timestamps
        created_order = await self.repo.get_by_order_id(order_id)
        return await self._to_response(created_order)

    async def update_draft(self, order_id: str, data: PurchaseOrderCreate, updated_by: str) -> PurchaseOrderResponse:
        """Rewrite a draft PO from the order form. Once approved, an order is fixed."""
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        if order.status != PurchaseOrderStatus.DRAFT.value:
            raise BadRequestException(
                f"Only draft purchase orders can be edited; {order_id} is already {order.status.lower()}"
            )

        supplier = await self._get_supplier(data.supplier_id)
        company_profile = await self.company_profile_service.get_company_profile()
        number = int("".join(ch for ch in order_id if ch.isdigit()) or 0)
        fields = await self._order_fields(data, supplier, company_profile, order_id, f"POI{number}")

        update = {
            key: ([line.dict() for line in value] if key == "items" else value.dict() if hasattr(value, "dict") else value)
            for key, value in fields.items()
        }
        update.update({
            "supplier_id": data.supplier_id,
            "order_date": data.order_date,
            "expected_delivery_date": _date_to_datetime(data.expected_delivery_date),
        })
        await self.repo.update({"id": order_id}, update)
        return await self._to_response(await self.repo.get_by_order_id(order_id))

    async def get_purchase_order(self, order_id: str) -> PurchaseOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        return await self._to_response(order)

    def _allowed_status_transitions(self) -> dict:
        return {
            PurchaseOrderStatus.DRAFT: {PurchaseOrderStatus.APPROVED},
            PurchaseOrderStatus.APPROVED: {PurchaseOrderStatus.ORDERED},
            # Ordered → (Partially) Received happens only through apply_receipt
            PurchaseOrderStatus.ORDERED: {PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED},
            # A short-shipped PO can be closed without receiving the rest
            PurchaseOrderStatus.PARTIALLY_RECEIVED: {PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CLOSED},
            PurchaseOrderStatus.RECEIVED: {PurchaseOrderStatus.CLOSED},
            PurchaseOrderStatus.CLOSED: set(),
        }

    # Statuses that still accept deliveries
    RECEIVABLE_STATUSES = (PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.PARTIALLY_RECEIVED)

    async def update_status(self, order_id: str, status: str, updated_by: str = "system") -> PurchaseOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")

        try:
            new_status = PurchaseOrderStatus(status)
        except ValueError:
            valid = [s.value for s in PurchaseOrderStatus]
            raise BadRequestException(f"Invalid status '{status}'. Valid values: {valid}")

        if new_status in (PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED):
            raise BadRequestException(
                "A purchase order becomes received by receiving its stock "
                "(Receive on the purchase order, or a goods receipt linked to it), not by changing its status"
            )

        try:
            old_status = PurchaseOrderStatus(order.status)
        except ValueError:
            old_status = PurchaseOrderStatus.DRAFT

        allowed = self._allowed_status_transitions().get(old_status, set())
        if new_status not in allowed:
            labels = [
                "receive stock" if s in (PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.PARTIALLY_RECEIVED) else s.value
                for s in sorted(allowed, key=lambda st: st.value)
            ]
            allowed_labels = ", ".join(dict.fromkeys(labels)) or "none"
            raise BadRequestException(
                f"Cannot move from '{old_status.value}' to '{new_status.value}'. "
                f"Allowed next steps: {allowed_labels}"
            )

        now = datetime.now(timezone.utc)
        history_entry = {
            "status": new_status.value,
            "updated_at": now,
            "updated_by": updated_by,
        }
        update_fields: dict = {
            "status": new_status.value,
            "updated_at": now,
        }

        if new_status == PurchaseOrderStatus.APPROVED:
            authorization = order.authorization or AuthorizationModel()
            authorization.approved_by = updated_by
            authorization.signature = "sign.png"
            authorization.approval_date = now
            update_fields["is_locked"] = True
            update_fields["authorization"] = authorization.dict()

        elif new_status == PurchaseOrderStatus.ORDERED:
            update_fields["is_locked"] = True

        elif new_status == PurchaseOrderStatus.CLOSED:
            update_fields["is_locked"] = True

        await self.repo.update({"id": order_id}, update_fields)
        await self.repo.push_status_history(order_id, history_entry)

        updated = await self.repo.get_by_order_id(order_id)
        return await self._to_response(updated)

    async def receive_stock(self, order_id: str, receipt: ReceiveStockRequest, received_by: str) -> PurchaseOrderResponse:
        """PO "Receive" endpoint: ``received_quantity`` is what arrived in this delivery."""
        await self.apply_receipt(
            order_id,
            [(item.product_id, item.received_quantity) for item in receipt.items],
            received_by,
        )
        updated = await self.repo.get_by_order_id(order_id)
        return await self._to_response(updated)

    async def apply_receipt(
        self,
        order_id: str,
        lines: list[tuple[str, int]],
        received_by: str,
        reference_type: LedgerReferenceType = LedgerReferenceType.PURCHASE_ORDER,
        reference_id: Optional[str] = None,
    ) -> PurchaseOrderModel:
        """The one receiving path for a purchase order (PO receive and PO-linked GRN commits).

        ``lines`` are ``(po_line_product_id, qty_received_now)``; for frame lines the
        product_id is the variant_id. Quantities are checked against what is still
        outstanding per line, the PO's received quantities and status (Received or
        Partially Received) are written in one guarded update so the same delivery
        cannot be booked twice, then stock is moved with PURCHASE_IN movements that
        reference ``reference_type``/``reference_id`` (defaults to this PO).
        """
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        receivable = [s.value for s in self.RECEIVABLE_STATUSES]
        if order.status not in receivable:
            raise BadRequestException(
                f"Purchase order {order_id} is '{order.status}'; only Ordered or Partially Received orders can be received"
            )

        index_by_id = {item.product_id: idx for idx, item in enumerate(order.items)}
        received_now: dict[int, int] = {}
        for item_id, qty in lines:
            idx = index_by_id.get(item_id)
            if idx is None:
                raise BadRequestException(f"{item_id} is not part of purchase order {order_id}")
            if qty < 0:
                raise BadRequestException(f"Received quantity for {item_id} cannot be negative")
            received_now[idx] = received_now.get(idx, 0) + int(qty)

        for idx, qty in received_now.items():
            line = order.items[idx]
            outstanding = max(line.quantity - line.received_quantity, 0)
            if qty > outstanding:
                raise BadRequestException(
                    f"Cannot receive {qty} of {line.product_id} on {order_id}: ordered {line.quantity}, "
                    f"already received {line.received_quantity}, outstanding {outstanding}"
                )

        received_now = {idx: qty for idx, qty in received_now.items() if qty > 0}
        if not received_now:
            raise BadRequestException("Enter a received quantity for at least one line")

        # Fail before touching anything if an item can no longer take stock
        for idx in received_now:
            line = order.items[idx]
            item = (
                await self.frame_variant_repo.get_by_variant_id(line.product_id)
                if line.frame_variant_id
                else await self.product_repo.get_by_product_id(line.product_id)
            )
            if not item or not item.is_active:
                raise BadRequestException(f"{line.product_id} on {order_id} no longer exists or is inactive")

        changes = {
            idx: (order.items[idx].received_quantity, order.items[idx].received_quantity + qty)
            for idx, qty in received_now.items()
        }
        fully_received = all(
            changes.get(idx, (0, item.received_quantity))[1] >= item.quantity
            for idx, item in enumerate(order.items)
        )
        new_status = PurchaseOrderStatus.RECEIVED if fully_received else PurchaseOrderStatus.PARTIALLY_RECEIVED

        claimed = await self.repo.record_received_quantities(order_id, receivable, changes, new_status.value)
        if not claimed:
            raise BadRequestException(f"Purchase order {order_id} was updated while receiving; reload it and try again")

        try:
            await self.inventory_service.apply_stock_in(
                [(order.items[idx].product_id, qty) for idx, qty in received_now.items()],
                reference_type,
                reference_id or order_id,
                received_by,
            )
        except Exception:
            # Stock was rolled back by apply_stock_in; put the PO back as it was
            await self.repo.record_received_quantities(
                order_id, [new_status.value], {idx: (new, old) for idx, (old, new) in changes.items()}, order.status,
            )
            raise

        now = datetime.now(timezone.utc)
        receipt_id = generate_id("SR", (await self.stock_receipt_repo.count({})) + 1)
        receipt_model = StockReceiptModel(
            id=receipt_id,
            purchase_order_id=order_id,
            supplier_id=order.supplier_id,
            received_by=received_by,
            received_at=now,
            items=[
                StockReceiptItemModel(
                    product_id=order.items[idx].product_id,
                    ordered_quantity=order.items[idx].quantity,
                    received_quantity=qty,
                )
                for idx, qty in received_now.items()
            ],
        )
        await self.stock_receipt_repo.create(receipt_model.dict())

        if new_status.value != order.status:
            await self.repo.push_status_history(order_id, {
                "status": new_status.value,
                "updated_at": now,
                "updated_by": received_by,
            })
        return await self.repo.get_by_order_id(order_id)

    async def generate_purchase_order_pdf(self, order_id: str) -> tuple[bytes, str]:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")

        company_profile = await self.company_profile_service.get_company_profile()
        lines = [PurchaseOrderItemResponse(**item.dict()) for item in order.items]
        await self._fill_item_labels(lines)

        approver_name = None
        approved_by = order.authorization.approved_by if order.authorization else None
        if approved_by:
            approver = await self.user_repo.get_by_user_id(approved_by)
            approver_name = approver.name if approver else approved_by

        pdf_bytes = self._build_po_pdf(order, lines, company_profile, approver_name)
        return pdf_bytes, f"{order.id}.pdf"

    async def generate_purchase_record_pdf(self, order_id: str) -> tuple[bytes, str]:
        """One PDF for the file: the order, what arrived, the supplier's invoice and every payment."""
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")

        company_profile = await self.company_profile_service.get_company_profile()
        lines = [PurchaseOrderItemResponse(**item.dict()) for item in order.items]
        await self._fill_item_labels(lines)
        approver_name = None
        if order.authorization and order.authorization.approved_by:
            approver = await self.user_repo.get_by_user_id(order.authorization.approved_by)
            approver_name = approver.name if approver else order.authorization.approved_by

        invoice = (await self.supplier_invoice_repo.get_latest_by_purchase_order_ids([order.id])).get(order.id)
        invoice_ids = [invoice.id] if invoice else []
        payments, _ = await self.supplier_payment_repo.list_payments(
            skip=0, limit=0, purchase_order_id=order.id, order_invoice_ids=invoice_ids,
        )
        receipt = await self.stock_receipt_repo.get_latest_by_purchase_order_id(order.id)
        record = {
            "invoice": invoice,
            # Oldest first; same-day payments in the order they were recorded
            "payments": sorted(payments, key=lambda p: (p.payment_date, p.created_at or p.payment_date)),
            "received_at": receipt.received_at if receipt else None,
        }
        pdf_bytes = self._build_po_pdf(order, lines, company_profile, approver_name, record=record)
        return pdf_bytes, f"{order.id}-record.pdf"

    async def _fill_item_labels(self, items: list) -> None:
        """Older orders were saved without item names; look them up (two queries at most)."""
        missing = [item for item in items if not item.item_name]
        if not missing:
            return
        variants = {
            v.variant_id: v
            for v in await self.frame_variant_repo.get_many_by_variant_ids([i.frame_variant_id or i.product_id for i in missing])
        }
        products = {
            p.product_id: p
            for p in await self.product_repo.get_many_by_product_ids([i.product_id for i in missing if i.product_id not in variants])
        }
        for item in missing:
            key = item.frame_variant_id or item.product_id
            if key in variants:
                label = self._variant_label(variants[key])
            elif item.product_id in products:
                label = self._product_label(products[item.product_id])
            else:
                continue
            for field, value in label.items():
                setattr(item, field, value)

    async def _invoice_summaries(self, order_ids: list[str]) -> dict[str, PurchaseOrderInvoiceSummary]:
        """Each order's supplier invoice and what's been paid on it (two queries for any number of orders)."""
        invoices = await self.supplier_invoice_repo.get_latest_by_purchase_order_ids(order_ids)
        paid = await self.supplier_payment_repo.sum_paid_by_invoice([inv.id for inv in invoices.values()])
        summaries = {}
        for order_id, invoice in invoices.items():
            invoice_paid = paid.get(invoice.id, 0.0)
            summaries[order_id] = PurchaseOrderInvoiceSummary(
                id=invoice.id,
                invoice_number=invoice.invoice_number,
                status=invoice.status,
                total_amount=invoice.total_amount,
                paid_amount=round(invoice_paid, 2),
                balance_due=round(max(0.0, invoice.total_amount - invoice_paid), 2),
                due_date=invoice.due_date,
            )
        return summaries

    # Statuses an order can be emailed in: approved onwards, until it's closed
    SENDABLE_STATUSES = (
        PurchaseOrderStatus.APPROVED,
        PurchaseOrderStatus.ORDERED,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
    )

    async def send_to_supplier(
        self,
        order_id: str,
        request: PurchaseOrderSendRequest,
        sent_by: str,
        email_service: Optional[EmailService] = None,
    ) -> PurchaseOrderResponse:
        """Email the PO PDF to the supplier; sending an approved order places it (status → Ordered)."""
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")
        if order.status == PurchaseOrderStatus.DRAFT.value:
            raise BadRequestException("Approve the purchase order before sending it — a draft prints as DRAFT")
        if order.status not in [s.value for s in self.SENDABLE_STATUSES]:
            raise BadRequestException(f"{order_id} is {order.status.lower()} and can't be sent")

        pdf_bytes, filename = await self.generate_purchase_order_pdf(order_id)
        company = await self.company_profile_service.get_company_profile()
        company_name = company.company_name or settings.APP_NAME
        subject = (request.subject or "").strip() or f"Purchase order {order.id} from {company_name}"
        body = (request.message or "").strip() or self._default_send_message(order, company_name, getattr(company, "phone", None))

        try:
            await (email_service or EmailService()).send_purchase_order(
                recipient_email=str(request.to),
                subject=subject,
                body=body,
                pdf_bytes=pdf_bytes,
                filename=filename,
                cc=str(request.cc) if request.cc else None,
                reply_to=getattr(company, "email", None) or None,
            )
        except RuntimeError:
            raise BadRequestException(
                "Email isn't set up on the server yet. Download the PDF and send it yourself, then mark the order as ordered."
            )
        except Exception:
            raise BadRequestException(
                "The email couldn't be sent. Check the address and try again, or download the PDF and send it yourself."
            )

        await self.repo.update({"id": order_id}, {
            "sent_at": datetime.now(timezone.utc),
            "sent_to": str(request.to),
            "sent_by": sent_by,
        })
        if request.mark_ordered and order.status == PurchaseOrderStatus.APPROVED.value:
            return await self.update_status(order_id, PurchaseOrderStatus.ORDERED.value, sent_by)
        return await self.get_purchase_order(order_id)

    def _default_send_message(self, order: PurchaseOrderModel, company_name: str, company_phone: Optional[str]) -> str:
        supplier = order.supplier_information
        greeting = (supplier.contact_person or supplier.supplier_name) if supplier else None
        shipping = order.shipping_information
        units = sum(item.quantity for item in order.items)
        lines = [
            f"Dear {greeting or 'Sir/Madam'},",
            "",
            f"Please find attached our purchase order {order.id} for {units} unit{'s' if units != 1 else ''}, "
            f"totalling {self._lkr(order.total_amount)}.",
        ]
        if order.expected_delivery_date:
            lines.append(f"We'd like it delivered by {self._fmt_date(order.expected_delivery_date)}.")
        if shipping and shipping.delivery_address:
            lines.append(f"Delivery address: {shipping.delivery_address}")
        lines += ["", "Please confirm the order and the delivery date.", "", "Thank you,", company_name]
        if company_phone:
            lines.append(company_phone)
        return "\n".join(lines)

    async def _to_response(self, order: PurchaseOrderModel, invoice_summaries: Optional[dict] = None, advances: Optional[dict] = None) -> PurchaseOrderResponse:
        def dump_value(value):
            if value is None:
                return None
            if hasattr(value, "model_dump"):
                return value.model_dump(mode="json")
            if hasattr(value, "dict"):
                return value.dict()
            return value

        receipt = await self.stock_receipt_repo.get_latest_by_purchase_order_id(order.id)
        receipt_summary = None
        if receipt:
            receipt_summary = PurchaseOrderReceiptSummary(
                id=receipt.id,
                received_by=receipt.received_by,
                received_at=receipt.received_at,
                items=[
                    ReceiveStockResponseItem(
                        product_id=item.product_id,
                        ordered_quantity=item.ordered_quantity,
                        received_quantity=item.received_quantity,
                    )
                    for item in receipt.items
                ],
            )

        items = [PurchaseOrderItemResponse(**item.dict()) for item in order.items]
        await self._fill_item_labels(items)
        invoices = invoice_summaries if invoice_summaries is not None else await self._invoice_summaries([order.id])
        if advances is None:
            advances = await self.supplier_payment_repo.sum_unapplied_advances([order.id])

        return PurchaseOrderResponse(
            id=order.id,
            supplier_id=order.supplier_id,
            order_date=order.order_date,
            expected_delivery_date=order.expected_delivery_date,
            status=order.status,
            total_amount=order.total_amount,
            created_by=order.created_by,
            is_locked=order.is_locked,
            items=items,
            buyer_information=dump_value(order.buyer_information),
            supplier_information=dump_value(order.supplier_information),
            shipping_information=dump_value(order.shipping_information),
            order_summary=dump_value(order.order_summary),
            payment_terms=dump_value(order.payment_terms),
            notes=dump_value(order.notes),
            authorization=dump_value(order.authorization),
            footer=dump_value(order.footer),
            receipt_summary=dump_value(receipt_summary),
            supplier_invoice=invoices.get(order.id),
            advance_paid=round(advances.get(order.id, 0.0), 2),
            sent_at=order.sent_at,
            sent_to=order.sent_to,
            sent_by=order.sent_by,
            status_history=[entry.dict() for entry in order.status_history] if order.status_history else [],
            created_at=order.created_at,
            updated_at=order.updated_at,
        )

    @staticmethod
    def _calculate_line_discount(line_subtotal: float, line_discount_type: Optional[str], line_discount_value: float) -> float:
        if line_discount_value <= 0:
            return 0.0
        if line_discount_type == "percent":
            if line_discount_value > 100:
                raise BadRequestException("Line discount percent cannot exceed 100")
            return round(line_subtotal * (line_discount_value / 100.0), 2)
        if line_discount_type == "amount":
            return round(min(line_discount_value, line_subtotal), 2)
        raise BadRequestException("line_discount_type must be 'percent' or 'amount' when discount is provided")

    @staticmethod
    def _lkr(value: float) -> str:
        return f"LKR {value:,.2f}"

    def _resolve_asset_path(self, candidate: Optional[str]) -> Optional[Path]:
        if not candidate:
            return None

        service_file = Path(__file__).resolve()
        workspace_root = service_file.parents[3]
        backend_root = service_file.parents[2]
        path_candidate = Path(candidate)
        candidates = [
            path_candidate,
            workspace_root / candidate,
            backend_root / candidate,
            workspace_root / "Frontend" / "public" / candidate,
            workspace_root / "backend" / "static" / candidate,
        ]
        for path in candidates:
            if path.exists() and path.is_file():
                return path
        return None

    # Brand accent shared with the on-screen preview (Frontend PurchaseOrderPreview.tsx)
    ACCENT = "#007595"
    DEFAULT_LOGO = "brand/logo-full-primary.png"
    DEFAULT_POLICY_NOTE = "All items are subject to quality inspection upon receipt."
    DEFAULT_CONTACT_NOTE = "For questions about this order, please contact us using the details above."

    @staticmethod
    def _fmt_date(value: Optional[datetime]) -> str:
        return value.strftime("%d %b %Y") if value else "-"

    METHOD_LABELS = {"cash": "Cash", "bank-transfer": "Bank transfer", "cheque": "Cheque", "card": "Card", "upi": "UPI"}

    def _build_po_pdf(
        self,
        order: PurchaseOrderModel,
        lines: list,
        company_profile,
        approver_name: Optional[str],
        record: Optional[dict] = None,
    ) -> bytes:
        """
        Supplier copy of the order (mirrors the on-screen preview; internal notes never print).
        With ``record`` it becomes the purchase record for your own files: the same order plus
        what was received, the supplier's invoice and every payment made, advances included.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
            title=f"Purchase {'Record' if record else 'Order'} {order.id}",
        )
        ink = colors.HexColor("#0F172A")
        slate = colors.HexColor("#64748B")
        hairline = colors.HexColor("#E2E8F0")
        content_width = 178 * mm

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("POTitle", parent=styles["Heading1"], fontSize=22, leading=26, textColor=ink, spaceAfter=0)
        label = ParagraphStyle("Label", parent=styles["Normal"], fontSize=8.5, leading=12, textColor=slate)
        small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, leading=13, textColor=ink)
        normal = ParagraphStyle("NormalText", parent=styles["Normal"], fontSize=10, leading=14, textColor=ink)
        muted = ParagraphStyle("Muted", parent=styles["Normal"], fontSize=8.5, leading=12, textColor=slate)
        right_small = ParagraphStyle("RightSmall", parent=small, alignment=2)
        head_cell = ParagraphStyle("HeadCell", parent=label, fontName="Helvetica")
        head_cell_right = ParagraphStyle("HeadCellRight", parent=head_cell, alignment=2)

        buyer = order.buyer_information or BuyerInformationModel()
        supplier = order.supplier_information or SupplierInformationModel(supplier_id=order.supplier_id)
        shipping = order.shipping_information or ShippingInformationModel()
        summary = order.order_summary or OrderSummaryModel(total_amount=order.total_amount)
        payment = order.payment_terms or PaymentTermsModel(currency="LKR")
        notes = order.notes or NotesModel()
        authorization = order.authorization or AuthorizationModel()
        footer = order.footer or FooterModel()
        is_draft = order.status == PurchaseOrderStatus.DRAFT.value
        company_name = buyer.company_name or company_profile.company_name or settings.APP_NAME

        story = []

        # ── Header: title and number | logo ──────────────────────────────
        logo_name = company_profile.company_logo if company_profile.company_logo not in (None, "", "Logo.png") else self.DEFAULT_LOGO
        logo_path = self._resolve_asset_path(logo_name) or self._resolve_asset_path("Logo.png")
        logo = Image(str(logo_path), width=24 * mm, height=18.4 * mm, kind="proportional") if logo_path else Paragraph("", normal)
        invoice = record.get("invoice") if record else None
        header_left = [
            Paragraph("PURCHASE RECORD" if record else "PURCHASE ORDER", title_style),
            Paragraph(f"PO number &nbsp;<font color='#0F172A'>#{order.id}</font>", muted),
        ]
        if invoice:
            header_left.append(Paragraph(f"Supplier invoice &nbsp;<font color='#0F172A'>#{invoice.invoice_number}</font>", muted))
        if is_draft:
            header_left.append(Spacer(1, 1.5 * mm))
            header_left.append(Paragraph("<font color='#B45309'><b>DRAFT</b> — not yet approved</font>", muted))
        header_tbl = Table([[header_left, logo]], colWidths=[content_width - 30 * mm, 30 * mm])
        header_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6 * mm),
            ("LINEBELOW", (0, 0), (-1, 0), 0.75, hairline),
        ]))
        story.append(header_tbl)
        story.append(Spacer(1, 6 * mm))

        def stack(title: str, rows: list[str]) -> list:
            return [Paragraph(title, label)] + [Paragraph(row, small) for row in rows if row]

        def columns(*cells: list) -> Table:
            width = content_width / len(cells)
            table = Table([list(cells)], colWidths=[width] * len(cells))
            table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]))
            return table

        # ── Ordered by | supplier ─────────────────────────────────────────
        story.append(columns(
            stack("Ordered by", [
                f"<b>{company_name}</b>",
                buyer.company_address or company_profile.address or "",
                buyer.phone or company_profile.phone or "",
                buyer.email or company_profile.email or "",
                f"Tax no. {buyer.tax_number or company_profile.tax_number}" if (buyer.tax_number or company_profile.tax_number) else "",
            ]),
            stack("Supplier", [
                f"<b>{supplier.supplier_name or order.supplier_id}</b>",
                supplier.company_name if supplier.company_name and supplier.company_name != supplier.supplier_name else "",
                f"Attn: {supplier.contact_person}" if supplier.contact_person else "",
                supplier.phone or "",
                supplier.email or "",
                supplier.address or "",
            ]),
        ))
        story.append(Spacer(1, 5 * mm))

        # ── Dates and terms ───────────────────────────────────────────────
        story.append(columns(
            stack("Order date", [f"<b>{self._fmt_date(order.order_date)}</b>"]),
            stack("Received" if record and record.get("received_at") else "Expected delivery", [
                f"<b>{self._fmt_date(record['received_at'] if record and record.get('received_at') else order.expected_delivery_date)}</b>"
            ]),
            stack("Payment terms", [f"<b>{payment.payment_terms or 'As agreed'}</b>"]),
        ))
        story.append(Spacer(1, 5 * mm))
        if record:
            invoice_status = {"Paid": "Paid", "Partial": "Part paid"}.get(invoice.status, "Unpaid") if invoice else "Not invoiced yet"
            story.append(columns(
                stack("Invoice date", [f"<b>{self._fmt_date(invoice.invoice_date) if invoice else '-'}</b>"]),
                stack("Invoice due", [f"<b>{self._fmt_date(invoice.due_date) if invoice else '-'}</b>"]),
                stack("Order status", [f"<b>{order.status} · {invoice_status}</b>"]),
            ))
            story.append(Spacer(1, 5 * mm))

        # ── Deliver to ────────────────────────────────────────────────────
        deliver_to = [
            f"<b>{' · '.join(p for p in [shipping.ship_to_location, shipping.receiving_department] if p)}</b>"
            if (shipping.ship_to_location or shipping.receiving_department) else "",
            shipping.delivery_address or "",
            f"Instructions: {shipping.delivery_instructions}" if shipping.delivery_instructions else "",
        ]
        if any(deliver_to):
            story.append(KeepTogether(columns(stack("Deliver to", deliver_to))))
            story.append(Spacer(1, 7 * mm))

        # ── Line items ────────────────────────────────────────────────────
        kind_labels = {"frame": "Frame", "product": "Product"}
        story.append(columns([Paragraph("Items ordered" + (", received and billed" if record else ""), label), Spacer(1, 1.5 * mm)]))
        if record:
            # Ordered · received · billed side by side, so mismatches stand out
            billed = {item.product_id: item for item in (invoice.items if invoice else [])}
            untracked = order.status in ("Received", "Closed") and not any(line.received_quantity for line in lines)
            record_rows = [[
                Paragraph("Item", head_cell),
                Paragraph("Ordered", head_cell_right),
                Paragraph("Received", head_cell_right),
                Paragraph("Billed", head_cell_right),
                Paragraph("Unit cost", head_cell_right),
                Paragraph("Amount", head_cell_right),
            ]]
            for line in lines:
                bill = billed.get(line.product_id)
                received = line.quantity if untracked else min(line.received_quantity or 0, line.quantity)
                amount = bill.line_total if bill else (line.total_price or line.quantity * line.unit_cost)
                flag = (bill and bill.invoice_quantity != line.quantity) or received != line.quantity
                detail = " · ".join(part for part in [kind_labels.get(line.item_type or ""), line.item_detail, line.sku] if part)
                record_rows.append([
                    Paragraph(f"<b>{line.item_name or line.product_id}</b><br/><font size=7.5 color='#64748B'>{detail}</font>", small),
                    Paragraph(str(line.quantity), right_small),
                    Paragraph(f"<font color='{'#B45309' if received != line.quantity else '#0F172A'}'>{received}</font>", right_small),
                    Paragraph(f"<font color='{'#B45309' if flag and bill else '#0F172A'}'>{bill.invoice_quantity if bill else '-'}</font>", right_small),
                    Paragraph(self._lkr(bill.unit_price if bill else line.unit_cost), right_small),
                    Paragraph(f"<b>{self._lkr(amount)}</b>", right_small),
                ])
            record_table = Table(record_rows, colWidths=[70 * mm, 16 * mm, 18 * mm, 16 * mm, 29 * mm, 29 * mm], repeatRows=1)
            record_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
        item_rows = [[
            Paragraph("Item", head_cell),
            Paragraph("Qty", head_cell_right),
            Paragraph("Unit cost", head_cell_right),
            Paragraph("Amount", head_cell_right),
        ]]
        for line in lines:
            detail = " · ".join(part for part in [
                kind_labels.get(line.item_type or ""),
                line.item_detail,
                line.sku,
                f"{self._lkr(line.line_discount_amount)} off" if line.line_discount_amount else "",
            ] if part)
            item_rows.append([
                Paragraph(f"<b>{line.item_name or line.product_id}</b><br/><font size=7.5 color='#64748B'>{detail}</font>", small),
                Paragraph(str(line.quantity), right_small),
                Paragraph(self._lkr(line.unit_cost), right_small),
                Paragraph(f"<b>{self._lkr(line.total_price or line.quantity * line.unit_cost)}</b>", right_small),
            ])
        items_table = Table(item_rows, colWidths=[92 * mm, 16 * mm, 35 * mm, 35 * mm], repeatRows=1)
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(record_table if record else items_table)
        story.append(Spacer(1, 5 * mm))

        # ── Totals, with the approval beside them ─────────────────────────
        totals_rows = [[Paragraph("Subtotal", muted), Paragraph(self._lkr(summary.subtotal), right_small)]]
        if summary.line_discount_total:
            totals_rows.append([Paragraph("Line discounts", muted), Paragraph(f"-{self._lkr(summary.line_discount_total)}", right_small)])
        if summary.discount:
            totals_rows.append([Paragraph("Discount", muted), Paragraph(f"-{self._lkr(summary.discount)}", right_small)])
        if summary.tax_amount:
            totals_rows.append([Paragraph(f"Tax ({summary.tax_rate * 100:.1f}%)", muted), Paragraph(self._lkr(summary.tax_amount), right_small)])
        if summary.shipping_cost:
            totals_rows.append([Paragraph("Shipping", muted), Paragraph(self._lkr(summary.shipping_cost), right_small)])
        total_index = len(totals_rows)
        totals_rows.append([
            Paragraph(f"<font color='{self.ACCENT}'><b>Order total</b></font>", small),
            Paragraph(f"<font color='{self.ACCENT}'><b>{self._lkr(summary.total_amount or order.total_amount)}</b></font>", right_small),
        ])
        settled = False
        if record:
            # Where the money stands: the bill (or the order, before it's billed) less everything paid
            payments_made = record.get("payments") or []
            paid_total = round(sum(p.amount_paid for p in payments_made), 2)
            owed_on = invoice.total_amount if invoice else (summary.total_amount or order.total_amount)
            balance = round(max(0.0, owed_on - paid_total), 2)
            settled = owed_on > 0 and balance <= 0.005
            if invoice:
                totals_rows.append([Paragraph("Supplier invoice", muted), Paragraph(self._lkr(invoice.total_amount), right_small)])
            totals_rows.append([Paragraph("Paid", muted), Paragraph(f"-{self._lkr(paid_total)}", right_small)])
            balance_index = len(totals_rows)
            totals_rows.append([
                Paragraph("<b>Balance due</b>", small),
                Paragraph(f"<b>{self._lkr(balance)}</b>", right_small),
            ])
        totals_table = Table(totals_rows, colWidths=[38 * mm, 42 * mm])
        totals_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("BACKGROUND", (0, total_index), (-1, total_index), colors.HexColor("#E6F1F4")),
            ("TOPPADDING", (0, total_index), (-1, total_index), 5),
            ("BOTTOMPADDING", (0, total_index), (-1, total_index), 5),
            *([("LINEABOVE", (0, balance_index), (-1, balance_index), 0.75, hairline)] if record else []),
        ]))

        approval = [Paragraph("", normal)]
        if settled:
            # Fully paid: the same PAID seal as customer invoices
            from app.services.invoice_service import InvoiceService

            last_paid = max((p.payment_date for p in record.get("payments") or []), default=None)
            approval = [InvoiceService._paid_seal(last_paid)]
        elif authorization.approved_by and not is_draft:
            signature_path = self._resolve_asset_path(authorization.signature or "sign.png")
            approval = [Paragraph("Approved by", label)]
            if signature_path:
                approval.append(Image(str(signature_path), width=32 * mm, height=12 * mm, kind="proportional"))
            approval.append(Paragraph(f"<b>{approver_name or authorization.approved_by}</b>", small))
            approval.append(Paragraph(self._fmt_date(authorization.approval_date), muted))
        totals_wrap = Table([[approval, totals_table]], colWidths=[content_width - 80 * mm, 80 * mm])
        totals_wrap.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(KeepTogether(totals_wrap))
        story.append(Spacer(1, 6 * mm))

        # ── Payments (record only) ────────────────────────────────────────
        if record:
            payments_made = record.get("payments") or []
            pay_rows = [[
                Paragraph("Paid on", head_cell),
                Paragraph("For", head_cell),
                Paragraph("Method", head_cell),
                Paragraph("Reference", head_cell),
                Paragraph("Amount", head_cell_right),
            ]]
            for p in payments_made:
                pay_rows.append([
                    Paragraph(self._fmt_date(p.payment_date), small),
                    Paragraph("Advance on the order" if p.is_advance else "Against the invoice", small),
                    Paragraph(self.METHOD_LABELS.get(p.payment_method, p.payment_method), small),
                    Paragraph(p.reference_number or "-", small),
                    Paragraph(self._lkr(p.amount_paid), right_small),
                ])
            if len(pay_rows) == 1:
                pay_rows.append([Paragraph("<font color='#94A3B8'><i>Nothing paid yet</i></font>", small), "", "", "", ""])
            pay_table = Table(pay_rows, colWidths=[28 * mm, 46 * mm, 30 * mm, 40 * mm, 34 * mm], repeatRows=1)
            pay_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 1), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(KeepTogether([columns([Paragraph("Payments", label), Spacer(1, 1.5 * mm)]), pay_table]))
            story.append(Spacer(1, 6 * mm))

        # ── Note to the supplier ──────────────────────────────────────────
        if notes.supplier_notes:
            note = Table([[Paragraph(f"<b>Note:</b> {notes.supplier_notes}", small)]], colWidths=[content_width])
            note.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, hairline),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]))
            story.append(note)
            story.append(Spacer(1, 6 * mm))
        if record and notes.internal_notes:
            # The record is for your own files, so the internal note belongs on it
            story.append(columns(stack("Internal note", [notes.internal_notes])))
            story.append(Spacer(1, 6 * mm))

        closing_text = (
            f"Purchase record for {order.id}, printed {self._fmt_date(datetime.now(timezone.utc))}. For your records — not a copy for the supplier."
            if record
            else f"{footer.company_policy_note or self.DEFAULT_POLICY_NOTE} {footer.contact_information or self.DEFAULT_CONTACT_NOTE}"
        )
        closing = Table([[Paragraph(closing_text, muted)]], colWidths=[content_width])
        closing.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, hairline),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(closing)

        doc.build(story)
        return buffer.getvalue()
