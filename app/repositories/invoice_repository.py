from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Tuple
from datetime import date
from app.repositories.base import BaseRepository
from app.models.invoice import InvoiceModel

class InvoiceRepository(BaseRepository):
    """Invoice repository"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "invoices")
    
    async def get_by_invoice_id(self, invoice_id: str) -> Optional[InvoiceModel]:
        """Get invoice by invoice_id"""
        invoice_dict = await self.get_one({"invoice_id": invoice_id})
        if invoice_dict:
            return InvoiceModel(**invoice_dict)
        return None
    
    async def get_by_invoice_number(self, invoice_number: str) -> Optional[InvoiceModel]:
        """Get invoice by invoice_number"""
        invoice_dict = await self.get_one({"invoice_number": invoice_number})
        if invoice_dict:
            return InvoiceModel(**invoice_dict)
        return None
    
    async def list_invoices(
        self,
        skip: int = 0,
        limit: int = 10,
        patient_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Tuple[List[InvoiceModel], int]:
        """List invoices with filters"""
        filter_query = {}
        
        if patient_id:
            filter_query["patient_id"] = patient_id
        if payment_status:
            filter_query["payment_status"] = payment_status
        if start_date and end_date:
            filter_query["invoice_date"] = {"$gte": start_date, "$lte": end_date}
        
        invoices_dict = await self.get_many(
            filter=filter_query,
            skip=skip,
            limit=limit,
            sort=[("invoice_date", -1)]
        )
        
        total = await self.count(filter_query)
        invoices = [InvoiceModel(**i) for i in invoices_dict]
        
        return invoices, total
    
    async def create_invoice(self, invoice_data: InvoiceModel) -> InvoiceModel:
        """Create a new invoice"""
        invoice_dict = invoice_data.dict()
        created = await self.create(invoice_dict)
        return InvoiceModel(**created)
    
    async def update_invoice(self, invoice_id: str, update_data: dict) -> bool:
        """Update invoice"""
        from datetime import datetime
        update_data["updated_at"] = datetime.utcnow()
        return await self.update({"invoice_id": invoice_id}, update_data)
    
    async def get_next_invoice_number(self, year: int) -> str:
        """Generate next invoice number"""
        prefix = f"INV-{year}-"
        filter_query = {"invoice_number": {"$regex": f"^{prefix}"}}
        
        last_invoice = await self.get_many(
            filter=filter_query,
            skip=0,
            limit=1,
            sort=[("created_at", -1)]
        )
        
        if last_invoice:
            last_number = last_invoice[0]["invoice_number"]
            number = int(last_number.split("-")[-1])
            return f"{prefix}{str(number + 1).zfill(6)}"
        
        return f"{prefix}000001"
