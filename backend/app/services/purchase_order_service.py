from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
import math
from datetime import datetime, date, timezone
from pathlib import Path
import io

from app.repositories.purchase_order_repository import PurchaseOrderRepository
from app.repositories.supplier_repository import SupplierRepository
from app.repositories.product_repository import ProductRepository
from app.services.company_profile_service import CompanyProfileService
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
        self.company_profile_service = CompanyProfileService(db)

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

        company_profile = await self.company_profile_service.get_company_profile()

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
            is_locked=False,
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
        if status not in {"Approved", "Sent", "Received", "Closed"}:
            raise BadRequestException("Invalid purchase order status")
        if order.status != "Draft" or status != "Approved":
            raise BadRequestException("Only Draft purchase orders can be approved in the MVP workflow")

        approval_date = datetime.now(timezone.utc)
        authorization = order.authorization or AuthorizationModel()
        authorization.approved_by = "WAS Kumudini"
        authorization.signature = "sign.png"
        authorization.approval_date = approval_date

        await self.repo.update(
            {"id": order_id},
            {
                "status": "Approved",
                "is_locked": True,
                "authorization": authorization.dict(),
            },
        )
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
        company_profile = await self.company_profile_service.get_company_profile()
        product_map = {}
        for item in order.items:
            product = await self.product_repo.get_by_product_id(item.product_id)
            if product:
                product_map[item.product_id] = product

        pdf_bytes = self._build_po_pdf(order, supplier, product_map, company_profile)
        filename = f"{order.id}.pdf"
        return pdf_bytes, filename

    def _to_response(self, order: PurchaseOrderModel) -> PurchaseOrderResponse:
        def dump_value(value):
            if value is None:
                return None
            if hasattr(value, "model_dump"):
                return value.model_dump(mode="json")
            if hasattr(value, "dict"):
                return value.dict()
            return value

        return PurchaseOrderResponse(
            id=order.id,
            supplier_id=order.supplier_id,
            order_date=order.order_date,
            expected_delivery_date=order.expected_delivery_date,
            status=order.status,
            total_amount=order.total_amount,
            created_by=order.created_by,
            is_locked=order.is_locked,
            items=[PurchaseOrderItemResponse(**item.dict()) for item in order.items],
            buyer_information=dump_value(order.buyer_information),
            supplier_information=dump_value(order.supplier_information),
            shipping_information=dump_value(order.shipping_information),
            order_summary=dump_value(order.order_summary),
            payment_terms=dump_value(order.payment_terms),
            notes=dump_value(order.notes),
            authorization=dump_value(order.authorization),
            footer=dump_value(order.footer),
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

    def _build_po_pdf(self, order: PurchaseOrderModel, supplier, product_map: dict, company_profile) -> bytes:
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
        heading_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading3"],
            fontSize=10,
            leading=12,
            textColor=colors.white,
        )
        small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, leading=12)
        normal = ParagraphStyle("NormalText", parent=styles["Normal"], fontSize=10, leading=13)

        buyer = order.buyer_information or BuyerInformationModel(
            company_name=company_profile.company_name or settings.APP_NAME,
            company_logo=company_profile.company_logo or "Logo.png",
            company_address=company_profile.address,
            phone=company_profile.phone,
            email=company_profile.email,
            tax_number=company_profile.tax_number,
        )
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
        authorization = order.authorization or AuthorizationModel(
            approved_by="WAS Kumudini" if order.status == "Approved" else None,
            signature="sign.png" if order.status == "Approved" else None,
            approval_date=order.updated_at if order.status == "Approved" else None,
        )
        footer = order.footer or FooterModel()

        story = []
        logo_path = self._resolve_asset_path(buyer.company_logo or "Logo.png")
        header_details = [
            f"<b>{buyer.company_name or company_profile.company_name or settings.APP_NAME}</b>",
            buyer.company_address or company_profile.address or "-",
            f"Phone: {buyer.phone or company_profile.phone or '-'}",
            f"Email: {buyer.email or company_profile.email or '-'}",
            f"Tax Number: {buyer.tax_number or company_profile.tax_number or '-'}",
        ]
        header_row = [
            Image(str(logo_path), width=28 * mm, height=28 * mm) if logo_path else Paragraph("", normal),
            Paragraph("<br/>".join(header_details), normal),
        ]
        header_tbl = Table([header_row], colWidths=[35 * mm, 143 * mm])
        header_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(header_tbl)
        story.append(Spacer(1, 5 * mm))

        def section_table(title: str, body_cells: list[str]) -> Table:
            table = Table(
                [[Paragraph(title, heading_style)], [Paragraph("<br/>".join(body_cells), small)]],
                colWidths=[178 * mm],
                repeatRows=1,
            )
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]))
            return table

        story.append(section_table(
            "Purchase Order Header",
            [
                f"PO Number: {order.id}",
                f"Order Date: {self._format_dt(order.order_date)}",
                f"Expected Delivery: {self._format_dt(order.expected_delivery_date)}",
                f"Status: {order.status}",
            ],
        ))
        story.append(Spacer(1, 4 * mm))

        story.append(section_table(
            "Buyer Information",
            [
                f"Company: {buyer.company_name or company_profile.company_name or '-'}",
                f"Address: {buyer.company_address or company_profile.address or '-'}",
                f"Phone: {buyer.phone or company_profile.phone or '-'}",
                f"Email: {buyer.email or company_profile.email or '-'}",
                f"Tax Number: {buyer.tax_number or company_profile.tax_number or '-'}",
            ],
        ))
        story.append(Spacer(1, 4 * mm))

        story.append(section_table(
            "Supplier Information",
            [
                f"Supplier: {supplier_info.supplier_name or '-'}",
                f"Company: {supplier_info.company_name or '-'}",
                f"Contact Person: {supplier_info.contact_person or '-'}",
                f"Phone: {supplier_info.phone or '-'}",
                f"Address: {supplier_info.address or '-'}",
                f"Supplier ID: {supplier_info.supplier_id or order.supplier_id}",
            ],
        ))
        story.append(Spacer(1, 4 * mm))

        story.append(section_table(
            "Shipping Information",
            [
                f"Ship To: {shipping.ship_to_location or '-'}",
                f"Delivery Address: {shipping.delivery_address or '-'}",
                f"Receiving Department: {shipping.receiving_department or '-'}",
                f"Delivery Instructions: {shipping.delivery_instructions or '-'}",
            ],
        ))
        story.append(Spacer(1, 4 * mm))

        item_rows = [[
            Paragraph("#", heading_style),
            Paragraph("Product", heading_style),
            Paragraph("SKU", heading_style),
            Paragraph("Category", heading_style),
            Paragraph("Qty", heading_style),
            Paragraph("Unit Price", heading_style),
            Paragraph("Total", heading_style),
        ]]
        for idx, item in enumerate(order.items, start=1):
            product = product_map.get(item.product_id)
            item_rows.append([
                str(idx),
                Paragraph((product.name if product else item.product_id)[:120], small),
                Paragraph((product.sku if product else "-")[:60], small),
                Paragraph((str(product.category) if product and product.category else "-")[:60], small),
                Paragraph(str(item.quantity), small),
                Paragraph(self._lkr(item.unit_cost), small),
                Paragraph(self._lkr(item.total_price if item.total_price else item.quantity * item.unit_cost), small),
            ])

        items_table = Table(
            item_rows,
            colWidths=[10 * mm, 52 * mm, 24 * mm, 24 * mm, 14 * mm, 27 * mm, 27 * mm],
            repeatRows=1,
            splitByRow=1,
        )
        items_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 1), (0, -1), "CENTER"),
            ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("LEADING", (0, 0), (-1, -1), 11),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(items_table)
        story.append(Spacer(1, 4 * mm))

        summary_table = Table([
            [Paragraph("Subtotal", small), Paragraph(self._lkr(summary.subtotal), small)],
            [Paragraph("Line Discount", small), Paragraph(self._lkr(summary.line_discount_total), small)],
            [Paragraph("PO Discount", small), Paragraph(self._lkr(summary.discount), small)],
            [Paragraph(f"Tax ({summary.tax_rate * 100:.2f}%)", small), Paragraph(self._lkr(summary.tax_amount), small)],
            [Paragraph("Shipping", small), Paragraph(self._lkr(summary.shipping_cost), small)],
            [Paragraph("Total Amount", small), Paragraph(self._lkr(summary.total_amount), small)],
        ], colWidths=[45 * mm, 35 * mm])
        summary_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#E2E8F0")),
            ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        summary_wrap = Table([[Paragraph("", normal), summary_table]], colWidths=[98 * mm, 80 * mm])
        summary_wrap.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(summary_wrap)
        story.append(Spacer(1, 4 * mm))

        story.append(section_table(
            "Payment Terms",
            [
                f"Payment Terms: {payment.payment_terms or '-'}",
                f"Payment Method: {payment.payment_method or '-'}",
                "Currency: LKR",
            ],
        ))
        story.append(Spacer(1, 4 * mm))

        story.append(section_table(
            "Notes",
            [
                f"Supplier Notes: {notes.supplier_notes or '-'}",
                "Internal Notes: Hidden in supplier copy",
            ],
        ))
        story.append(Spacer(1, 4 * mm))

        signature_path = self._resolve_asset_path(authorization.signature or "sign.png")
        signature_cell = Image(str(signature_path), width=36 * mm, height=14 * mm) if signature_path else Paragraph(authorization.signature or "-", small)
        auth_table = Table([
            [Paragraph("Approved By", heading_style), Paragraph("Signature", heading_style)],
            [Paragraph(authorization.approved_by or "-", small), signature_cell],
            [Paragraph("Approval Date", heading_style), Paragraph(self._format_dt(authorization.approval_date), small)],
        ], colWidths=[89 * mm, 89 * mm], repeatRows=1)
        auth_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("SPAN", (0, 2), (1, 2)),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#D1D5DB")),
            ("INNERGRID", (0, 1), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(auth_table)

        story.append(Spacer(1, 4 * mm))
        story.append(section_table(
            "Footer",
            [
                f"Company Policy Note: {footer.company_policy_note or 'All items are subject to quality inspection upon receipt.'}",
                f"Contact Information: {footer.contact_information or 'For procurement support, contact the clinic purchasing desk.'}",
            ],
        ))

        doc.build(story)
        return buffer.getvalue()
