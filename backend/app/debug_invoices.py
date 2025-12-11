import asyncio
import sys
import os
sys.path.append(os.getcwd())
from app.config.database import connect_to_mongo, get_database, close_mongo_connection
from app.models.invoice import InvoiceModel

async def check_invoices():
    await connect_to_mongo()
    try:
        db = get_database()
        invoices = await db.invoices.find().to_list(length=100)
        
        print(f"Found {len(invoices)} invoices")
        for invoice in invoices:
            pid = invoice.get('prescription_id')
            print(f"Invoice {invoice.get('invoice_number')}: prescription_id={pid} (type: {type(pid)})")
            if pid == "string":
                print("!!! FOUND INVALID PRESCRIPTION ID 'string' !!!")
    finally:
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(check_invoices())
