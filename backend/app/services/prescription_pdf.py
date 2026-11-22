"""The prescription as an A5 PDF, in the same design as the customer invoice."""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.platypus.flowables import TopPadder

from app.services.invoice_service import InvoiceService
from app.utils.helpers import calculate_age

TYPE_LABELS = {"single-vision": "Single vision", "bifocal": "Bifocal", "progressive": "Progressive"}


def _signed(value) -> str:
    """Diopters the way opticians write them: +1.25, -0.50, 0.00"""
    if value is None or value == "":
        return "—"
    number = float(value)
    return "0.00" if number == 0 else f"{number:+.2f}"


def _plain(value, suffix: str = "") -> str:
    if value is None or value == "" or float(value) == 0:
        return "—"
    number = float(value)
    return f"{int(number) if number.is_integer() else number}{suffix}"


def build_prescription_pdf(rx, patient, company_profile) -> bytes:
    margin = 10 * mm
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A5, leftMargin=margin, rightMargin=margin, topMargin=margin, bottomMargin=margin,
        title=f"Prescription {rx.prescription_id}",
    )
    width = A5[0] - 2 * margin
    teal, navy = colors.HexColor(InvoiceService.TEAL), colors.HexColor(InvoiceService.NAVY)
    body_ink, ink, muted_ink = colors.HexColor("#334155"), colors.HexColor("#0F172A"), colors.HexColor("#64748B")
    rule = colors.HexColor("#C7D8DD")

    def style(name, size, color=body_ink, bold=False, italic=False, align=0, leading=None):
        font = ("Helvetica-BoldOblique" if bold and italic else "Helvetica-Bold" if bold
                else "Helvetica-Oblique" if italic else "Helvetica")
        return ParagraphStyle(name, fontName=font, fontSize=size, leading=leading or size * 1.3, textColor=color, alignment=align)

    body = style("Body", 8.25)
    body_ink_style = style("BodyInk", 8.25, ink)
    label = style("Label", 7.1, muted_ink)
    heading = style("Heading", 9, teal, bold=True)
    head = style("Head", 8.25, colors.white, align=1)
    head_left = style("HeadLeft", 8.25, colors.white)
    cell = style("Cell", 8.25, ink, align=1)
    cell_left = style("CellLeft", 8.25, ink, bold=True)

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

    def teal_table(rows, col_widths, first_left=True):
        table = Table(rows, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), teal),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 1.5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 1.5 * mm),
            ("LEFTPADDING", (0, 0), (0, -1), 2.6 * mm if first_left else 1.5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
            ("LINEBELOW", (0, 1), (-1, -1), 0.5, rule),
        ]))
        return table

    story = []

    # ── Brand and title ─────────────────────────────────────────────────────
    mark = InvoiceService._brand_mark(15 * mm, 10 * mm)
    brand = ([mark, Spacer(1, 1 * mm)] if mark else []) + [
        Paragraph(f"<font color='{InvoiceService.NAVY}'>Vision</font><br/><font color='{InvoiceService.TEAL}'>Opticals.</font>",
                  style("Wordmark", 17, bold=True, leading=18)),
    ]
    title = [
        Paragraph("PRESCRIPTION", style("Title", 21, teal, bold=True, align=2, leading=23)),
        Spacer(1, 1.5 * mm),
        Paragraph(f"Rx No - #{rx.prescription_id}", style("Number", 9, navy, align=2)),
        Paragraph(InvoiceService._fmt_long_date(rx.prescription_date), style("Date", 9, navy, align=2)),
    ]
    story.append(plain_table([[brand, title]], [width * 0.45, width * 0.55]))
    story.append(Spacer(1, 8.5 * mm))

    # ── Patient | examined by ────────────────────────────────────────────────
    patient_lines = [Paragraph("Patient", body_ink_style), Paragraph(rx.patient_name or "", body_ink_style)]
    if patient:
        details = []
        if getattr(patient, "date_of_birth", None):
            details.append(f"{calculate_age(patient.date_of_birth)} yrs")
        gender = getattr(patient, "gender", None)
        if gender:
            details.append(str(getattr(gender, "value", gender)).title())
        if details:
            patient_lines.append(Paragraph(", ".join(details), body))
        if getattr(patient, "phone", None):
            patient_lines.append(Paragraph(patient.phone, body))
    examiner = [Paragraph("Examined by", body_ink_style), Paragraph(rx.doctor_name or "", body_ink_style),
                Spacer(1, 1 * mm), Paragraph(f"Valid until {InvoiceService._fmt_long_date(rx.valid_until)}", body)]
    story.append(plain_table([[patient_lines, examiner]], [width / 2, width / 2], [("LEFTPADDING", (1, 0), (1, 0), 4 * mm)]))
    story.append(Spacer(1, 7 * mm))

    # ── Glasses prescription ─────────────────────────────────────────────────
    eye_rx = rx.eye_prescription
    if eye_rx:
        kind = getattr(eye_rx.prescription_type, "value", eye_rx.prescription_type)
        story.append(Paragraph(f"Glasses prescription · {TYPE_LABELS.get(kind, kind or '')}", heading))
        story.append(Spacer(1, 2 * mm))
        rows = [[Paragraph("Eye", head_left)] + [Paragraph(h, head) for h in ("SPH", "CYL", "AXIS", "ADD", "VA", "PD")]]
        for side, eye in (("R", eye_rx.right_eye), ("L", eye_rx.left_eye)):
            rows.append([
                Paragraph(side, cell_left),
                Paragraph(_signed(eye.sphere), cell),
                Paragraph(_signed(eye.cylinder), cell),
                Paragraph(_plain(eye.axis, "°"), cell),
                Paragraph(_signed(eye.add) if eye.add else "—", cell),
                Paragraph(getattr(eye, "visual_acuity", None) or "—", cell),
                Paragraph(_plain(eye.pupillary_distance), cell),
            ])
        column = (width - 14 * mm) / 6
        story.append(teal_table(rows, [14 * mm] + [column] * 6))
        story.append(Spacer(1, 5 * mm))

    # ── Diagnosis ────────────────────────────────────────────────────────────
    story.append(Paragraph("Diagnosis", heading))
    story.append(Spacer(1, 1 * mm))
    story.append(Paragraph(rx.diagnosis or "—", body))

    # ── Medications ──────────────────────────────────────────────────────────
    if rx.medications:
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph("Medications", heading))
        story.append(Spacer(1, 2 * mm))
        med_head = [Paragraph("Medication", head_left)] + [Paragraph(h, head) for h in ("Dosage", "Frequency", "Duration", "Qty")]
        med_rows = [med_head]
        for med in rx.medications:
            name = med.medication_name + (f"<br/><font size=6.75 color='#64748B'>{med.instructions}</font>" if med.instructions else "")
            med_rows.append([Paragraph(name, style("MedName", 8.25, ink)), Paragraph(med.dosage or "—", cell),
                             Paragraph(med.frequency or "—", cell), Paragraph(med.duration or "—", cell), Paragraph(str(med.quantity), cell)])
        story.append(teal_table(med_rows, [width * 0.34, width * 0.18, width * 0.2, width * 0.16, width * 0.12]))

    # ── Contact lenses ───────────────────────────────────────────────────────
    lenses = getattr(rx, "contact_lenses", None)
    if lenses:
        story.append(Spacer(1, 5 * mm))
        story.append(Paragraph(f"Contact lenses · replace {lenses.replacement_schedule}", heading))
        story.append(Spacer(1, 2 * mm))
        cl_rows = [[Paragraph("Eye", head_left)] + [Paragraph(h, head) for h in ("Brand", "Power", "Base curve", "Diameter")]]
        for side, lens in (("R", lenses.right_eye), ("L", lenses.left_eye)):
            cl_rows.append([Paragraph(side, cell_left), Paragraph(lens.brand, cell), Paragraph(_signed(lens.power), cell),
                            Paragraph(f"{lens.base_curve}", cell), Paragraph(f"{lens.diameter}", cell)])
        column = (width - 14 * mm) / 4
        story.append(teal_table(cl_rows, [14 * mm] + [column] * 4))

    # ── Notes ────────────────────────────────────────────────────────────────
    if rx.notes:
        story.append(Spacer(1, 5 * mm))
        note = Table([[Paragraph(f"<font color='#0F172A'>Notes:</font> {rx.notes}", body)]], colWidths=[width])
        note.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("ROUNDEDCORNERS", [3, 3, 3, 3]),
            ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
            ("TOPPADDING", (0, 0), (-1, -1), 1.5 * mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm),
        ]))
        story.append(note)

    # ── Footer at the foot of the page: slogan, contacts, address ────────────────
    slogan = plain_table(
        [[Paragraph(InvoiceService.SLOGAN, style("Slogan", 8.25, teal, bold=True, italic=True)),
          Paragraph("Thank You For Your Trust", style("Thanks", 8.25, teal, bold=True, align=2))]],
        [width / 2, width / 2],
        [("BOTTOMPADDING", (0, 0), (-1, -1), 1.5 * mm), ("LINEBELOW", (0, 0), (-1, 0), 0.75, teal)],
    )
    small = style("Small", 6.75, body_ink)
    contacts = [Paragraph("Contacts", heading), Spacer(1, 1 * mm)]
    for name, value in (("Email us", company_profile.email), ("Call us", company_profile.phone)):
        if value:
            contacts.append(plain_table([[Paragraph(name, small), Paragraph(f": {value}", small)]], [11 * mm, 40 * mm]))
    office = [Paragraph("Office Address", heading), Spacer(1, 1 * mm)]
    if company_profile.address:
        office.append(Paragraph(company_profile.address, small))
    footer_row = plain_table([[contacts, office]], [width / 2, width / 2], [("TOPPADDING", (0, 0), (-1, -1), 2.5 * mm)])
    footer = plain_table([[slogan], [footer_row]], [width])
    story.append(Spacer(1, 4 * mm))
    story.append(TopPadder(footer))

    doc.build(story)
    return buffer.getvalue()
