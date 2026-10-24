from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from pathlib import Path
import io
import math

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable, KeepTogether,
)

from app.repositories.sales_order_repository import SalesOrderRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.prescription_repository import PrescriptionRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.frame_variant_repository import FrameVariantRepository
from app.repositories.basic_data_repository import OtherExpenseTypeRepository, LensMasterRepository
from app.schemas.sales_order import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
from app.schemas.responses import PaginatedResponse
from app.models.sales_order import SalesOrderModel, SalesOrderItemModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id
from app.services.audit_service import AuditService
from app.services.inventory_movement_service import InventoryMovementService
from app.services.transaction_service import TransactionService
from app.services.invoice_service import InvoiceService
from app.services.company_profile_service import CompanyProfileService
from app.services.barcode_service import generate_barcode_png
from app.schemas.inventory_movement import InventoryMovementCreate
from app.schemas.transaction import TransactionCreate
from app.schemas.invoice import InvoiceCreate
from app.models.invoice import InvoiceItem
from app.repositories.invoice_repository import InvoiceRepository
from app.config.settings import settings
from app.utils.constants import (
    SalesOrderStatus,
    InventoryMovementType,
    LedgerReferenceType,
    LedgerTransactionType,
    PaymentStatus,
)
from datetime import datetime, date, timezone
from pymongo import ReturnDocument


class SalesOrderService:
    def __init__(self, db):
        self.repo = SalesOrderRepository(db)
        self.patient_repo = PatientRepository(db)
        self.prescription_repo = PrescriptionRepository(db)
        self.product_repo = ProductRepository(db)
        self.frame_variant_repo = FrameVariantRepository(db)
        self.other_expense_repo = OtherExpenseTypeRepository(db)
        self.lens_master_repo = LensMasterRepository(db)
        self.audit_service = AuditService(db)
        self.inventory_movement_service = InventoryMovementService(db)
        self.transaction_service = TransactionService(db)
        self.invoice_service = InvoiceService(db)
        self.invoice_repo = InvoiceRepository(db)
        self.company_profile_service = CompanyProfileService(db)
        self.db = db

    async def _next_sales_order_sequence(self) -> int:
        """Get the next SO sequence atomically to avoid duplicate numbers under concurrent writes."""
        counter = await self.db["counters"].find_one_and_update(
            {"_id": "sales_order_sequence"},
            {"$inc": {"value": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        return int(counter.get("value", 1))

    def _allowed_status_transitions(self):
        return {
            SalesOrderStatus.DRAFT: {SalesOrderStatus.CONFIRMED, SalesOrderStatus.CREATED, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.CONFIRMED: {SalesOrderStatus.IN_PRODUCTION, SalesOrderStatus.READY, SalesOrderStatus.CANCELLED, SalesOrderStatus.LENS_ORDERED},
            SalesOrderStatus.IN_PRODUCTION: {SalesOrderStatus.READY, SalesOrderStatus.CANCELLED, SalesOrderStatus.FITTING},
            SalesOrderStatus.READY: {SalesOrderStatus.COMPLETED, SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.COMPLETED: set(),
            SalesOrderStatus.CANCELLED: set(),
            # New lifecycle transitions
            SalesOrderStatus.CREATED: {SalesOrderStatus.LENS_ORDERED, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.LENS_ORDERED: {SalesOrderStatus.FITTING, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.FITTING: {SalesOrderStatus.READY, SalesOrderStatus.CANCELLED},
            SalesOrderStatus.DELIVERED: set(),
        }

    async def _resolve_product_by_identifier(self, identifier: str):
        """Resolve a product by business product_id first, then Mongo _id for legacy payloads."""
        if not identifier:
            return None

        by_product_id = await self.product_repo.get_by_product_id(identifier)
        if by_product_id:
            return by_product_id

        by_mongo_id = await self.product_repo.get_by_id(identifier)
        if not by_mongo_id:
            return None
        return await self.product_repo.get_by_product_id(by_mongo_id.get("product_id"))

    async def _resolve_frame_variant_by_identifier(self, identifier: str):
        """Resolve a frame variant by its public variant identifier."""
        if not identifier:
            return None
        return await self.frame_variant_repo.get_by_variant_id(identifier)

    @staticmethod
    def _extract_advance_payment(measurements: Optional[dict]) -> float:
        if not isinstance(measurements, dict):
            return 0.0
        try:
            amount = float(measurements.get("advance_payment") or 0)
        except (TypeError, ValueError):
            return 0.0
        return round(amount, 2) if amount > 0 else 0.0

    async def _record_advance_payment_transaction(self, order_id: str, measurements: Optional[dict], created_by: str):
        amount = self._extract_advance_payment(measurements)
        if amount <= 0:
            return

        existing_payment_count = await self.db["transactions"].count_documents(
            {
                "reference_type": LedgerReferenceType.SALES_ORDER.value,
                "reference_id": order_id,
                "transaction_type": LedgerTransactionType.CUSTOMER_PAYMENT.value,
            }
        )
        if existing_payment_count > 0:
            return

        await self.transaction_service.create_transaction(
            TransactionCreate(
                transaction_type=LedgerTransactionType.CUSTOMER_PAYMENT,
                reference_type=LedgerReferenceType.SALES_ORDER,
                reference_id=order_id,
                amount=amount,
                status="completed",
            ),
            created_by=created_by,
        )

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
                master_data_id = raw_item.get("master_data_id")
                frame_variant_id = raw_item.get("frame_variant_id")
                line_type = raw_item.get("line_type", "product")
                track_stock = bool(raw_item.get("track_stock", line_type == "product"))
                discount = float(raw_item.get("discount") or 0)
            else:
                product_id = raw_item.product_id
                quantity = raw_item.quantity
                unit_price = raw_item.unit_price
                product_name = raw_item.product_name
                sku = raw_item.sku
                master_data_id = getattr(raw_item, "master_data_id", None)
                frame_variant_id = getattr(raw_item, "frame_variant_id", None)
                line_type = getattr(raw_item, "line_type", "product")
                track_stock = getattr(raw_item, "track_stock", line_type == "product")
                discount = float(getattr(raw_item, "discount", 0) or 0)

            if quantity <= 0:
                raise BadRequestException("Item quantity must be greater than zero")

            if unit_price < 0:
                raise BadRequestException("Item unit price cannot be negative")

            if discount < 0:
                raise BadRequestException("Item discount cannot be negative")

            if line_type == "product":
                product = await self._resolve_product_by_identifier(product_id)
                if product:
                    resolved_product_id = product.product_id
                    resolved_name = product_name or product.name
                    resolved_sku = sku or product.sku
                    resolved_unit_price = unit_price if unit_price >= 0 else product.selling_price
                    resolved_master_id = master_data_id or product.product_id
                    resolved_track_stock = True
                else:
                    # product_id supplied but not found → always an error for catalogued lines.
                    # Only omit the raise for purely manual lines (no product_id at all).
                    if product_id:
                        raise NotFoundException(
                            f"Product '{product_name or product_id}' (ID: {product_id}) not found in the product catalogue. "
                            "Please check that the product is active and retry."
                        )
                    if not product_name:
                        raise NotFoundException(f"Product with ID {product_id} not found")
                    resolved_product_id = product_id
                    resolved_name = product_name
                    resolved_sku = sku or product_id
                    resolved_unit_price = unit_price
                    resolved_master_id = master_data_id or product_id
                    resolved_track_stock = False
            elif line_type == "frame":
                # Priority: frame_variant_id > product_id > master_data_id
                # master_data_id is the frame_master_id (FM-xxx), not the variant_id
                variant = await self._resolve_frame_variant_by_identifier(
                    frame_variant_id or product_id or master_data_id
                )
                if variant:
                    resolved_product_id = variant.variant_id
                    resolved_name = product_name or f"{variant.frame_master_ref.brand} {variant.frame_master_ref.model_code}"
                    resolved_sku = sku or variant.sku
                    resolved_unit_price = unit_price if unit_price >= 0 else variant.selling_price
                    resolved_master_id = variant.frame_master_id
                    resolved_track_stock = True
                else:
                    if not product_name:
                        raise NotFoundException(f"Frame variant with ID {master_data_id or product_id} not found")
                    resolved_product_id = product_id
                    resolved_name = product_name
                    resolved_sku = sku or product_id
                    resolved_unit_price = unit_price
                    resolved_master_id = master_data_id or product_id
                    resolved_track_stock = False
            elif line_type == "lens":
                resolved_product_id = product_id
                lens = await self.lens_master_repo.get_by_id(master_data_id or product_id)
                if lens:
                    resolved_name = product_name or lens.lens_type
                    resolved_sku = sku or lens.lens_code
                    resolved_unit_price = unit_price if unit_price >= 0 else lens.price
                    resolved_master_id = lens.id or master_data_id or product_id
                else:
                    if not product_name:
                        raise NotFoundException(f"Lens with ID {master_data_id or product_id} not found")
                    resolved_name = product_name
                    resolved_sku = sku or product_id
                    resolved_unit_price = unit_price
                    resolved_master_id = master_data_id or product_id
                resolved_track_stock = False
            elif line_type == "expense":
                resolved_product_id = product_id
                expense_type = await self.other_expense_repo.get_by_id(master_data_id or product_id)
                if expense_type:
                    resolved_name = product_name or expense_type.name
                    resolved_sku = sku or expense_type.name
                    resolved_unit_price = unit_price if unit_price >= 0 else expense_type.default_cost
                    resolved_master_id = expense_type.id or master_data_id or product_id
                else:
                    if not product_name:
                        raise NotFoundException(f"Other expense type with ID {master_data_id or product_id} not found")
                    resolved_name = product_name
                    resolved_sku = sku or product_id
                    resolved_unit_price = unit_price
                    resolved_master_id = master_data_id or product_id
                resolved_track_stock = False
            elif line_type == "complimentary":
                product = await self._resolve_product_by_identifier(product_id)
                if product:
                    resolved_product_id = product.product_id
                    resolved_name = product_name or product.name
                    resolved_sku = sku or product.sku
                    resolved_unit_price = 0.0
                    resolved_master_id = master_data_id or product.product_id
                    resolved_track_stock = True
                else:
                    resolved_product_id = product_id
                    resolved_name = product_name or "Complimentary Item"
                    resolved_sku = sku or product_id
                    resolved_unit_price = 0.0
                    resolved_master_id = master_data_id or product_id
                    resolved_track_stock = False
            else:
                raise BadRequestException(f"Unsupported sales order line type: {line_type}")

            gross = round(quantity * resolved_unit_price, 2)
            line_discount = 0.0 if line_type == "complimentary" else round(discount, 2)
            if line_discount > gross:
                raise BadRequestException(
                    f"Discount on '{resolved_name}' ({line_discount:.2f}) cannot exceed the line amount ({gross:.2f})"
                )
            line_total = round(gross - line_discount, 2)
            subtotal += line_total

            item_models.append(
                SalesOrderItemModel(
                    product_id=resolved_product_id,
                    product_name=resolved_name,
                    sku=resolved_sku,
                    quantity=quantity,
                    unit_price=resolved_unit_price,
                    discount=line_discount,
                    total=line_total,
                    master_data_id=resolved_master_id,
                    line_type=line_type,
                    track_stock=resolved_track_stock,
                )
            )

        return item_models, round(subtotal, 2)

    async def _ensure_stock_available(self, items):
        for item in items:
            if not getattr(item, "track_stock", False):
                continue
            if getattr(item, "line_type", "product") == "frame":
                variant = await self._resolve_frame_variant_by_identifier(getattr(item, "frame_variant_id", None) or item.product_id)
                if not variant:
                    raise NotFoundException(f"Frame variant with ID {item.product_id} not found")
                if variant.current_stock < item.quantity:
                    raise BadRequestException(
                        f"Insufficient stock for {variant.frame_master_ref.brand} {variant.frame_master_ref.model_code}. Available: {variant.current_stock}, required: {item.quantity}"
                    )
                continue
            product = await self._resolve_product_by_identifier(item.product_id)
            if not product:
                raise NotFoundException(f"Product with ID {item.product_id} not found")
            if product.current_stock < item.quantity:
                raise BadRequestException(
                    f"Insufficient stock for {product.name}. Available: {product.current_stock}, required: {item.quantity}"
                )

    # ── Discounts ─────────────────────────────────────────────────────────────

    @staticmethod
    def _resolve_discount_amount(explicit: Optional[float], measurements: Optional[dict], fallback: float = 0.0) -> float:
        """Order-level discount: explicit field, else measurements["discount"] (older clients), else fallback."""
        if explicit is not None:
            return round(max(float(explicit), 0.0), 2)
        if isinstance(measurements, dict) and measurements.get("discount") not in (None, ""):
            try:
                return round(max(float(measurements["discount"]), 0.0), 2)
            except (TypeError, ValueError):
                return fallback
        return fallback

    @staticmethod
    def _apply_order_discount(subtotal: float, discount_amount: float) -> float:
        if discount_amount > subtotal:
            raise BadRequestException(
                f"Discount ({discount_amount:.2f}) cannot exceed the order subtotal ({subtotal:.2f})"
            )
        return round(subtotal - discount_amount, 2)

    # ── Stock: keep this order's net deduction equal to its stocked lines ─────

    async def _posted_stock_by_product(self, order_id: str) -> dict:
        """Net quantity this order has taken out of stock per product/variant (SALE_OUT − RETURN)."""
        cursor = self.db["inventory_movements"].aggregate([
            {"$match": {
                "reference_type": LedgerReferenceType.SALES_ORDER.value,
                "reference_id": order_id,
                "movement_type": {"$in": [InventoryMovementType.SALE_OUT.value, InventoryMovementType.RETURN.value]},
            }},
            {"$group": {
                "_id": {"product_id": "$product_id", "movement_type": "$movement_type"},
                "quantity": {"$sum": "$quantity"},
            }},
        ])
        net: dict = {}
        async for row in cursor:
            sign = 1 if row["_id"]["movement_type"] == InventoryMovementType.SALE_OUT.value else -1
            product_id = row["_id"]["product_id"]
            net[product_id] = net.get(product_id, 0) + sign * abs(int(row["quantity"]))
        return net

    async def _stock_deltas(self, order_id: str, items) -> dict:
        """Per product: positive = still to deduct, negative = to return. ``items=[]`` returns everything."""
        posted = await self._posted_stock_by_product(order_id)
        target: dict = {}
        for item in items:
            if getattr(item, "track_stock", False):
                target[item.product_id] = target.get(item.product_id, 0) + int(item.quantity)
        deltas = {pid: target.get(pid, 0) - posted.get(pid, 0) for pid in set(posted) | set(target)}
        return {pid: delta for pid, delta in deltas.items() if delta}

    async def _ensure_delta_stock_available(self, deltas: dict) -> None:
        for product_id, delta in deltas.items():
            if delta <= 0:
                continue
            product = await self._resolve_product_by_identifier(product_id)
            if product:
                name, available = product.name, product.current_stock
            else:
                variant = await self._resolve_frame_variant_by_identifier(product_id)
                if not variant:
                    raise NotFoundException(f"Product with ID {product_id} not found")
                name = f"{variant.frame_master_ref.brand} {variant.frame_master_ref.model_code}"
                available = variant.current_stock
            if available < delta:
                raise BadRequestException(f"Insufficient stock for {name}. Available: {available}, required: {delta}")

    async def _apply_stock_deltas(self, order_id: str, deltas: dict, created_by: str) -> None:
        async def move(product_id: str, delta: int):
            await self.inventory_movement_service.create_movement(
                InventoryMovementCreate(
                    product_id=product_id,
                    movement_type=InventoryMovementType.SALE_OUT if delta > 0 else InventoryMovementType.RETURN,
                    quantity=abs(delta),
                    reference_type=LedgerReferenceType.SALES_ORDER,
                    reference_id=order_id,
                ),
                created_by=created_by,
                apply_stock_change=True,
            )

        applied = []
        try:
            # Returns first, so a swapped item frees its stock before new deductions
            for product_id, delta in sorted(deltas.items(), key=lambda kv: kv[1]):
                await move(product_id, delta)
                applied.append((product_id, delta))
        except Exception:
            # Best-effort compensation so a failed deduction doesn't leave stock half-moved
            for product_id, delta in reversed(applied):
                await move(product_id, -delta)
            raise

    # ── Ledger: keep this order's net SALE equal to its total ─────────────────

    async def _posted_sale_amount(self, order_id: str) -> float:
        cursor = self.db["transactions"].aggregate([
            {"$match": {
                "reference_type": LedgerReferenceType.SALES_ORDER.value,
                "reference_id": order_id,
                "transaction_type": {"$in": [LedgerTransactionType.SALE.value, LedgerTransactionType.SALE_REVERSAL.value]},
            }},
            {"$group": {"_id": "$transaction_type", "amount": {"$sum": "$amount"}}},
        ])
        net = 0.0
        async for row in cursor:
            sign = 1 if row["_id"] == LedgerTransactionType.SALE.value else -1
            net += sign * float(row["amount"])
        return round(net, 2)

    async def _sync_sale_ledger(self, order_id: str, target_amount: float, created_by: str) -> None:
        delta = round(target_amount - await self._posted_sale_amount(order_id), 2)
        if abs(delta) < 0.01:
            return
        await self.transaction_service.create_transaction(
            TransactionCreate(
                transaction_type=LedgerTransactionType.SALE if delta > 0 else LedgerTransactionType.SALE_REVERSAL,
                reference_type=LedgerReferenceType.SALES_ORDER,
                reference_id=order_id,
                amount=abs(delta),
                status="completed",
            ),
            created_by=created_by,
        )

    # ── Invoice: keep a generated invoice in step with its order ──────────────

    @staticmethod
    def _invoice_items_for(order: SalesOrderModel) -> list:
        return [
            InvoiceItem(
                product_id=item.product_id,
                product_name=item.product_name or item.product_id,
                sku=item.sku or item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=getattr(item, "discount", 0) or 0,
                tax=0,
                total=item.total,
                master_data_id=getattr(item, "master_data_id", None),
                line_type=getattr(item, "line_type", "product"),
                track_stock=getattr(item, "track_stock", True),
            )
            for item in order.items
        ]

    @staticmethod
    def _payment_status_for(paid: float, balance: float) -> str:
        if balance <= 0:
            return PaymentStatus.PAID.value
        return PaymentStatus.PARTIAL.value if paid > 0 else PaymentStatus.PENDING.value

    async def _check_invoice_allows_total(self, order: SalesOrderModel, new_total: float) -> None:
        if not order.invoice_id:
            return
        invoice = await self.invoice_repo.get_by_invoice_id(order.invoice_id)
        if invoice and float(invoice.paid_amount or 0) > new_total:
            raise BadRequestException(
                f"Order total ({new_total:.2f}) cannot be less than the {invoice.paid_amount:.2f} "
                f"already paid on invoice {invoice.invoice_number}"
            )

    async def _sync_invoice(self, order: SalesOrderModel) -> None:
        if not order.invoice_id:
            return
        invoice = await self.invoice_repo.get_by_invoice_id(order.invoice_id)
        if not invoice:
            return
        if order.status == SalesOrderStatus.CANCELLED:
            update = {"payment_status": PaymentStatus.CANCELLED.value, "balance_due": 0}
        else:
            paid = float(invoice.paid_amount or 0)
            balance = round(order.total_amount - paid, 2)
            update = {
                "items": [item.dict() for item in self._invoice_items_for(order)],
                "subtotal": order.subtotal,
                "total_discount": order.discount_amount,
                "total_amount": order.total_amount,
                "balance_due": balance,
                "payment_status": self._payment_status_for(paid, balance),
            }
        await self.invoice_repo.update_invoice(order.invoice_id, update)

    async def _to_response(self, order: SalesOrderModel) -> SalesOrderResponse:
        patient_name = None
        patient = await self.patient_repo.get_by_patient_id(order.patient_id)
        if patient:
            patient_name = patient.name
        payload = order.dict()
        payload["patient_name"] = patient_name
        return SalesOrderResponse(**payload)

    async def list_sales_orders(self, page: int, page_size: int, patient_id: Optional[str] = None, status: Optional[str] = None):
        skip = (page - 1) * page_size
        orders, total = await self.repo.list_sales_orders(skip=skip, limit=page_size, patient_id=patient_id, status=status)
        total_pages = math.ceil(total / page_size)
        response_data = []
        for order in orders:
            response_data.append(await self._to_response(order))
        return PaginatedResponse(
            data=response_data,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    async def get_sales_order(self, order_id: str) -> SalesOrderResponse:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Sales order {order_id} not found")
        return await self._to_response(order)

    async def update_sales_order_status(self, order_id: str, new_status: SalesOrderStatus, updated_by: str) -> SalesOrderResponse:
        existing = await self.repo.get_by_order_id(order_id)
        if not existing:
            raise NotFoundException(f"Sales order {order_id} not found")

        old_status = existing.status
        if old_status == new_status:
            return await self._to_response(existing)

        allowed = self._allowed_status_transitions().get(old_status, set())
        if new_status not in allowed:
            raise BadRequestException(
                f"Cannot move from '{old_status}' to '{new_status}'. "
                f"Allowed next steps: {', '.join(s.value for s in allowed) or 'none'}"
            )

        # Stock and revenue are booked when an order leaves draft and reversed on cancel
        leaving_draft = old_status == SalesOrderStatus.DRAFT and new_status != SalesOrderStatus.CANCELLED
        cancelling = new_status == SalesOrderStatus.CANCELLED
        deltas = {}
        if leaving_draft or cancelling:
            deltas = await self._stock_deltas(order_id, [] if cancelling else existing.items)
            await self._ensure_delta_stock_available(deltas)

        now = datetime.now(timezone.utc)
        history_entry = {
            "status": new_status.value,
            "updated_at": now,
            "updated_by": updated_by,
        }

        await self.db["sales_orders"].update_one(
            {"order_id": order_id},
            {
                "$set": {"status": new_status.value, "updated_at": now},
                "$push": {"status_history": history_entry},
            },
        )

        updated = await self.repo.get_by_order_id(order_id)
        if leaving_draft or cancelling:
            await self._apply_stock_deltas(order_id, deltas, updated_by)
            await self._sync_sale_ledger(order_id, 0 if cancelling else updated.total_amount, updated_by)
            if leaving_draft:
                await self._record_advance_payment_transaction(order_id, updated.measurements, updated_by)
            if cancelling:
                await self._sync_invoice(updated)
        await self.audit_service.log(
            updated_by,
            "sales_order_status_updated",
            "SalesOrder",
            order_id,
            old_value={"status": old_status.value},
            new_value={"status": new_status.value},
        )
        return await self._to_response(updated)

    async def delete_sales_order(self, order_id: str, deleted_by: str) -> None:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Sales order {order_id} not found")

        if order.status != SalesOrderStatus.DRAFT:
            raise BadRequestException("Only draft sales orders can be deleted")

        if order.invoice_id:
            raise BadRequestException("Draft sales orders with invoices cannot be deleted")

        deleted = await self.repo.delete({"order_id": order_id})
        if not deleted:
            raise NotFoundException(f"Sales order {order_id} not found")

        await self.audit_service.log(
            deleted_by,
            "sales_order_deleted",
            "SalesOrder",
            order_id,
            old_value=order.dict(),
        )

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

        next_number = await self._next_sales_order_sequence()
        order_id = generate_id("SO", next_number)
        order_number = f"SO-{datetime.utcnow().year}-{str(next_number).zfill(6)}"
        item_models, subtotal = await self._build_validated_items(data.items)
        discount_amount = self._resolve_discount_amount(data.discount_amount, data.measurements)
        total_amount = self._apply_order_discount(subtotal, discount_amount)
        initial_status = data.status or SalesOrderStatus.CONFIRMED
        if initial_status != SalesOrderStatus.DRAFT:
            await self._ensure_stock_available(item_models)
        order_model = SalesOrderModel(
            order_id=order_id,
            order_number=order_number,
            patient_id=data.patient_id,
            prescription_id=data.prescription_id,
            items=item_models,
            subtotal=subtotal,
            discount_amount=discount_amount,
            total_amount=total_amount,
            measurements=data.measurements,
            tested_by=data.tested_by,
            expected_delivery_date=data.expected_delivery_date,
            notes=data.notes,
            sale_location=data.sale_location,
            status=initial_status,
            created_by=created_by,
        )
        created = await self.repo.create(order_model.dict())
        created_model = SalesOrderModel(**created)
        if created_model.status != SalesOrderStatus.DRAFT:
            # Deduct inventory when SO is created with non-DRAFT status
            try:
                await self._apply_stock_deltas(order_id, await self._stock_deltas(order_id, created_model.items), created_by)
            except Exception:
                # Nothing references the new order yet — remove it rather than leave it without its stock
                await self.repo.delete({"order_id": order_id})
                raise
            if created_model.sale_location:
                # Write sale_location back to frame variants for display on inventory page
                for item in created_model.items:
                    if item.line_type == "frame" and item.track_stock:
                        await self.db["frame_variants"].update_one(
                            {"variant_id": item.product_id},
                            {"$set": {"sale_location": created_model.sale_location}},
                        )
            await self._sync_sale_ledger(order_id, created_model.total_amount, created_by)
            await self._record_advance_payment_transaction(created_model.order_id, created_model.measurements, created_by)
        await self.audit_service.log(created_by, "sales_order_created", "SalesOrder", order_id, new_value=created)
        return await self._to_response(created_model)

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

        items_changed = update_dict.get("items") is not None
        if items_changed:
            if old_status in {SalesOrderStatus.COMPLETED, SalesOrderStatus.DELIVERED, SalesOrderStatus.CANCELLED}:
                raise BadRequestException("Cannot modify items of completed/delivered/cancelled sales orders")
            item_models, subtotal = await self._build_validated_items(update_dict["items"])
            update_dict["items"] = [item.dict() for item in item_models]
        else:
            update_dict.pop("items", None)
            item_models, subtotal = existing.items, existing.subtotal

        # Recompute totals whenever lines or the order discount may have changed
        totals_changed = items_changed or "discount_amount" in update_dict or "measurements" in update_dict
        if totals_changed:
            discount_amount = self._resolve_discount_amount(
                update_dict.get("discount_amount"),
                update_dict.get("measurements"),
                fallback=existing.discount_amount,
            )
            total_amount = self._apply_order_discount(subtotal, discount_amount)
            update_dict.update(subtotal=subtotal, discount_amount=discount_amount, total_amount=total_amount)
            totals_changed = (subtotal, discount_amount, total_amount) != (
                existing.subtotal, existing.discount_amount, existing.total_amount
            )
        else:
            total_amount = existing.total_amount

        if target_status != old_status:
            update_dict["status_history"] = [entry.dict() for entry in existing.status_history] + [
                {"status": target_status.value, "updated_at": datetime.now(timezone.utc), "updated_by": created_by}
            ]

        # Once out of draft an order holds stock and revenue for its lines; cancelling releases both
        cancelling = target_status == SalesOrderStatus.CANCELLED and old_status != SalesOrderStatus.CANCELLED
        books_sale = target_status not in {SalesOrderStatus.DRAFT, SalesOrderStatus.CANCELLED}
        sync_needed = cancelling or (books_sale and (items_changed or totals_changed or old_status == SalesOrderStatus.DRAFT))

        # Validate everything before writing anything
        deltas = {}
        if sync_needed:
            deltas = await self._stock_deltas(order_id, item_models if books_sale else [])
            await self._ensure_delta_stock_available(deltas)
        if totals_changed and not cancelling:
            await self._check_invoice_allows_total(existing, total_amount)

        await self.repo.update({"order_id": order_id}, update_dict)
        updated = await self.repo.get_by_order_id(order_id)

        if sync_needed:
            await self._apply_stock_deltas(order_id, deltas, created_by)
            await self._sync_sale_ledger(order_id, updated.total_amount if books_sale else 0, created_by)
        if books_sale:
            await self._record_advance_payment_transaction(updated.order_id, updated.measurements, created_by)
        if cancelling or (totals_changed and books_sale):
            await self._sync_invoice(updated)

        await self.audit_service.log(created_by, "sales_order_updated", "SalesOrder", order_id, old_value=existing.dict(), new_value=updated.dict())
        return await self._to_response(updated)

    async def convert_to_invoice(self, order_id: str, created_by: str):
        return await self._convert_order_to_invoice(order_id, created_by, strict_completed=True)

    async def generate_invoice(self, order_id: str, created_by: str):
        return await self._convert_order_to_invoice(order_id, created_by, strict_completed=False)

    async def _convert_order_to_invoice(self, order_id: str, created_by: str, strict_completed: bool):
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Sales order {order_id} not found")

        if strict_completed:
            if order.status != SalesOrderStatus.COMPLETED:
                raise BadRequestException("Only completed sales orders can be converted to invoices")
        else:
            if order.status == SalesOrderStatus.CANCELLED:
                raise BadRequestException("Cancelled sales orders cannot generate invoices")

        if order.invoice_id:
            existing_invoice = await self.invoice_repo.get_by_invoice_id(order.invoice_id)
            if existing_invoice:
                return existing_invoice

        existing_by_reference = await self.invoice_repo.get_by_sales_order_id(order.order_id)
        if existing_by_reference:
            await self.repo.update({"order_id": order_id}, {"invoice_id": existing_by_reference.invoice_id})
            return existing_by_reference

        invoice_items = self._invoice_items_for(order)

        due_date = order.date_of_full_payment.date() if order.date_of_full_payment else date.today()

        invoice = await self.invoice_service.create_invoice(
            InvoiceCreate(
                patient_id=order.patient_id,
                invoice_date=date.today(),
                due_date=due_date,
                items=invoice_items,
                prescription_id=order.prescription_id,
                sales_order_id=order.order_id,
                notes=order.notes,
            ),
            current_user_id=created_by,
            deduct_stock=False,
        )

        # Line totals are already net of line discounts; the order-level discount comes off the invoice total
        total_amount = order.total_amount
        advance = self._extract_advance_payment(order.measurements)
        new_paid = round(advance, 2) if 0 < advance <= total_amount else 0.0
        new_balance = round(total_amount - new_paid, 2)
        payment_status = self._payment_status_for(new_paid, new_balance)
        await self.invoice_repo.update_invoice(
            invoice.invoice_id,
            {
                "total_discount": order.discount_amount,
                "total_amount": total_amount,
                "paid_amount": new_paid,
                "balance_due": new_balance,
                "payment_status": payment_status,
            },
        )
        invoice.total_discount = order.discount_amount
        invoice.total_amount = total_amount
        invoice.paid_amount = new_paid
        invoice.balance_due = new_balance
        invoice.payment_status = payment_status

        await self.repo.update({"order_id": order_id}, {"invoice_id": invoice.invoice_id})
        await self.audit_service.log(
            created_by,
            "sales_order_generated_invoice" if not strict_completed else "sales_order_converted_to_invoice",
            "SalesOrder",
            order_id,
            new_value={"invoice_id": invoice.invoice_id},
        )
        return invoice

    # ── Sales order receipt PDF ───────────────────────────────────────────────

    async def generate_sales_order_pdf(self, order_id: str) -> tuple[bytes, str]:
        """Render a printable A4 sales-order receipt for download."""
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Sales order with ID {order_id} not found")

        patient = await self.patient_repo.get_by_patient_id(order.patient_id)
        company_profile = await self.company_profile_service.get_company_profile()
        invoice = None
        if order.invoice_id:
            invoice = await self.invoice_repo.get_by_invoice_id(order.invoice_id)

        pdf_bytes = self._build_sales_order_pdf(order, patient, company_profile, invoice)
        filename = f"{order.order_number}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def _fmt_money(value: Optional[float]) -> str:
        return f"LKR {(value or 0):,.2f}"

    @staticmethod
    def _fmt_date(value) -> str:
        if not value:
            return "-"
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return value
        if isinstance(value, datetime):
            return value.strftime("%d %b %Y")
        if isinstance(value, date):
            return value.strftime("%d %b %Y")
        return str(value)

    @staticmethod
    def _fmt_time(value) -> str:
        if not value:
            return "-"
        if isinstance(value, str):
            try:
                value = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return "-"
        if isinstance(value, datetime):
            return value.strftime("%I:%M %p").lstrip("0")
        return "-"

    @staticmethod
    def _resolve_asset_path(candidate: Optional[str]) -> Optional[Path]:
        if not candidate:
            return None
        service_file = Path(__file__).resolve()
        workspace_root = service_file.parents[3]
        backend_root = service_file.parents[2]
        path_candidate = Path(candidate)
        for path in (
            path_candidate,
            workspace_root / candidate,
            backend_root / candidate,
            workspace_root / "Frontend" / "public" / candidate,
            workspace_root / "backend" / "static" / candidate,
        ):
            if path.exists() and path.is_file():
                return path
        return None

    @staticmethod
    def _patient_address(patient) -> str:
        if not patient or not getattr(patient, "address", None):
            return "-"
        addr = patient.address
        parts = [
            getattr(addr, "street", None),
            getattr(addr, "city", None),
            getattr(addr, "state", None),
            getattr(addr, "zip_code", None),
            getattr(addr, "country", None),
        ]
        return ", ".join(p for p in parts if p) or "-"

    @staticmethod
    def _payment_status_label(status: Optional[str], paid: float, total: float) -> str:
        key = (status or "").lower()
        if key in ("paid", "fully_paid"):
            return "Fully Paid"
        if key in ("partial", "partially_paid"):
            return "Partially Paid"
        if key in ("overdue",):
            return "Overdue"
        if paid <= 0:
            return "Unpaid"
        if total > 0 and paid >= total:
            return "Fully Paid"
        if paid > 0:
            return "Partially Paid"
        return "Unpaid"

    def _build_sales_order_pdf(self, order: SalesOrderModel, patient, company_profile, invoice) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            title=f"Sales Order {order.order_number}",
        )

        BLUE = colors.HexColor("#1B4F9C")
        BLUE_DARK = colors.HexColor("#0F3A7A")
        BLUE_SOFT = colors.HexColor("#E8F0FE")
        GRAY_BG = colors.HexColor("#F3F4F6")
        GRAY_LINE = colors.HexColor("#E5E7EB")
        GRAY_TEXT = colors.HexColor("#6B7280")
        DARK = colors.HexColor("#111827")

        styles = getSampleStyleSheet()
        brand = ParagraphStyle(
            "SOBrand", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=18, leading=22, textColor=BLUE_DARK,
        )
        tagline = ParagraphStyle(
            "SOTagline", parent=styles["Normal"], fontName="Helvetica",
            fontSize=8, leading=11, textColor=GRAY_TEXT, spaceBefore=1,
        )
        contact = ParagraphStyle(
            "SOContact", parent=styles["Normal"], fontName="Helvetica",
            fontSize=8, leading=12, textColor=GRAY_TEXT, alignment=2,
        )
        title = ParagraphStyle(
            "SOTitle", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=20, leading=24, textColor=DARK,
        )
        subtitle = ParagraphStyle(
            "SOSubtitle", parent=styles["Normal"], fontName="Helvetica",
            fontSize=8, leading=11, textColor=GRAY_TEXT, spaceBefore=2,
        )
        section_h = ParagraphStyle(
            "SOSection", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=8, leading=10, textColor=GRAY_TEXT,
        )
        label = ParagraphStyle(
            "SOLabel", parent=styles["Normal"], fontName="Helvetica",
            fontSize=8, leading=11, textColor=GRAY_TEXT,
        )
        value = ParagraphStyle(
            "SOValue", parent=styles["Normal"], fontName="Helvetica",
            fontSize=9, leading=12, textColor=DARK,
        )
        value_b = ParagraphStyle(
            "SOValueB", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=9, leading=12, textColor=DARK,
        )
        th = ParagraphStyle(
            "SOTh", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=7.5, leading=10, textColor=GRAY_TEXT,
        )
        td = ParagraphStyle(
            "SOTd", parent=styles["Normal"], fontName="Helvetica",
            fontSize=8.5, leading=11, textColor=DARK,
        )
        td_b = ParagraphStyle(
            "SOTdB", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=8.5, leading=11, textColor=DARK,
        )
        td_muted = ParagraphStyle(
            "SOTdMuted", parent=styles["Normal"], fontName="Helvetica",
            fontSize=7.5, leading=10, textColor=GRAY_TEXT,
        )
        small = ParagraphStyle(
            "SOSmall", parent=styles["Normal"], fontName="Helvetica",
            fontSize=8, leading=11, textColor=DARK,
        )
        note = ParagraphStyle(
            "SONote", parent=styles["Normal"], fontName="Helvetica",
            fontSize=7.5, leading=11, textColor=GRAY_TEXT,
        )
        balance = ParagraphStyle(
            "SOBalance", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=12, leading=15, textColor=BLUE,
        )
        badge = ParagraphStyle(
            "SOBadge", parent=styles["Normal"], fontName="Helvetica-Bold",
            fontSize=8, leading=10, textColor=BLUE_DARK, alignment=1,
        )

        story = []
        meas = order.measurements if isinstance(order.measurements, dict) else {}

        # ── Header ────────────────────────────────────────────────────────
        company_name = (company_profile.company_name or settings.APP_NAME or "Eye Care").upper()
        contact_lines = []
        if company_profile.address:
            contact_lines.append(company_profile.address)
        if company_profile.phone:
            contact_lines.append(company_profile.phone)
        if company_profile.email:
            contact_lines.append(company_profile.email)

        logo_path = self._resolve_asset_path(company_profile.company_logo or "Logo.png")
        brand_block = []
        if logo_path:
            brand_block.append(Image(str(logo_path), width=14 * mm, height=14 * mm))
        brand_block.append(Paragraph(company_name, brand))
        brand_block.append(Paragraph("EYE CARE &amp; VISION SOLUTIONS", tagline))

        header = Table(
            [[brand_block, Paragraph("<br/>".join(contact_lines) or "-", contact)]],
            colWidths=[110 * mm, 68 * mm],
        )
        header.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header)
        story.append(Spacer(1, 3 * mm))
        story.append(HRFlowable(width="100%", thickness=0.8, color=GRAY_LINE, spaceBefore=0, spaceAfter=4 * mm))

        # ── Title + Order No ──────────────────────────────────────────────
        order_no_box = Table(
            [[
                Paragraph("ORDER NO.", ParagraphStyle("ONL", parent=label, alignment=1, fontSize=7)),
            ], [
                Paragraph(order.order_number, ParagraphStyle("ONV", parent=value_b, alignment=1, fontSize=11, textColor=BLUE_DARK)),
            ]],
            colWidths=[42 * mm],
        )
        order_no_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
            ("BOX", (0, 0), (-1, -1), 0, BLUE_SOFT),
            ("TOPPADDING", (0, 0), (-1, 0), 5),
            ("BOTTOMPADDING", (0, -1), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))

        title_row = Table(
            [[
                [Paragraph("SALES ORDER", title), Paragraph("RECEIPT / ORDER CONFIRMATION", subtitle)],
                order_no_box,
            ]],
            colWidths=[136 * mm, 42 * mm],
        )
        title_row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(title_row)
        story.append(Spacer(1, 5 * mm))

        # ── Customer + Order details ──────────────────────────────────────
        patient_name = (
            (patient.name if patient else None)
            or getattr(order, "patient_name", None)
            or "-"
        )
        patient_phone = (patient.phone if patient else None) or "-"
        patient_addr = self._patient_address(patient)

        order_date_raw = meas.get("order_date") or order.created_at
        order_type_raw = str(meas.get("order_type") or "Retail").replace("_", " ").title()
        if order_type_raw.upper() in ("FULL ORDER", "PARTIAL ORDER"):
            order_type_label = order_type_raw.title()
        else:
            order_type_label = order_type_raw
        sale_loc = (order.sale_location or "institute")
        if hasattr(sale_loc, "value"):
            sale_loc = sale_loc.value
        sale_loc_label = str(sale_loc).replace("_", " ").title()

        def info_panel(heading: str, rows: list[tuple[str, str]]) -> Table:
            body = [[Paragraph(heading, section_h)]]
            for k, v in rows:
                body.append([
                    Paragraph(f"{k}:  <font color='#111827'><b>{v}</b></font>", label)
                ])
            t = Table(body, colWidths=[87 * mm])
            t.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), GRAY_BG),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, GRAY_LINE),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, GRAY_LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, 0), 6),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("TOPPADDING", (0, 1), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 3),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            return t

        panels = Table(
            [[
                info_panel("CUSTOMER / PATIENT", [
                    ("Name", patient_name),
                    ("Phone", patient_phone),
                    ("Address", patient_addr),
                ]),
                info_panel("ORDER DETAILS", [
                    ("Date", self._fmt_date(order_date_raw)),
                    ("Time", self._fmt_time(order.created_at)),
                    ("Order Type", order_type_label),
                    ("Sale Location", sale_loc_label),
                ]),
            ]],
            colWidths=[89 * mm, 89 * mm],
        )
        panels.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (0, 0), 4),
            ("LEFTPADDING", (1, 0), (1, 0), 4),
            ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ]))
        story.append(panels)
        story.append(Spacer(1, 5 * mm))

        # ── Line items ────────────────────────────────────────────────────
        type_labels = {
            "frame": "Frame",
            "lens": "Lens",
            "expense": "Expense",
            "complimentary": "Complimentary",
            "product": "Product",
        }
        item_rows = [[
            Paragraph("#", th),
            Paragraph("ITEM", th),
            Paragraph("DETAILS", th),
            Paragraph("QTY", th),
            Paragraph("UNIT PRICE (LKR)", th),
            Paragraph("AMOUNT (LKR)", th),
        ]]

        for idx, item in enumerate(order.items or [], start=1):
            line_type = (item.line_type or "product").lower()
            is_free = line_type == "complimentary" or (item.unit_price or 0) == 0 and (item.total or 0) == 0
            item_label = type_labels.get(line_type, "Product")
            if line_type in ("product", "expense"):
                item_label = item.product_name or item_label
                details_bits = []
                if line_type == "expense":
                    details_bits.append("Other Expense")
                else:
                    details_bits.append("General Item")
                if item.sku:
                    details_bits.append(f"SKU: {item.sku}")
                details_html = "<br/>".join(details_bits)
            else:
                details_bits = [item.product_name or "-"]
                if item.sku:
                    details_bits.append(f"SKU: {item.sku}")
                if is_free and line_type == "complimentary":
                    details_bits = [item.product_name or "Complimentary Item"]
                details_html = "<br/>".join(details_bits)

            unit_txt = "Free" if is_free else f"{(item.unit_price or 0):,.2f}"
            amt_txt = "Free" if is_free else f"{(item.total or 0):,.2f}"

            item_rows.append([
                Paragraph(str(idx), td),
                Paragraph(item_label, td_b),
                Paragraph(details_html, td_muted),
                Paragraph(str(item.quantity), td),
                Paragraph(unit_txt, td),
                Paragraph(amt_txt, td_b),
            ])

        items_table = Table(
            item_rows,
            colWidths=[10 * mm, 28 * mm, 58 * mm, 14 * mm, 34 * mm, 34 * mm],
            repeatRows=1,
        )
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GRAY_BG),
            ("LINEBELOW", (0, 0), (-1, 0), 0.6, GRAY_LINE),
            ("LINEBELOW", (0, 1), (-1, -2), 0.4, GRAY_LINE),
            ("LINEBELOW", (0, -1), (-1, -1), 0.6, GRAY_LINE),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 3 * mm))

        # ── Totals ────────────────────────────────────────────────────────
        try:
            discount = float(meas.get("discount") or 0)
        except (TypeError, ValueError):
            discount = 0.0
        if invoice and getattr(invoice, "total_discount", None):
            discount = float(invoice.total_discount or discount)

        subtotal = float(order.subtotal or 0)
        total_amount = float(order.total_amount or 0)
        if invoice:
            total_amount = float(invoice.total_amount or total_amount)
            subtotal = float(invoice.subtotal or subtotal)

        totals_rows = [
            [Paragraph("Subtotal", label), Paragraph(self._fmt_money(subtotal), value)],
            [Paragraph("Discount", label), Paragraph(self._fmt_money(discount), value)],
            [
                Paragraph("<b>Total Amount</b>", ParagraphStyle("TA", parent=value_b, textColor=BLUE_DARK)),
                Paragraph(f"<b>{self._fmt_money(total_amount)}</b>", ParagraphStyle("TAV", parent=value_b, textColor=BLUE_DARK, alignment=2)),
            ],
        ]
        totals_inner = Table(totals_rows, colWidths=[40 * mm, 40 * mm])
        totals_inner.setStyle(TableStyle([
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("BACKGROUND", (0, 2), (-1, 2), BLUE_SOFT),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 2), (-1, 2), 7),
            ("BOTTOMPADDING", (0, 2), (-1, 2), 7),
        ]))
        totals_wrap = Table([["", totals_inner]], colWidths=[98 * mm, 80 * mm])
        totals_wrap.setStyle(TableStyle([
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(totals_wrap)
        story.append(Spacer(1, 5 * mm))

        # ── Payment summary ───────────────────────────────────────────────
        paid = 0.0
        if invoice:
            paid = float(invoice.paid_amount or 0)
        else:
            paid = self._extract_advance_payment(meas)
        balance_due = max(total_amount - paid, 0.0)
        if invoice and invoice.balance_due is not None:
            balance_due = float(invoice.balance_due)

        pay_method = "-"
        if invoice and invoice.payment_method:
            pay_method = invoice.payment_method.value if hasattr(invoice.payment_method, "value") else str(invoice.payment_method)
            pay_method = str(pay_method).replace("_", " ").title()
        elif paid > 0:
            pay_method = "Cash"

        pay_status = None
        if invoice and invoice.payment_status:
            pay_status = invoice.payment_status.value if hasattr(invoice.payment_status, "value") else str(invoice.payment_status)
        status_label = self._payment_status_label(pay_status, paid, total_amount)
        due_date = self._fmt_date(order.date_of_full_payment or (invoice.due_date if invoice else None))

        left_pay = Table(
            [
                [Paragraph("Order Total", label), Paragraph(self._fmt_money(total_amount), value)],
                [Paragraph("Amount Paid Today", label), Paragraph(self._fmt_money(paid), value)],
                [Paragraph("Discount", label), Paragraph(self._fmt_money(discount), value)],
                [Paragraph("", small)],
                [Paragraph("Balance Due", ParagraphStyle("BD", parent=value_b, fontSize=11, textColor=BLUE)),
                 Paragraph(self._fmt_money(balance_due), balance)],
            ],
            colWidths=[45 * mm, 40 * mm],
        )
        left_pay.setStyle(TableStyle([
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LINEABOVE", (0, 4), (-1, 4), 1.2, BLUE),
            ("TOPPADDING", (0, 4), (-1, 4), 6),
            ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))

        badge_tbl = Table([[Paragraph(status_label, badge)]], colWidths=[32 * mm])
        badge_tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.8, BLUE),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))

        right_pay = Table(
            [
                [Paragraph("Payment Method", label), Paragraph(f"<b>{pay_method}</b>", value)],
                [Paragraph("Full Payment Due", label), Paragraph(f"<b>{due_date}</b>", value)],
                [Paragraph("Order Status", label), badge_tbl],
            ],
            colWidths=[38 * mm, 40 * mm],
        )
        right_pay.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))

        pay_box = Table([[left_pay, right_pay]], colWidths=[95 * mm, 83 * mm])
        pay_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BLUE_SOFT),
            ("BOX", (0, 0), (-1, -1), 0, BLUE_SOFT),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(pay_box)
        story.append(Spacer(1, 6 * mm))

        # ── Notes + signature + barcode ───────────────────────────────────
        phone_for_notes = company_profile.phone or "the clinic"
        notes_lines = [
            f"• Please bring this receipt when collecting your spectacles.",
            f"• Present this receipt for any future payments against this order.",
            f"• Full payment is due by the date shown above unless otherwise agreed.",
            f"• For questions, contact us at {phone_for_notes}.",
            "• Thank you for choosing us for your vision care.",
        ]
        if order.notes:
            notes_lines.insert(0, f"• Note: {order.notes}")

        notes_block = [
            Paragraph("<b>Important Notes</b>", value_b),
            Spacer(1, 1.5 * mm),
            Paragraph("<br/>".join(notes_lines), note),
        ]

        barcode_flowable = Paragraph("", small)
        try:
            bc_png = generate_barcode_png(order.order_number)
            barcode_flowable = Image(io.BytesIO(bc_png), width=48 * mm, height=14 * mm)
        except Exception:
            pass

        sig_block = Table(
            [
                [Paragraph("______________________________", ParagraphStyle("Sig", parent=small, alignment=1))],
                [Paragraph("Authorized Signature", ParagraphStyle("SigL", parent=note, alignment=1))],
                [Spacer(1, 4 * mm)],
                [barcode_flowable],
                [Paragraph(order.order_number, ParagraphStyle("BC", parent=note, alignment=1))],
            ],
            colWidths=[70 * mm],
        )
        sig_block.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]))

        footer = Table([[notes_block, sig_block]], colWidths=[105 * mm, 73 * mm])
        footer.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(KeepTogether(footer))

        doc.build(story)
        return buffer.getvalue()
