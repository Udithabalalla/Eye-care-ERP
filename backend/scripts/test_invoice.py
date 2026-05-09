"""Test invoice creation with proper validation."""
import asyncio
import sys
from datetime import date, timedelta
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.settings import settings
from app.models.invoice import InvoiceItem
from app.schemas.invoice import InvoiceCreate
from app.services.invoice_service import InvoiceService


async def test_invoice_creation():
    """Test creating an invoice."""
    print("Testing Invoice Creation...")

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]

    try:
        invoice_service = InvoiceService(db)

        invoice_data = InvoiceCreate(
            patient_id="PAT000001",
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            items=[
                InvoiceItem(
                    product_id="PRD000001",
                    product_name="Contact Lens Solution 360ml",
                    sku="CLS-360",
                    quantity=2,
                    unit_price=12.99,
                    discount=0.00,
                    tax=1.30,
                    total=27.28,
                )
            ],
        )

        print(f"Invoice data validated: {invoice_data.model_dump()}")

        created_invoice = await invoice_service.create_invoice(
            invoice_data,
            current_user_id="USR000003",
        )

        print(f"Invoice created successfully: {created_invoice.invoice_number}")
        print(f"   Total Amount: ${created_invoice.total_amount:.2f}")
        print(f"   Status: {created_invoice.payment_status}")
    except Exception as exc:
        print(f"Error: {exc}")
        import traceback

        traceback.print_exc()
        raise
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(test_invoice_creation())
