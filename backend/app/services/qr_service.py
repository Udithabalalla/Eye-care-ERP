import qrcode
from PIL import Image, ImageDraw, ImageFont
import io
import base64
from typing import Optional

class QRService:
    """Service for generating QR codes and labels"""
    
    @staticmethod
    def generate_qr_code(data: str) -> bytes:
        """Generate a QR code image bytes from data"""
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to bytes
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()

    @staticmethod
    def generate_product_label(
        product_name: str, 
        sku: str, 
        price: float, 
        currency: str = "$"
    ) -> bytes:
        """Generate a printable label with Product Name, Price, and QR Code"""
        
        # 1. Generate QR Code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=8,
            border=2,
        )
        qr.add_data(sku)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
        
        # 2. Create Label Image (300x200 px approx for standard label)
        # Adjust size as needed. Let's go with a standard 2x1 inch ratio at 200dpi -> 400x200
        label_width = 400
        label_height = 200
        label_img = Image.new('RGB', (label_width, label_height), color='white')
        draw = ImageDraw.Draw(label_img)
        
        # 3. Paste QR Code on the left
        # Resize QR to fit nicely
        qr_size = 180
        qr_img = qr_img.resize((qr_size, qr_size))
        label_img.paste(qr_img, (10, 10))
        
        # 4. Add Text on the right
        try:
            # Try to load a font, fallback to default if not available
            # On Windows, Arial is usually available
            font_title = ImageFont.truetype("arial.ttf", 24)
            font_price = ImageFont.truetype("arial.ttf", 36)
            font_sku = ImageFont.truetype("arial.ttf", 16)
        except IOError:
            font_title = ImageFont.load_default()
            font_price = ImageFont.load_default()
            font_sku = ImageFont.load_default()
            
        # Text positioning
        text_x = qr_size + 20
        
        # Product Name (Wrap if too long - simple truncation for now)
        display_name = product_name[:15] + "..." if len(product_name) > 15 else product_name
        draw.text((text_x, 20), display_name, font=font_title, fill="black")
        
        # SKU
        draw.text((text_x, 60), f"SKU: {sku}", font=font_sku, fill="gray")
        
        # Price
        price_text = f"{currency}{price:.2f}"
        draw.text((text_x, 100), price_text, font=font_price, fill="black")
        
        # 5. Convert to bytes
        img_byte_arr = io.BytesIO()
        label_img.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()

    @staticmethod
    def generate_base64_qr(data: str) -> str:
        """Helper to get base64 string for frontend display"""
        img_bytes = QRService.generate_qr_code(data)
        return base64.b64encode(img_bytes).decode('utf-8')
