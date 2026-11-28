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
from app.utils.helpers import business_today, date_to_datetime, is_prescription_valid
from app.services.inventory_movement_service import InventoryMovementService
from app.services.audit_service import AuditService
from app.services.payment_service import PaymentService
from app.services.company_profile_service import CompanyProfileService
from app.models.company_profile import DEFAULT_INVOICE_ACCENT, InvoiceAppearance
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
        
        # Generate invoice ID and number. The number restarts each year; the ID comes from
        # a global counter so it never repeats.
        next_number = await self.invoice_repo.get_next_invoice_number(business_today().year)
        invoice_id = await self.invoice_repo.next_invoice_id()
        
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
        """The customer invoice as an A5 PDF, in the same design as the printed invoice."""
        invoice = await self.invoice_repo.get_by_invoice_id(invoice_id)
        if not invoice:
            raise NotFoundException(f"Invoice with ID {invoice_id} not found")

        patient = await self.patient_repo.get_by_patient_id(invoice.patient_id)
        company_profile = await self.company_profile_service.get_company_profile()

        payments = await self.invoice_payments(invoice.invoice_id)
        pdf_bytes = self._build_invoice_pdf(invoice, patient, company_profile, payments=payments)
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
        """Rubber-stamp style PAID seal, drawn as a flowable. Used on purchase records
        (purchase_order_service); customer invoices are stamped by hand instead."""
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

    @staticmethod
    def _customer_lines(items) -> list:
        """
        The lines the customer sees (same rules as customerInvoiceLines in the frontend's
        utils/invoicePreview.ts). The glasses are one priced line: new frame and new lenses
        are a "Pair of spectacles", the patient's own frame with new lenses a "Pair of lenses",
        a new frame without new lenses "Frame (lenses OG)". Services go into that line;
        inventory items are listed on their own; free items are left off.
        """
        kind = lambda item: getattr(item, "line_type", "product") or "product"
        frames = [i for i in items if kind(i) == "frame"]
        lenses = [i for i in items if kind(i) == "lens"]
        services = [i for i in items if kind(i) == "expense"]
        products = [i for i in items if kind(i) == "product"]
        row = lambda i, grouped=False: {
            "name": i.product_name, "kind": kind(i), "sku": i.sku, "quantity": i.quantity,
            "unit_price": i.unit_price, "discount": getattr(i, "discount", 0) or 0, "total": i.total, "grouped": grouped,
        }
        new_frame = any(i.total > 0 for i in frames)
        new_lenses = any(i.total > 0 for i in lenses)
        name = ("Pair of spectacles" if new_frame and new_lenses else "Pair of lenses" if new_lenses
                else "Frame (lenses OG)" if new_frame else None)
        if not name:
            return [row(i) for i in services + products]
        grouped = frames + lenses + services
        total = round(sum(i.total for i in grouped), 2)
        discount = round(sum(getattr(i, "discount", 0) or 0 for i in grouped), 2)
        glasses = {"name": name, "kind": "lens" if new_lenses else "frame", "sku": None, "quantity": 1,
                   "unit_price": round(total + discount, 2), "discount": discount, "total": total, "grouped": True}
        return [glasses] + [row(i) for i in products]

    # The invoice design (Frontend InvoicePreview.tsx): teal accents, navy wordmark
    TEAL = "#1F6378"
    NAVY = "#14324A"
    BALANCE_BG = "#C8E2EA"
    SLOGAN = "You Protect Eye, Eye Protects You"

    @classmethod
    def _brand_mark(cls, width, height, color: Optional[str] = None):
        """The eye mark tinted teal, or `color` (the asset is black on transparent), or None if missing."""
        path = cls._resolve_asset_path("brand/logo-mark.png")
        if not path:
            return None
        from PIL import Image as PILImage, ImageColor
        mark = PILImage.open(path).convert("RGBA")
        tinted = PILImage.new("RGBA", mark.size, ImageColor.getrgb(color or cls.TEAL) + (255,))
        tinted.putalpha(mark.getchannel("A"))
        buf = io.BytesIO()
        tinted.save(buf, "PNG")
        buf.seek(0)
        return Image(buf, width=width, height=height, kind="proportional")

    @classmethod
    def _order_qr(cls, value: str, size, color: Optional[str] = None):
        """The order's ID as a QR code in teal (or `color`), so scanning the invoice opens the order."""
        from reportlab.graphics.barcode import qr
        widget = qr.QrCodeWidget(value, barLevel="M")
        widget.barFillColor = colors.HexColor(color or cls.TEAL)
        widget.barStrokeColor = colors.HexColor(color or cls.TEAL)
        x1, y1, x2, y2 = widget.getBounds()
        drawing = Drawing(size, size, transform=[size / (x2 - x1), 0, 0, size / (y2 - y1), 0, 0])
        drawing.add(widget)
        return drawing

    async def invoice_payments(self, invoice_id: str) -> list:
        """The payments recorded against an invoice (the advance included), oldest first"""
        payments, _ = await self.payment_service.repo.list_payments(
            skip=0, limit=100, reference_type=LedgerReferenceType.INVOICE.value, reference_id=invoice_id
        )
        return sorted(payments, key=lambda payment: payment.payment_date)

    @staticmethod
    def _payment_lines(payments: list, total: float) -> list[tuple[str, Optional[datetime], float]]:
        """
        The payments as the invoice lists them, oldest first: the first is the advance, the one
        that clears the balance is the full payment, any in between are part payments, and a
        single payment covering the total is "Paid in full" (Frontend utils/invoicePreview.ts).
        """
        from datetime import timezone
        from app.utils.helpers import business_tz

        ordered = sorted(payments, key=lambda payment: payment.payment_date)
        lines, paid = [], 0.0
        for index, payment in enumerate(ordered):
            paid = round(paid + payment.amount, 2)
            settles = paid >= round(total or 0, 2) - 0.005
            if len(ordered) == 1 and settles:
                label = "Paid in full"
            elif index == 0:
                label = "Advance payment"
            else:
                label = "Full payment" if settles else "Part payment"
            when = payment.payment_date
            # Stored in UTC; a midnight value is a calendar date picked in the payment form
            if when and when.tzinfo is None and (when.hour, when.minute, when.second) != (0, 0, 0):
                when = when.replace(tzinfo=timezone.utc).astimezone(business_tz())
            lines.append((label, when, payment.amount))
        return lines

    @staticmethod
    def _fmt_long_date(value) -> str:
        """Dates as on the printed invoice, e.g. November 22, 2026"""
        if not value:
            return "-"
        return f"{value.strftime('%B')} {value.day}, {value.year}"

    @staticmethod
    def _customer_code(sku: Optional[str]) -> Optional[str]:
        """A line's code without database IDs (24 hex characters), as on the printed invoice"""
        import re
        return None if not sku or re.fullmatch(r"[0-9a-fA-F]{24}", sku) else sku

    @staticmethod
    def _appearance(company_profile) -> InvoiceAppearance:
        """The shop's invoice appearance (Settings → Invoice Appearance), or the defaults"""
        appearance = getattr(company_profile, "invoice_appearance", None)
        if isinstance(appearance, InvoiceAppearance):
            return appearance
        if isinstance(appearance, dict):
            return InvoiceAppearance(**appearance)
        return InvoiceAppearance()

    @staticmethod
    def _tint(hex_color: str, share: float) -> str:
        """`hex_color` mixed with white; share 0.25 keeps a quarter of the colour"""
        mix = lambda channel: round(255 - share * (255 - int(hex_color[channel:channel + 2], 16)))
        return "#{:02X}{:02X}{:02X}".format(mix(1), mix(3), mix(5))

    def _build_invoice_pdf(
        self,
        invoice: InvoiceModel,
        patient,
        company_profile,
        title: str = "INVOICE",
        number_label: str = "Invoice No",
        banner: Optional[str] = None,
        group_glasses: bool = True,
        payments: Optional[list] = None,
    ) -> bytes:
        """
        The customer invoice as an A5 PDF, in the same design as the printed invoice
        (Frontend InvoicePreview.tsx), styled by the shop's invoice appearance: layout
        (classic, split or ledger), accent colour, typeface, spacing and which parts show.
        Sales orders without an invoice print through here too, under their own title and
        with every line (group_glasses=False).
        """
        from reportlab.lib.pagesizes import A5
        from reportlab.platypus.flowables import HRFlowable, TopPadder

        look = self._appearance(company_profile)
        layout = look.layout
        accent_hex = look.accent.upper()

        buffer = io.BytesIO()
        margin = 10 * mm
        doc = SimpleDocTemplate(
            buffer, pagesize=A5, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
            title=f"{title.title()} {invoice.invoice_number}",
        )
        width = A5[0] - 2 * margin  # 128 mm, as in the printed design
        teal, navy = colors.HexColor(accent_hex), colors.HexColor(self.NAVY)
        body_ink, ink, muted_ink = colors.HexColor("#334155"), colors.HexColor("#0F172A"), colors.HexColor("#64748B")
        rule = colors.HexColor(self._tint(accent_hex, 0.25))
        balance_bg = self.BALANCE_BG if accent_hex == DEFAULT_INVOICE_ACCENT else self._tint(accent_hex, 0.2)
        # Courier sets wider than Helvetica: a size smaller keeps amounts on one line
        fonts = (("Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique") if look.typeface == "mono"
                 else ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique"))
        scale = 0.9 if look.typeface == "mono" else 1.0
        gap = 1.0 if look.spacing == "roomy" else 0.6

        def space(height):
            return Spacer(1, height * gap)

        def style(name, size, color=body_ink, bold=False, italic=False, align=0, leading=None):
            font = fonts[3] if bold and italic else fonts[1] if bold else fonts[2] if italic else fonts[0]
            return ParagraphStyle(name, fontName=font, fontSize=size * scale, leading=(leading or size * 1.3) * scale,
                                  textColor=color, alignment=align)

        body = style("Body", 8.25)
        body_ink_style = style("BodyInk", 8.25, ink)
        small = style("Small", 6.75, muted_ink)
        label = style("Label", 6.75, muted_ink)
        item_name = style("ItemName", 9, ink)
        cell_right = style("CellRight", 8.25, ink, align=2)
        cell_center = style("CellCenter", 8.25, body_ink, align=1)
        # Classic sets the column names in white on an accent bar; split in the accent colour over a
        # rule; ledger small and grey between two rules
        head_color = colors.white if layout == "classic" else teal if layout == "split" else muted_ink
        head_size = 6.75 if layout == "ledger" else 8.25
        head = style("Head", head_size, head_color)
        head_right = style("HeadRight", head_size, head_color, align=2)
        head_center = style("HeadCenter", head_size, head_color, align=1)
        heading = style("Heading", 9, teal, bold=True)

        def plain_table(rows, col_widths, extra=()):
            table = Table(rows, colWidths=col_widths)
            table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                *extra,
            ]))
            return table

        def as_date(value):
            return value.date() if isinstance(value, datetime) else value

        def due_text() -> Optional[str]:
            due = as_date(getattr(invoice, "due_date", None))
            issued = as_date(getattr(invoice, "invoice_date", None))
            if not due:
                return None
            return "On receipt" if issued and due <= issued else self._fmt_long_date(due)

        story = []

        # ── Who the invoice is from and to ─────────────────────────────────
        patient_address = ""
        if patient and getattr(patient, "address", None):
            parts = [patient.address.street, patient.address.city, patient.address.state, patient.address.zip_code]
            patient_address = ", ".join(p for p in parts if p)
        office = []
        if company_profile.address:
            office.append(Paragraph(company_profile.address, body))
        if company_profile.phone:
            office += [Spacer(1, 1 * mm), Paragraph(company_profile.phone, body_ink_style)]
        if company_profile.tax_number and look.show_tax:
            office.append(Paragraph(f"Tax no. {company_profile.tax_number}", style("Tax", 8.25, muted_ink)))
        customer = [Paragraph(invoice.patient_name or "", body_ink_style)]
        customer += [Paragraph(text, body) for text in (invoice.patient_phone, invoice.patient_email, patient_address) if text]

        mark = self._brand_mark(15 * mm, 10 * mm, accent_hex) if look.show_logo else None
        wordmark = Paragraph(f"<font color='{self.NAVY}'>Vision</font><br/><font color='{accent_hex}'>Opticals.</font>",
                             style("Wordmark", 17, bold=True, leading=18))
        brand = ([mark, Spacer(1, 1 * mm)] if mark else []) + [wordmark]
        banner_style = style("Banner", 7, colors.HexColor("#B45309"), align=2)

        # ── Header, by layout ──────────────────────────────────────────────
        if layout == "split":
            # Brand and the shop on the left; a tinted panel with the invoice and the customer on the right
            left = brand + ([space(5 * mm), Paragraph("FROM", label), Spacer(1, 0.8 * mm)] + office if office else [])
            panel = [
                Paragraph(title, style("Title", 18, teal, bold=True, leading=19)),
                Spacer(1, 1.5 * mm),
                Paragraph(f"{number_label} - #{invoice.invoice_number}", style("Number", 8.25, navy)),
                Paragraph(f"Issued {self._fmt_long_date(invoice.invoice_date)}", style("Date", 8.25, navy)),
            ]
            if due_text():
                panel.append(Paragraph(f"Due {due_text().replace('On receipt', 'on receipt')}", style("Due", 8.25, navy)))
            if banner:
                panel.append(Paragraph(banner, style("BannerL", 7, colors.HexColor("#B45309"))))
            panel += [space(3.5 * mm), Paragraph("BILL TO", label), Spacer(1, 0.8 * mm)] + customer
            story.append(plain_table(
                [[left, panel]], [width * 0.48, width * 0.52],
                [("BACKGROUND", (1, 0), (1, 0), colors.HexColor(self._tint(accent_hex, 0.1))),
                 ("ROUNDEDCORNERS", [4, 4, 4, 4]),
                 ("LEFTPADDING", (1, 0), (1, 0), 4 * mm), ("RIGHTPADDING", (1, 0), (1, 0), 4 * mm),
                 ("TOPPADDING", (1, 0), (1, 0), 3.5 * mm * gap), ("BOTTOMPADDING", (1, 0), (1, 0), 3.5 * mm * gap)],
            ))
            story.append(space(7 * mm))
        elif layout == "ledger":
            # A book-keeping look: the details as a list on the right, everything ruled
            meta_label = style("MetaL", 7.5, muted_ink, align=2)
            meta_value = style("MetaV", 8.25, ink, align=2)
            meta = [[Paragraph(title, style("Title", 15, teal, bold=True, align=2, leading=16)), ""],
                    [Paragraph(number_label, meta_label), Paragraph(f"#{invoice.invoice_number}", meta_value)],
                    [Paragraph("Issued", meta_label), Paragraph(self._fmt_long_date(invoice.invoice_date), meta_value)]]
            if due_text():
                meta.append([Paragraph("Due", meta_label), Paragraph(due_text(), meta_value)])
            meta_table = plain_table(meta, [width * 0.22, width * 0.33],
                                     [("SPAN", (0, 0), (1, 0)), ("BOTTOMPADDING", (0, 0), (-1, 0), 2 * mm),
                                      ("LEFTPADDING", (1, 1), (1, -1), 3 * mm)])
            right = [meta_table] + ([Paragraph(banner, banner_style)] if banner else [])
            story.append(plain_table([[brand, right]], [width * 0.45, width * 0.55]))
            story.append(space(4 * mm))
            story.append(HRFlowable(width="100%", thickness=0.75, color=ink, spaceBefore=0, spaceAfter=3 * mm * gap))
            story.append(plain_table(
                [[([Paragraph("FROM", label), Spacer(1, 0.8 * mm)] + office) if office else "",
                  [Paragraph("BILL TO", label), Spacer(1, 0.8 * mm)] + customer]],
                [width / 2, width / 2], [("LEFTPADDING", (1, 0), (1, 0), 4 * mm)],
            ))
            story.append(space(6 * mm))
        else:
            title_block = [
                Paragraph(title, style("Title", 25.5, teal, bold=True, align=2, leading=27)),
                Spacer(1, 1.5 * mm),
                Paragraph(f"{number_label} - #{invoice.invoice_number}", style("Number", 9, navy, align=2)),
                Paragraph(self._fmt_long_date(invoice.invoice_date), style("Date", 9, navy, align=2)),
            ]
            if banner:
                title_block.append(Paragraph(banner, banner_style))
            story.append(plain_table([[brand, title_block]], [width * 0.45, width * 0.55]))
            story.append(space(8.5 * mm))
            story.append(plain_table(
                [[[Paragraph("Office Address", body_ink_style)] + office, [Paragraph("To :", body_ink_style)] + customer]],
                [width / 2, width / 2], [("LEFTPADDING", (1, 0), (1, 0), 4 * mm)],
            ))
            story.append(space(7.4 * mm))

        # ── Items ─────────────────────────────────────────────────────────
        line_type_labels = {"lens": "Lens", "frame": "Frame", "expense": "Service"}
        if group_glasses:
            lines = self._customer_lines(invoice.items)
        else:
            lines = [{"name": i.product_name, "kind": i.line_type, "sku": i.sku, "quantity": i.quantity, "unit_price": i.unit_price,
                      "discount": getattr(i, "discount", 0) or 0, "total": i.total, "grouped": False}
                     for i in invoice.items if i.line_type != "complimentary"]
        names = ("ITEMS", "UNIT PRICE", "QTY", "TOTAL") if layout == "ledger" else ("Items", "Unit Price", "Qnt", "Total")
        rows = [[Paragraph(names[0], head), Paragraph(names[1], head_right), Paragraph(names[2], head_center), Paragraph(names[3], head_right)]]
        for line in lines:
            parts = []
            if look.show_line_details and not line["grouped"]:
                parts = [line_type_labels.get(line["kind"], "Product"), self._customer_code(line["sku"])]
            if line["discount"] and look.show_discount:
                parts.append(f"{self._money(line['discount'])} off")
            detail = " · ".join(part for part in parts if part)
            name = [Paragraph(line["name"] or "", item_name)] + ([Paragraph(detail, small)] if detail else [])
            rows.append([name, Paragraph(self._money(line["unit_price"]), cell_right),
                         Paragraph(str(line["quantity"]), cell_center), Paragraph(self._money(line["total"]), cell_right)])
        items = Table(rows, colWidths=[56 * mm, 30 * mm, 12 * mm, 30 * mm], repeatRows=1)
        items_style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.6 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.6 * mm),
            ("RIGHTPADDING", (1, 0), (1, -1), 4.2 * mm),  # Unit Price doesn't hug the next column
            ("LEFTPADDING", (2, 0), (2, -1), 0),
            ("RIGHTPADDING", (2, 0), (2, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 2 * mm * gap),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm * gap),
        ]
        if layout == "classic":
            items_style += [("BACKGROUND", (0, 0), (-1, 0), teal), ("LINEBELOW", (0, 1), (-1, -1), 0.5, rule)]
        elif layout == "split":
            items_style += [("LINEBELOW", (0, 0), (-1, 0), 1.2, teal), ("LINEBELOW", (0, 1), (-1, -1), 0.5, rule)]
        else:
            items_style += [("LINEABOVE", (0, 0), (-1, 0), 0.75, ink), ("LINEBELOW", (0, 0), (-1, 0), 0.75, ink),
                            ("LINEBELOW", (0, -1), (-1, -1), 0.75, ink)]
            if len(rows) > 1:
                items_style.append(("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor(self._tint(accent_hex, 0.07))]))
        items.setStyle(TableStyle(items_style))
        story.append(items)
        story.append(space(3 * mm))

        # ── Totals ─────────────────────────────────────────────────────────
        totals_width = width * 0.52
        grey = colors.HexColor("#475569")

        def small_row(text, value):
            return [Paragraph(text, style("SmallL", 7.1, grey)), Paragraph(value, style("SmallR", 7.1, grey, align=2))]

        tax, discount = invoice.total_tax or 0, invoice.total_discount or 0
        # A hidden tax or discount line is folded into the subtotal, so the figures still add up
        subtotal = (invoice.subtotal or 0) + (0 if look.show_tax else tax) - (0 if look.show_discount else discount)
        sub_color = ink if layout == "ledger" else teal
        totals = [[Paragraph("SUBTOTAL :", style("Heading", 9, sub_color, bold=True)),
                   Paragraph(self._money(subtotal), style("SubR", 9, sub_color, bold=True, align=2))]]
        if tax and look.show_tax:
            totals.append(small_row("Tax :", self._money(tax)))
        if discount and look.show_discount:
            totals.append(small_row("Discount :", f"-{self._money(discount)}"))
        grand_row = len(totals)
        totals.append([Paragraph("Grand Total :", style("Grand", 9.4, ink, bold=True)),
                       Paragraph(self._money(invoice.total_amount), style("GrandR", 9.4, ink, bold=True, align=2))])
        # Each payment with its date (the advance, then the full payment underneath)
        if payments and look.show_payment_details:
            for text, when, amount in self._payment_lines(payments, invoice.total_amount):
                totals.append(small_row(f"{text} :<br/><font size='{6.4 * scale:g}' color='#64748B'>{self._fmt_dt(when)}</font>", self._money(amount)))
        elif invoice.paid_amount:
            totals.append(small_row("Paid :", self._money(invoice.paid_amount)))
        totals_table = Table(totals, colWidths=[totals_width * 0.5, totals_width * 0.5])
        totals_style = [
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 1.2 * mm * gap),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2 * mm * gap),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, rule),
        ]
        if layout == "ledger":
            totals_style.append(("LINEABOVE", (0, grand_row), (-1, grand_row), 0.75, ink))
        totals_table.setStyle(TableStyle(totals_style))
        balance = Table([[Paragraph("Balance Due :", style("Bal", 9.4, ink, bold=True)),
                          Paragraph(self._money(invoice.balance_due), style("BalR", 9.4, ink, bold=True, align=2))]],
                        colWidths=[totals_width * 0.5, totals_width * 0.5])
        # Ledger outlines the balance in the accent; the others fill it with a tint
        balance_fill = (("BOX", (0, 0), (-1, -1), 0.9, teal) if layout == "ledger"
                        else ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(balance_bg)))
        balance.setStyle(TableStyle([
            balance_fill,
            ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2 * mm * gap),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm * gap),
        ]))
        # Once the invoice is settled there is no balance to show
        totals_block = [totals_table, Spacer(1, 1 * mm), balance] if (invoice.balance_due or 0) > 0.005 else [totals_table]
        story.append(plain_table([["", totals_block]], [width - totals_width, totals_width]))

        if invoice.notes and look.show_notes:
            story.append(space(3 * mm))
            note = Table([[Paragraph(f"<font color='#0F172A'>Note:</font> {invoice.notes}", body)]], colWidths=[width])
            note.setStyle(TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("ROUNDEDCORNERS", [3, 3, 3, 3]),
                ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
            ]))
            story.append(note)

        # ── Footer at the foot of the page: slogan, contacts, QR, terms ─────────
        slogan = plain_table(
            [[Paragraph(self.SLOGAN, style("Slogan", 8.25, teal, bold=True, italic=True)),
              Paragraph("Thank You For Your Trust", style("Thanks", 8.25, teal, bold=True, align=2))]],
            [width / 2, width / 2],
            [("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm), ("LINEBELOW", (0, 0), (-1, 0), 0.75, teal)],
        )
        contact_text = style("Contact", 6.75, body_ink)
        contacts = [Paragraph("Contacts", heading), Spacer(1, 1 * mm)]
        for text, value in (("Email us", company_profile.email), ("Call us", company_profile.phone)):
            if value:
                contacts.append(plain_table([[Paragraph(text, contact_text), Paragraph(f": {value}", contact_text)]], [11 * mm, 34 * mm]))
        qr_cell = ""
        if invoice.sales_order_id:
            qr_cell = [self._order_qr(invoice.sales_order_id, 18 * mm, accent_hex),
                       Paragraph(invoice.sales_order_id, style("QrLabel", 6.75, teal, bold=True, align=1))]
        terms = []
        if getattr(company_profile, "invoice_terms", None):
            terms = [Paragraph("Terms &amp; Conditions", heading), Spacer(1, 1 * mm),
                     Paragraph(company_profile.invoice_terms.replace("\n", "<br/>"), style("Terms", 6.75, body_ink))]
        footer_row = plain_table([[contacts, qr_cell, terms]], [width * 0.36, width * 0.28, width * 0.36],
                                 [("ALIGN", (1, 0), (1, 0), "CENTER"), ("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm)])
        # One flowable, so TopPadder moves the whole footer to the foot of the page together
        footer = plain_table([[slogan], [footer_row]], [width])
        story.append(space(4 * mm))
        story.append(TopPadder(footer))

        doc.build(story)
        return buffer.getvalue()
