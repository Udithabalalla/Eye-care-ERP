from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
from types import SimpleNamespace


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
        """The order's printable copy — the same layout as the invoice preview on screen."""
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Sales order with ID {order_id} not found")

        patient = await self.patient_repo.get_by_patient_id(order.patient_id)
        company_profile = await self.company_profile_service.get_company_profile()
        invoice = await self.invoice_repo.get_by_invoice_id(order.invoice_id) if order.invoice_id else None

        # The download is the same copy as the invoice preview on screen. An order
        # without an invoice (a draft, or a past paper order) prints the same layout
        # under its own number.
        if invoice:
            pdf_bytes = self.invoice_service._build_invoice_pdf(invoice, patient, company_profile)
        else:
            status = order.status.value if hasattr(order.status, "value") else str(order.status)
            pdf_bytes = self.invoice_service._build_invoice_pdf(
                self._order_as_invoice(order, patient),
                patient,
                company_profile,
                title="SALES ORDER",
                number_label="Order number",
                banner="DRAFT — not confirmed yet" if status == "draft" else None,
            )
        return pdf_bytes, f"{order.order_number}.pdf"

    def _order_as_invoice(self, order: SalesOrderModel, patient) -> SimpleNamespace:
        """The fields the invoice layout reads, taken from an order that has no invoice."""
        meas = order.measurements if isinstance(order.measurements, dict) else {}
        paid = self._extract_advance_payment(meas)
        total = float(order.total_amount or 0)
        balance = max(total - paid, 0.0)
        order_date = meas.get("order_date")
        if isinstance(order_date, str):
            try:
                order_date = datetime.fromisoformat(order_date.replace("Z", "+00:00"))
            except ValueError:
                order_date = None
        status = "paid" if total > 0 and balance <= 0.005 else "partial" if paid > 0 else "pending"
        return SimpleNamespace(
            invoice_number=order.order_number,
            payment_status=status,
            total_amount=total,
            balance_due=round(balance, 2),
            paid_amount=round(paid, 2),
            patient_name=getattr(patient, "name", None) or "-",
            patient_phone=getattr(patient, "phone", None),
            patient_email=str(patient.email) if patient and getattr(patient, "email", None) else None,
            invoice_date=order_date if isinstance(order_date, datetime) else order.created_at,
            due_date=order.date_of_full_payment,
            sales_order_id=order.order_number,
            prescription_id=order.prescription_id,
            items=order.items,
            subtotal=float(order.subtotal or 0),
            total_discount=float(order.discount_amount or meas.get("discount") or 0),
            total_tax=0,
            payment_date=None,
            updated_at=order.updated_at,
            payment_method=None,
            transaction_id=None,
            notes=order.notes,
        )
