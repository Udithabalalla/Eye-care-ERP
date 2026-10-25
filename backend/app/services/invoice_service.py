from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional
from datetime import date, datetime
from pathlib import Path
import io
import math

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.graphics.shapes import Drawing, Group, Rect, String

from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.sales_order_repository import SalesOrderRepository
from app.repositories.prescription_repository import PrescriptionRepository
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate, InvoiceResponse, PaymentRecord
from app.schemas.responses import PaginatedResponse
from app.models.invoice import InvoiceModel
from app.core.exceptions import NotFoundException, BadRequestException
from app.utils.helpers import generate_id, date_to_datetime, is_prescription_valid
from app.services.inventory_movement_service import InventoryMovementService
from app.services.audit_service import AuditService
from app.services.payment_service import PaymentService
from app.services.company_profile_service import CompanyProfileService
from app.schemas.payment import PaymentCreate
from app.schemas.inventory_movement import InventoryMovementCreate
from app.utils.constants import InventoryMovementType, LedgerReferenceType
from app.config.settings import settings

class InvoiceService:
    """Invoice business logic service"""

    def __init__(self, db: AsyncIOMotorDatabase):
        self.invoice_repo = InvoiceRepository(db)
        self.patient_repo = PatientRepository(db)
        self.product_repo = ProductRepository(db)
        self.sales_order_repo = SalesOrderRepository(db)
        self.prescription_repo = PrescriptionRepository(db)
        self.inventory_service = InventoryMovementService(db)
        self.audit_service = AuditService(db)
        self.payment_service = PaymentService(db)
        self.company_profile_service = CompanyProfileService(db)
    
    async def list_invoices(
        self,
        page: int,
        page_size: int,
        patient_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None
    ) -> PaginatedResponse[InvoiceResponse]:
        """List invoices with filters"""
        skip = (page - 1) * page_size
        
        invoices, total = await self.invoice_repo.list_invoices(
            skip=skip,
            limit=page_size,
            patient_id=patient_id,
            payment_status=payment_status,
            start_date=start_date,
            end_date=end_date,
            search=search
        )
        
        total_pages = math.ceil(total / page_size)
        invoice_responses = [InvoiceResponse(**i.dict()) for i in invoices]
        
        return PaginatedResponse(
            data=invoice_responses,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    
    async def get_invoice(self, invoice_id: str) -> InvoiceResponse:
        """Get invoice by ID"""
        invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        return InvoiceResponse(**invoice.dict())
    
    async def create_invoice(
        self,
        invoice_data: InvoiceCreate,
        current_user_id: str,
        deduct_stock: bool = True,
    ) -> InvoiceResponse:
        """Create a new invoice"""
        # Validate product references and (optionally) availability before stock deduction.
        for item in invoice_data.items:
            if getattr(item, "line_type", "product") != "product" or not getattr(item, "track_stock", True):
                continue

            product = await self.product_repo.get_by_product_id(item.product_id)
            if not product:
                raise NotFoundException(f"Product with ID {item.product_id} not found")
            if not product.is_active:
                raise BadRequestException(f"Product {item.product_name} is inactive")
            if deduct_stock and product.current_stock < item.quantity:
                raise BadRequestException(
                    f"Insufficient stock for {product.name}. Available: {product.current_stock}, requested: {item.quantity}"
                )

        # Validate patient exists and is active
        patient = await self.patient_repo.get_by_patient_id(invoice_data.patient_id)
        if not patient:
            raise NotFoundException(f"Patient with ID {invoice_data.patient_id} not found")
        if not patient.is_active:
            raise BadRequestException(f"Patient {invoice_data.patient_id} is inactive and cannot be invoiced")

        if invoice_data.prescription_id:
            prescription = await self.prescription_repo.get_by_prescription_id(invoice_data.prescription_id)
            if not prescription:
                raise NotFoundException(f"Prescription with ID {invoice_data.prescription_id} not found")
            # Prescriptions are not expired in this system — they are renewed.
            # No expiry check.

        if invoice_data.sales_order_id:
            sales_order = await self.sales_order_repo.get_by_order_id(invoice_data.sales_order_id)
            if not sales_order:
                raise NotFoundException(f"Sales order with ID {invoice_data.sales_order_id} not found")
        
        # Generate invoice ID and number
        next_number = await self.invoice_repo.get_next_invoice_number(datetime.now().year)
        invoice_id = generate_id("INV", int(next_number.split("-")[-1]))
        
        # Calculate totals
        subtotal = sum(item.total for item in invoice_data.items)
        total_discount = sum(item.discount for item in invoice_data.items)
        total_tax = sum(item.tax for item in invoice_data.items)
        total_amount = subtotal
        balance_due = total_amount
        
        # Convert dates to datetime
        invoice_date_dt = date_to_datetime(invoice_data.invoice_date)
        due_date_dt = date_to_datetime(invoice_data.due_date)
        
        # Create invoice model
        invoice_model = InvoiceModel(
            invoice_id=invoice_id,
            invoice_number=next_number,
            patient_name=patient.name,
            patient_phone=patient.phone,
            patient_email=patient.email,
            subtotal=subtotal,
            total_discount=total_discount,
            total_tax=total_tax,
            total_amount=total_amount,
            balance_due=balance_due,
            created_by=current_user_id,
            invoice_date=invoice_date_dt,
            due_date=due_date_dt,
            **invoice_data.dict(exclude={'invoice_date', 'due_date'})
        )
        
        # Deduct stock atomically for all items before invoice save.
        deducted_items = []
        try:
            if deduct_stock:
                for item in invoice_data.items:
                    if getattr(item, "line_type", "product") != "product" or not getattr(item, "track_stock", True):
                        continue
                    ok = await self.product_repo.decrement_stock_atomic(item.product_id, item.quantity)
                    if not ok:
                        raise BadRequestException(
                            f"Failed to deduct stock for product {item.product_id}. Stock may have changed, please retry."
                        )
                    deducted_items.append((item.product_id, item.quantity))

                    await self.inventory_service.create_movement(
                        InventoryMovementCreate(
                            product_id=item.product_id,
                            movement_type=InventoryMovementType.SALE_OUT,
                            quantity=item.quantity,
                            reference_type=LedgerReferenceType.INVOICE,
                            reference_id=invoice_id,
                        ),
                        current_user_id,
                        apply_stock_change=False,
                    )

            # Save invoice only after stock deduction succeeds.
            created_invoice = await self.invoice_repo.create_invoice(invoice_model)
        except Exception:
            # Best-effort rollback for already deducted items.
            for product_id, quantity in deducted_items:
                await self.product_repo.increment_stock_atomic(product_id, quantity)
            raise
        
        return InvoiceResponse(**created_invoice.dict())
    
    async def update_invoice(
        self,
        invoice_id: str,
        invoice_data: InvoiceUpdate
    ) -> InvoiceResponse:
        """Update invoice"""
        existing = await self.invoice_repo.get_by_invoice_id(invoice_id)
        if not existing:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        update_dict = invoice_data.dict(exclude_unset=True)
        
        # Convert date fields to datetime
        if 'due_date' in update_dict and update_dict['due_date']:
            update_dict['due_date'] = date_to_datetime(update_dict['due_date'])
        
        if update_dict:
            await self.invoice_repo.update_invoice(invoice_id, update_dict)
        
        updated_invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        return InvoiceResponse(**updated_invoice.dict())
    
    async def record_payment(
        self,
        invoice_id: str,
        payment: PaymentRecord,
        current_user_id: str,
    ):
        """Record a payment for an invoice"""
        invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")
        
        new_paid_amount = invoice.paid_amount + payment.amount
        new_balance = invoice.total_amount - new_paid_amount
        
        if new_paid_amount > invoice.total_amount:
            raise BadRequestException("Payment amount exceeds invoice total")
        
        payment_status = "paid" if new_balance == 0 else "partial"
        
        payment_record = await self.payment_service.create_payment(
            PaymentCreate(
                amount=payment.amount,
                payment_method=payment.payment_method,
                reference_type=LedgerReferenceType.INVOICE,
                reference_id=invoice_id,
                payment_date=payment.payment_date,
            ),
            current_user_id=current_user_id,
        )

        payment_date_dt = date_to_datetime(payment.payment_date)

        await self.invoice_repo.update_invoice(
            invoice_id,
            {
                "paid_amount": new_paid_amount,
                "balance_due": new_balance,
                "payment_status": payment_status,
                "payment_method": payment.payment_method,
                "payment_date": payment_date_dt,
                "transaction_id": payment_record.transaction_id,
            }
        )

        await self.audit_service.log(
            current_user_id,
            "invoice_payment_recorded",
            "Invoice",
            invoice_id,
            new_value={"paid_amount": new_paid_amount, "balance_due": new_balance},
        )

    async def generate_invoice_pdf(self, invoice_id: str) -> tuple[bytes, str]:
        """Render a professional A4 invoice PDF for download / handing to the customer."""
        invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")

        patient = await self.patient_repo.get_by_patient_id(invoice.patient_id)
        company_profile = await self.company_profile_service.get_company_profile()

        pdf_bytes = self._build_invoice_pdf(invoice, patient, company_profile)
        filename = f"{invoice.invoice_number}.pdf"
        return pdf_bytes, filename

    @staticmethod
    def _fmt_dt(value) -> str:
        if not value:
            return "-"
        return value.strftime("%d %b %Y")

    @staticmethod
    def _money(value: Optional[float]) -> str:
        return f"LKR {value or 0:,.2f}"

    @staticmethod
    def _resolve_asset_path(candidate: Optional[str]) -> Optional[Path]:
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
            backend_root / "static" / candidate,
        ]
        for path in candidates:
            if path.exists() and path.is_file():
                return path
        return None

    # Brand accent shared with the on-screen invoice preview (Frontend InvoicePreview.tsx)
    ACCENT = "#007595"
    DEFAULT_LOGO = "brand/logo-full-primary.png"

    @staticmethod
    def _paid_seal(paid_on) -> Drawing:
        """Rubber-stamp style PAID seal, drawn as a flowable."""
        green = colors.HexColor("#059669")
        drawing = Drawing(60 * mm, 30 * mm)
        seal = Group(
            Rect(-24 * mm, -9 * mm, 48 * mm, 18 * mm, rx=3 * mm, ry=3 * mm, strokeColor=green, strokeWidth=2.2, fillColor=None),
            Rect(-22.5 * mm, -7.5 * mm, 45 * mm, 15 * mm, rx=2.2 * mm, ry=2.2 * mm, strokeColor=green, strokeWidth=0.8, fillColor=None),
            String(0, -1.5 * mm, "PAID", fontName="Helvetica-Bold", fontSize=22, fillColor=green, textAnchor="middle"),
        )
        if paid_on:
            seal.add(String(0, -5.6 * mm, paid_on.strftime("%d %b %Y").upper(), fontName="Helvetica-Bold", fontSize=6.5, fillColor=green, textAnchor="middle"))
        seal.translate(30 * mm, 15 * mm)
        seal.rotate(12)
        drawing.add(seal)
        return drawing

    def _build_invoice_pdf(
        self,
        invoice: InvoiceModel,
        patient,
        company_profile,
        title: str = "INVOICE",
        number_label: str = "Invoice number",
        banner: Optional[str] = None,
    ) -> bytes:
        """
        The printed invoice, laid out like the on-screen preview (InvoicePreview.tsx).
        Sales orders without an invoice print through here too, under their own title.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=16 * mm,
            rightMargin=16 * mm,
            topMargin=16 * mm,
            bottomMargin=16 * mm,
            title=f"{title.title()} {invoice.invoice_number}",
        )
        ink = colors.HexColor("#0F172A")
        slate = colors.HexColor("#64748B")
        hairline = colors.HexColor("#E2E8F0")
        accent = colors.HexColor(self.ACCENT)
        content_width = 178 * mm

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("InvoiceTitle", parent=styles["Heading1"], fontSize=24, leading=28, textColor=ink, spaceAfter=0)
        label = ParagraphStyle("Label", parent=styles["Normal"], fontSize=8.5, leading=12, textColor=slate)
        small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, leading=13, textColor=ink)
        normal = ParagraphStyle("NormalText", parent=styles["Normal"], fontSize=10, leading=14, textColor=ink)
        muted = ParagraphStyle("Muted", parent=styles["Normal"], fontSize=8.5, leading=12, textColor=slate)
        right_small = ParagraphStyle("RightSmall", parent=small, alignment=2)
        head_cell = ParagraphStyle("HeadCell", parent=label, fontName="Helvetica")
        head_cell_right = ParagraphStyle("HeadCellRight", parent=head_cell, alignment=2)

        # Printed invoices carry no status badge; a fully paid invoice gets a PAID seal instead
        status_value = invoice.payment_status.value if hasattr(invoice.payment_status, "value") else str(invoice.payment_status)
        is_paid = status_value == "paid" or (invoice.total_amount > 0 and invoice.balance_due <= 0 and status_value != "cancelled")

        story = []

        # ── Header: title, number, status | logo ─────────────────────────
        logo_name = company_profile.company_logo if company_profile.company_logo not in (None, "", "Logo.png") else self.DEFAULT_LOGO
        logo_path = self._resolve_asset_path(logo_name) or self._resolve_asset_path("Logo.png")
        logo = Image(str(logo_path), width=24 * mm, height=18.4 * mm, kind="proportional") if logo_path else Paragraph("", normal)

        header_left = [
            Paragraph(title, title_style),
            Paragraph(f"{number_label} &nbsp;<font color='#0F172A'>#{invoice.invoice_number}</font>", muted),
        ]
        if banner:
            header_left.append(Spacer(1, 1.5 * mm))
            header_left.append(Paragraph(f"<font color='#B45309'>{banner}</font>", muted))
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

        def stack(title: str, lines: list[str]) -> list:
            return [Paragraph(title, label)] + [Paragraph(line, small) for line in lines if line]

        def two_columns(left: list, right: list) -> Table:
            table = Table([[left, right]], colWidths=[content_width / 2, content_width / 2])
            table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]))
            return table

        # ── Billed by | billed to ─────────────────────────────────────────
        patient_address = ""
        if patient and patient.address:
            parts = [patient.address.street, patient.address.city, patient.address.state, patient.address.zip_code]
            patient_address = ", ".join(p for p in parts if p)

        billed_by = stack("Billed by", [
            f"<b>{company_profile.company_name or settings.APP_NAME}</b>",
            company_profile.email or "",
            company_profile.address or "",
            company_profile.phone or "",
            f"Tax no. {company_profile.tax_number}" if company_profile.tax_number else "",
        ])
        billed_to = stack("Billed to", [
            f"<b>{invoice.patient_name}</b>",
            invoice.patient_phone or "",
            invoice.patient_email or "",
            patient_address,
        ])
        story.append(two_columns(billed_by, billed_to))
        story.append(Spacer(1, 5 * mm))

        # ── Dates and references ──────────────────────────────────────────
        story.append(two_columns(
            stack("Date issued", [f"<b>{self._fmt_dt(invoice.invoice_date)}</b>"]) + [Spacer(1, 2 * mm)]
            + stack("Sales order", [f"<b>{invoice.sales_order_id or '-'}</b>"]),
            stack("Due date", [f"<b>{self._fmt_dt(invoice.due_date)}</b>"]) + [Spacer(1, 2 * mm)]
            + stack("Prescription", [f"<b>{invoice.prescription_id or '-'}</b>"]),
        ))
        story.append(Spacer(1, 7 * mm))

        # ── Line items ─────────────────────────────────────────────────
        line_type_labels = {"lens": "Lens", "frame": "Frame", "expense": "Service", "complimentary": "Free"}
        story.append(Paragraph("Items &amp; services", label))
        story.append(Spacer(1, 1.5 * mm))
        item_rows = [[
            Paragraph("Item", head_cell),
            Paragraph("Qty", head_cell_right),
            Paragraph("Price", head_cell_right),
            Paragraph("Amount", head_cell_right),
        ]]
        for item in invoice.items:
            kind = line_type_labels.get(item.line_type, "Product")
            detail = " · ".join(part for part in [kind, item.sku, f"{self._money(item.discount)} off" if item.discount else ""] if part)
            is_free = item.line_type == "complimentary"
            item_rows.append([
                Paragraph(f"<b>{item.product_name}</b><br/><font size=7.5 color='#64748B'>{detail}</font>", small),
                Paragraph(str(item.quantity), right_small),
                Paragraph("-" if is_free else self._money(item.unit_price), right_small),
                Paragraph("<font color='#059669'><b>Free</b></font>" if is_free else f"<b>{self._money(item.total)}</b>", right_small),
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
        story.append(items_table)
        story.append(Spacer(1, 5 * mm))

        # ── Totals ─────────────────────────────────────────────────────
        totals_rows = [[Paragraph("Subtotal", muted), Paragraph(self._money(invoice.subtotal), right_small)]]
        if invoice.total_discount:
            totals_rows.append([Paragraph("Discount", muted), Paragraph(f"-{self._money(invoice.total_discount)}", right_small)])
        if invoice.total_tax:
            totals_rows.append([Paragraph("Tax", muted), Paragraph(self._money(invoice.total_tax), right_small)])
        grand_index = len(totals_rows)
        totals_rows.append([
            Paragraph("<b>Grand total</b>", normal),
            Paragraph(f"<b>{self._money(invoice.total_amount)}</b>", ParagraphStyle("GrandRight", parent=normal, alignment=2)),
        ])
        if invoice.paid_amount:
            totals_rows.append([Paragraph("Paid", muted), Paragraph(self._money(invoice.paid_amount), right_small)])
        balance_style = [
            ("BACKGROUND", (0, len(totals_rows)), (-1, len(totals_rows)), colors.HexColor("#E6F1F4")),
        ]
        totals_rows.append([
            Paragraph(f"<font color='{self.ACCENT}'><b>Balance due</b></font>", small),
            Paragraph(f"<font color='{self.ACCENT}'><b>{self._money(invoice.balance_due)}</b></font>", right_small),
        ])

        totals_table = Table(totals_rows, colWidths=[38 * mm, 42 * mm])
        totals_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LINEABOVE", (0, grand_index), (-1, grand_index), 0.75, hairline),
            ("TOPPADDING", (0, grand_index), (-1, grand_index), 6),
            *balance_style,
        ]))
        # A fully paid invoice gets a PAID seal beside the totals (same place as the on-screen preview)
        seal = self._paid_seal(invoice.payment_date or invoice.updated_at) if is_paid else Paragraph("", normal)
        totals_wrap = Table([[seal, totals_table]], colWidths=[content_width - 80 * mm, 80 * mm])
        totals_wrap.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(totals_wrap)
        story.append(Spacer(1, 6 * mm))

        # ── Payment info ───────────────────────────────────────────────
        if invoice.payment_method or invoice.payment_date or invoice.transaction_id:
            payment_method = invoice.payment_method.value if hasattr(invoice.payment_method, "value") else invoice.payment_method
            story.append(KeepTogether(stack("Payment information", [
                f"Method: {payment_method or '-'}",
                f"Paid on: {self._fmt_dt(invoice.payment_date)}",
                f"Transaction ID: {invoice.transaction_id or '-'}",
            ])))
            story.append(Spacer(1, 5 * mm))

        # ── Notes ──────────────────────────────────────────────────────
        if invoice.notes:
            note = Table([[Paragraph(f"<b>Note:</b> {invoice.notes}", small)]], colWidths=[content_width])
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

        footer = Table([[Paragraph(
            "Thank you for your trust. For any questions regarding this invoice, please contact us using the details above.",
            muted,
        )]], colWidths=[content_width])
        footer.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, hairline),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(footer)

        doc.build(story)
        return buffer.getvalue()
