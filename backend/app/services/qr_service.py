import barcode
from barcode.writer import ImageWriter
from PIL import Image, ImageDraw, ImageFont
import io
import base64
from typing import Optional

class QRService:
    """Service for generating Barcodes and labels"""
    
    @staticmethod
    def generate_barcode(data: str) -> bytes:
        """Generate a Barcode image bytes from data"""
        # Use Code128 for alphanumeric support
        Code128 = barcode.get_barcode_class('code128')
        
        # Create barcode with ImageWriter to get a PIL Image
        writer = ImageWriter()
        my_barcode = Code128(data, writer=writer)
        
        # Render to BytesIO
        img_byte_arr = io.BytesIO()
        my_barcode.write(img_byte_arr)
        
        return img_byte_arr.getvalue()

    @staticmethod
    def generate_product_label(
        product_name: str, 
        sku: str, 
        price: float, 
        currency: str = "$"
    ) -> bytes:
        """Generate a printable label with Product Name, Price, and Barcode"""
        
        # 1. Generate Barcode Image
        Code128 = barcode.get_barcode_class('code128')
        writer = ImageWriter()
        
        # Configure writer to not add quiet zones if we want tight fit, 
        # but defaults are usually fine.
        # We can pass options to render() or write()
        my_barcode = Code128(sku, writer=writer)
        
        # Render barcode to a PIL Image
        # render() returns a PIL Image
        barcode_img = my_barcode.render(writer_options={
            'module_width': 0.4, # Adjust bar width
            'module_height': 10.0, # Adjust bar height (mm approx)
            'font_size': 10,
            'text_distance': 3.0,
            'quiet_zone': 1.0,
        })
        
        # 2. Create Label Image (400x200 px)
        label_width = 400
        label_height = 200
        label_img = Image.new('RGB', (label_width, label_height), color='white')
        draw = ImageDraw.Draw(label_img)
        
        # 3. Add Text (Product Name & Price) at the top
        try:
            font_title = ImageFont.truetype("arial.ttf", 24)
            font_price = ImageFont.truetype("arial.ttf", 30)
        except IOError:
            font_title = ImageFont.load_default()
            font_price = ImageFont.load_default()
            
        # Product Name
        display_name = product_name[:25] + "..." if len(product_name) > 25 else product_name
        # Center text
        # getbbox returns (left, top, right, bottom)
        title_bbox = draw.textbbox((0, 0), display_name, font=font_title)
        title_w = title_bbox[2] - title_bbox[0]
        draw.text(((label_width - title_w) / 2, 10), display_name, font=font_title, fill="black")
        
        # Price
        price_text = f"{currency}{price:.2f}"
        price_bbox = draw.textbbox((0, 0), price_text, font=font_price)
        price_w = price_bbox[2] - price_bbox[0]
        draw.text(((label_width - price_w) / 2, 45), price_text, font=font_price, fill="black")
        
        # 4. Paste Barcode at the bottom
        # Resize barcode to fit width if necessary, preserving aspect ratio
        # Target width: 360 (20px padding each side)
        target_width = 360
        w_percent = (target_width / float(barcode_img.size[0]))
        h_size = int((float(barcode_img.size[1]) * float(w_percent)))
        
        # If barcode is too tall, constrain height
        if h_size > 100:
            h_size = 100
            
        barcode_img_resized = barcode_img.resize((target_width, h_size), Image.Resampling.LANCZOS)
        
        # Center barcode horizontally, place at bottom
        x_pos = (label_width - target_width) // 2
        y_pos = label_height - h_size - 10
        
        label_img.paste(barcode_img_resized, (x_pos, y_pos))
        
        # 5. Convert to bytes
        img_byte_arr = io.BytesIO()
        label_img.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()

    @staticmethod
    def generate_base64_barcode(data: str) -> str:
        """Helper to get base64 string for frontend display"""
        img_bytes = QRService.generate_barcode(data)
        return base64.b64encode(img_bytes).decode('utf-8')
