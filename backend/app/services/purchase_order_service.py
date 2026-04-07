from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
from datetime import datetime, date, timezone
from pathlib import Path
import io

from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderResponse, PurchaseOrderItemResponse, ReceiveStockRequest
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
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id
from app.config.settings import settings

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image


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
        subtotal = 0.0
        line_discount_total = 0.0
        for index, item in enumerate(data.items, start=1):
            product = await self.product_repo.get_by_product_id(item.product_id)
            if not product:
                raise NotFoundException(f"Product with ID {item.product_id} not found")

            line_subtotal = item.quantity * item.unit_cost
            line_discount_amount = self._calculate_line_discount(
                line_subtotal=line_subtotal,
                line_discount_type=item.line_discount_type,
                line_discount_value=item.line_discount_value,
            )
            line_total = max(0.0, line_subtotal - line_discount_amount)

            item_id = generate_id(f"POI{next_number}", index)
            item_models.append(PurchaseOrderItemModel(
                id=item_id,
                purchase_order_id=order_id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_cost=item.unit_cost,
                line_discount_type=item.line_discount_type,
                line_discount_value=item.line_discount_value,
                line_discount_amount=line_discount_amount,
                total_price=line_total,
            ))
            subtotal += line_subtotal
            line_discount_total += line_discount_amount

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

        buyer_information = None
        if data.buyer_information:
            buyer_information = BuyerInformationModel(**data.buyer_information.dict())

        shipping_information = None
        if data.shipping_information:
            shipping_information = ShippingInformationModel(**data.shipping_information.dict())

        payment_terms = PaymentTermsModel(currency="LKR")
        if data.payment_terms:
            payment_dict = data.payment_terms.dict()
            payment_dict["currency"] = "LKR"
            payment_terms = PaymentTermsModel(**payment_dict)

        notes = NotesModel(**data.notes.dict()) if data.notes else None
        authorization = AuthorizationModel(**data.authorization.dict()) if data.authorization else None
        footer = FooterModel(**data.footer.dict()) if data.footer else None

        order_summary = OrderSummaryModel(
            subtotal=round(subtotal, 2),
            line_discount_total=round(line_discount_total, 2),
            tax_rate=round(tax_rate, 4),
            tax_amount=round(tax_amount, 2),
            shipping_cost=round(shipping_cost, 2),
            discount=round(po_discount, 2),
            total_amount=round(total_amount, 2),
        )

        order_model = PurchaseOrderModel(
            id=order_id,
            supplier_id=data.supplier_id,
            order_date=data.order_date,
            expected_delivery_date=data.expected_delivery_date,
            status="Draft",
            total_amount=round(total_amount, 2),
            created_by=created_by,
            items=item_models,
            buyer_information=buyer_information,
            supplier_information=supplier_information,
            shipping_information=shipping_information,
            order_summary=order_summary,
            payment_terms=payment_terms,
            notes=notes,
            authorization=authorization,
            footer=footer,
        )
        doc = order_model.dict()
        # Convert date -> datetime so BSON/Motor can store them
        doc["expected_delivery_date"] = _date_to_datetime(doc.get("expected_delivery_date"))
        if doc.get("authorization") and doc["authorization"].get("approval_date"):
            doc["authorization"]["approval_date"] = _date_to_datetime(doc["authorization"].get("approval_date"))
        await self.repo.create(doc)
        # Fetch freshly from DB to get server-set timestamps
        created_order = await self.repo.get_by_order_id(order_id)
        return self._to_response(created_order)

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

    async def generate_purchase_order_pdf(self, order_id: str) -> tuple[bytes, str]:
        order = await self.repo.get_by_order_id(order_id)
        if not order:
            raise NotFoundException(f"Purchase order {order_id} not found")

        supplier = await self.supplier_repo.get_by_supplier_id(order.supplier_id)
        product_map = {}
        for item in order.items:
            product = await self.product_repo.get_by_product_id(item.product_id)
            if product:
                product_map[item.product_id] = product

        pdf_bytes = self._build_po_pdf(order, supplier, product_map)
        filename = f"{order.id}.pdf"
        return pdf_bytes, filename

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
            buyer_information=order.buyer_information,
            supplier_information=order.supplier_information,
            shipping_information=order.shipping_information,
            order_summary=order.order_summary,
            payment_terms=order.payment_terms,
            notes=order.notes,
            authorization=order.authorization,
            footer=order.footer,
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
    def _format_dt(value: Optional[datetime]) -> str:
        if not value:
            return "-"
        return value.strftime("%Y-%m-%d")

    @staticmethod
    def _lkr(value: float) -> str:
        return f"LKR {value:,.2f}"

    def _resolve_logo_path(self) -> Optional[Path]:
        service_file = Path(__file__).resolve()
        workspace_root = service_file.parents[3]
        backend_root = service_file.parents[2]
        candidates = [
            workspace_root / "Logo.png",
            backend_root / "Logo.png",
            backend_root / "assets" / "Logo.png",
            backend_root / "static" / "Logo.png",
        ]
        for path in candidates:
            if path.exists() and path.is_file():
                return path
        return None

    def _build_po_pdf(self, order: PurchaseOrderModel, supplier, product_map: dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=12 * mm,
            rightMargin=12 * mm,
            topMargin=12 * mm,
            bottomMargin=12 * mm,
            title=f"Purchase Order {order.id}",
        )
        styles = getSampleStyleSheet()
        small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, leading=12)
        normal = ParagraphStyle("NormalText", parent=styles["Normal"], fontSize=10, leading=13)

        buyer = order.buyer_information or BuyerInformationModel(company_name=settings.APP_NAME, company_logo="Logo.png")
        supplier_info = order.supplier_information or SupplierInformationModel(
            supplier_name=supplier.supplier_name if supplier else None,
            company_name=supplier.company_name if supplier else None,
            contact_person=supplier.contact_person if supplier else None,
            phone=supplier.phone if supplier else None,
            email=str(supplier.email) if supplier and supplier.email else None,
            address=supplier.address if supplier else None,
            supplier_id=supplier.id if supplier else order.supplier_id,
        )
        shipping = order.shipping_information or ShippingInformationModel()
        summary = order.order_summary or OrderSummaryModel(total_amount=order.total_amount)
        payment = order.payment_terms or PaymentTermsModel(currency="LKR")
        notes = order.notes or NotesModel()
        authorization = order.authorization or AuthorizationModel()
        footer = order.footer or FooterModel()

        story = []
        logo_path = self._resolve_logo_path()
        header_row = []
        if logo_path:
            header_row.append(Image(str(logo_path), width=32 * mm, height=32 * mm))
        else:
            header_row.append(Paragraph("", normal))
        header_row.append(
            Paragraph(
                f"<b>PURCHASE ORDER</b><br/><font size=9>PO No: {order.id}<br/>Status: {order.status}<br/>Order Date: {self._format_dt(order.order_date)}</font>",
                normal,
            )
        )
        header_tbl = Table([header_row], colWidths=[38 * mm, 140 * mm])
        header_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ]))
        story.append(header_tbl)
        story.append(Spacer(1, 5 * mm))

        buyer_block = [
            "<b>Buyer Information</b>",
            f"Company: {buyer.company_name or '-'}",
            f"Address: {buyer.company_address or '-'}",
            f"Phone: {buyer.phone or '-'}",
            f"Email: {buyer.email or '-'}",
            f"Tax Number: {buyer.tax_number or '-'}",
        ]
        supplier_block = [
            "<b>Supplier Information</b>",
            f"Supplier: {supplier_info.supplier_name or '-'}",
            f"Company: {supplier_info.company_name or '-'}",
            f"Contact Person: {supplier_info.contact_person or '-'}",
            f"Phone: {supplier_info.phone or '-'}",
            f"Email: {supplier_info.email or '-'}",
            f"Address: {supplier_info.address or '-'}",
            f"Supplier ID: {supplier_info.supplier_id or order.supplier_id}",
        ]
        party_table = Table([
            [Paragraph("<br/>".join(buyer_block), small), Paragraph("<br/>".join(supplier_block), small)],
        ], colWidths=[89 * mm, 89 * mm])
        party_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(party_table)
        story.append(Spacer(1, 4 * mm))

        shipping_table = Table([
            [
                Paragraph(f"<b>Shipping Information</b><br/>Ship To: {shipping.ship_to_location or '-'}<br/>Delivery Address: {shipping.delivery_address or '-'}<br/>Receiving Department: {shipping.receiving_department or '-'}<br/>Instructions: {shipping.delivery_instructions or '-'}", small),
                Paragraph(f"<b>PO Header</b><br/>Expected Delivery: {self._format_dt(order.expected_delivery_date)}<br/>Created By: {order.created_by}<br/>Status: {order.status}", small),
            ]
        ], colWidths=[112 * mm, 66 * mm])
        shipping_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(shipping_table)
        story.append(Spacer(1, 4 * mm))

        item_rows = [["#", "Product", "SKU", "Category", "Qty", "Unit Price", "Total Price"]]
        for idx, item in enumerate(order.items, start=1):
            product = product_map.get(item.product_id)
            item_rows.append([
                str(idx),
                product.name if product else item.product_id,
                product.sku if product else "-",
                str(product.category) if product and product.category else "-",
                str(item.quantity),
                self._lkr(item.unit_cost),
                self._lkr(item.total_price if item.total_price else item.quantity * item.unit_cost),
            ])

        items_table = Table(item_rows, colWidths=[10 * mm, 56 * mm, 28 * mm, 26 * mm, 15 * mm, 30 * mm, 33 * mm])
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 4 * mm))

        summary_table = Table([
            ["Subtotal", self._lkr(summary.subtotal)],
            ["Line Discount", self._lkr(summary.line_discount_total)],
            [f"PO Discount", self._lkr(summary.discount)],
            [f"Tax ({summary.tax_rate * 100:.2f}%)", self._lkr(summary.tax_amount)],
            ["Shipping", self._lkr(summary.shipping_cost)],
            ["Total Amount", self._lkr(summary.total_amount)],
        ], colWidths=[45 * mm, 35 * mm])
        summary_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#E2E8F0")),
            ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        summary_wrap = Table([[Paragraph("", normal), summary_table]], colWidths=[98 * mm, 80 * mm])
        summary_wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(summary_wrap)
        story.append(Spacer(1, 4 * mm))

        policy_text = footer.company_policy_note or "All items are subject to quality inspection upon receipt."
        contact_text = footer.contact_information or "For procurement support, contact the clinic purchasing desk."
        notes_text = notes.supplier_notes or "-"
        if notes.internal_notes:
            notes_text = f"{notes_text}<br/><font size=8 color='grey'>Internal notes are intentionally excluded from supplier copy.</font>"

        tail_table = Table([
            [
                Paragraph(f"<b>Payment Terms</b><br/>Terms: {payment.payment_terms or '-'}<br/>Method: {payment.payment_method or '-'}<br/>Currency: LKR", small),
                Paragraph(f"<b>Notes</b><br/>{notes_text}", small),
            ],
            [
                Paragraph(f"<b>Authorization</b><br/>Approved By: {authorization.approved_by or '-'}<br/>Signature: {'Available' if authorization.signature else '-'}<br/>Approval Date: {self._format_dt(authorization.approval_date)}", small),
                Paragraph(f"<b>Footer</b><br/>{policy_text}<br/>{contact_text}", small),
            ]
        ], colWidths=[89 * mm, 89 * mm])
        tail_table.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tail_table)

        doc.build(story)
        return buffer.getvalue()
