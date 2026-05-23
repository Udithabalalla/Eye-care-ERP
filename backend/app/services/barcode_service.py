"""
Barcode and label generation for frame variants.
Extends the existing QRService with variant-specific label layouts.
Uses python-barcode (Code128) + ReportLab for multi-label PDF sheets.
"""
import io
import base64
from typing import List
import barcode
from barcode.writer import ImageWriter


def generate_barcode_png(sku: str) -> bytes:
    """Return Code128 PNG bytes for a SKU string."""
    Code128 = barcode.get_barcode_class("code128")
    writer = ImageWriter()
    bc = Code128(sku, writer=writer)
    buf = io.BytesIO()
    bc.write(buf, options={"module_width": 0.4, "module_height": 10.0, "quiet_zone": 2.0, "font_size": 9})
    return buf.getvalue()


def generate_barcode_base64(sku: str) -> str:
    return base64.b64encode(generate_barcode_png(sku)).decode("utf-8")


def generate_label_pdf(
    items: List[dict],
    label_type: str = "frame_tag",
) -> bytes:
    """
    Generate a PDF sheet of frame variant labels.

    items: list of dicts with keys:
        brand, model_code, color, eye_size, rim_type, selling_price, sku, quantity

    label_type:
        "frame_tag"   — 40×25 mm, 5 cols × 10 rows per A4
        "shelf_label" — 60×30 mm, 3 cols × 8 rows per A4
        "sticker"     — 25×15 mm, 7 cols × 14 rows per A4
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib import colors
    from PIL import Image

    configs = {
        "frame_tag":   {"w": 40 * mm, "h": 25 * mm, "cols": 5, "rows": 10, "pad": 2 * mm},
        "shelf_label": {"w": 60 * mm, "h": 30 * mm, "cols": 3, "rows": 8,  "pad": 3 * mm},
        "sticker":     {"w": 25 * mm, "h": 15 * mm, "cols": 7, "rows": 14, "pad": 1 * mm},
    }
    cfg = configs.get(label_type, configs["frame_tag"])

    page_w, page_h = A4
    lw, lh, cols, rows, pad = cfg["w"], cfg["h"], cfg["cols"], cfg["rows"], cfg["pad"]
    margin_x = (page_w - cols * lw) / 2
    margin_y = (page_h - rows * lh) / 2

    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=A4)

    def _draw_label(x: float, y: float, item: dict):
        font_s = 6 if label_type == "sticker" else (7 if label_type == "frame_tag" else 8)
        price_s = 7 if label_type == "sticker" else (8 if label_type == "frame_tag" else 10)

        # Border
        c.setStrokeColor(colors.lightgrey)
        c.rect(x, y, lw, lh)

        text_x = x + pad
        cur_y = y + lh - pad - font_s

        brand_model = f"{item.get('brand', '')} {item.get('model_code', '')}"
        c.setFont("Helvetica-Bold", font_s + 1)
        c.drawString(text_x, cur_y, brand_model[:22])
        cur_y -= (font_s + 2)

        detail = f"{item.get('color', '')} / {item.get('eye_size', '')} / {str(item.get('rim_type', '')).capitalize()}"
        c.setFont("Helvetica", font_s)
        c.drawString(text_x, cur_y, detail[:28])
        cur_y -= (font_s + 2)

        price_text = f"LKR {item.get('selling_price', 0):,.2f}"
        c.setFont("Helvetica-Bold", price_s)
        c.drawString(text_x, cur_y, price_text)
        cur_y -= (price_s + 2)

        # Barcode image
        try:
            bc_png = generate_barcode_png(item["sku"])
            bc_img = Image.open(io.BytesIO(bc_png))
            bc_buf = io.BytesIO()
            bc_img.save(bc_buf, format="PNG")
            bc_buf.seek(0)
            barcode_h = lh - (lh - cur_y + y) - pad
            if barcode_h > 4 * mm:
                c.drawImage(
                    rl_canvas.ImageReader(bc_buf),
                    text_x, y + pad,
                    width=lw - 2 * pad, height=barcode_h,
                    preserveAspectRatio=True, anchor="sw",
                )
        except Exception:
            pass  # Skip barcode if rendering fails

    row, col = 0, 0
    for item in items:
        qty = max(1, int(item.get("quantity", 1)))
        for _ in range(qty):
            lx = margin_x + col * lw
            ly = page_h - margin_y - (row + 1) * lh
            _draw_label(lx, ly, item)

            col += 1
            if col >= cols:
                col = 0
                row += 1
                if row >= rows:
                    c.showPage()
                    row = 0

    c.save()
    buf.seek(0)
    return buf.getvalue()
