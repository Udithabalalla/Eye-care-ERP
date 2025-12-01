from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Optional, List, Dict, Any
from datetime import date, datetime, timezone
import io
import csv

from app.repositories.invoice_repository import InvoiceRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.appointment_repository import AppointmentRepository
from app.core.exceptions import BadRequestException

class ReportService:
    """Report generation service"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.invoice_repo = InvoiceRepository(db)
        self.patient_repo = PatientRepository(db)
        self.product_repo = ProductRepository(db)
        self.appointment_repo = AppointmentRepository(db)
    
    async def get_sales_report(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Generate sales report"""
        from app.utils.helpers import date_to_datetime
        
        filter_query = {}
        if start_date and end_date:
            filter_query["invoice_date"] = {
                "$gte": date_to_datetime(start_date),
                "$lte": date_to_datetime(end_date)
            }
        elif start_date:
            filter_query["invoice_date"] = {"$gte": date_to_datetime(start_date)}
        elif end_date:
            filter_query["invoice_date"] = {"$lte": date_to_datetime(end_date)}
        
        # Aggregate sales data
        pipeline = [
            {"$match": filter_query},
            {
                "$group": {
                    "_id": None,
                    "total_invoices": {"$sum": 1},
                    "total_revenue": {"$sum": "$total_amount"},
                    "total_paid": {"$sum": "$paid_amount"},
                    "total_pending": {"$sum": "$balance_due"},
                    "total_discount": {"$sum": "$total_discount"},
                    "total_tax": {"$sum": "$total_tax"}
                }
            }
        ]
        
        result = await self.db.invoices.aggregate(pipeline).to_list(length=1)
        
        if result:
            summary = result[0]
            summary.pop("_id")
        else:
            summary = {
                "total_invoices": 0,
                "total_revenue": 0,
                "total_paid": 0,
                "total_pending": 0,
                "total_discount": 0,
                "total_tax": 0
            }
        
        # Get invoices list
        invoices, _ = await self.invoice_repo.list_invoices(
            skip=0,
            limit=1000,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "summary": summary,
            "invoices": [inv.dict() for inv in invoices],
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
        }
    
    async def get_inventory_report(self) -> Dict[str, Any]:
        """Generate inventory report"""
        # Get all products
        products, total = await self.product_repo.list_products(
            skip=0,
            limit=10000
        )
        
        # Calculate totals
        total_value = sum(p.current_stock * p.cost_price for p in products)
        low_stock_items = [p for p in products if p.current_stock <= p.min_stock_level]
        out_of_stock = [p for p in products if p.current_stock == 0]
        
        return {
            "summary": {
                "total_products": total,
                "total_inventory_value": total_value,
                "low_stock_count": len(low_stock_items),
                "out_of_stock_count": len(out_of_stock)
            },
            "products": [p.dict() for p in products],
            "low_stock_items": [p.dict() for p in low_stock_items],
            "out_of_stock_items": [p.dict() for p in out_of_stock]
        }
    
    async def get_patient_report(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """Generate patient report"""
        from app.utils.helpers import date_to_datetime
        
        # Get all patients
        patients, total_patients = await self.patient_repo.list_patients(
            skip=0,
            limit=10000
        )
        
        # Filter by registration date if provided
        if start_date or end_date:
            filtered_patients = []
            for p in patients:
                patient_date = p.created_at.date() if isinstance(p.created_at, datetime) else p.created_at
                if start_date and patient_date < start_date:
                    continue
                if end_date and patient_date > end_date:
                    continue
                filtered_patients.append(p)
            patients = filtered_patients
        
        # Calculate statistics
        active_patients = [p for p in patients if p.is_active]
        
        return {
            "summary": {
                "total_patients": len(patients),
                "active_patients": len(active_patients),
                "inactive_patients": len(patients) - len(active_patients),
                "total_visits": sum(p.total_visits for p in patients)
            },
            "patients": [p.dict() for p in patients],
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
        }
    
    async def export_to_csv(self, data: List[Dict[str, Any]]) -> bytes:
        """Export data to CSV format"""
        if not data:
            raise BadRequestException("No data to export")
        
        output = io.StringIO()
        
        # Flatten nested objects and convert datetime to string
        flattened_data = []
        for item in data:
            flat_item = {}
            for key, value in item.items():
                if isinstance(value, datetime):
                    flat_item[key] = value.isoformat()
                elif isinstance(value, date):
                    flat_item[key] = value.isoformat()
                elif isinstance(value, (dict, list)):
                    flat_item[key] = str(value)
                else:
                    flat_item[key] = value
            flattened_data.append(flat_item)
        
        writer = csv.DictWriter(output, fieldnames=flattened_data[0].keys())
        writer.writeheader()
        writer.writerows(flattened_data)
        
        return output.getvalue().encode('utf-8')
    
    async def export_to_excel(self, data: List[Dict[str, Any]], sheet_name: str = "Report") -> bytes:
        """Export data to Excel format"""
        try:
            import pandas as pd
        except ImportError:
            raise BadRequestException("Pandas library not available for Excel export")
        
        if not data:
            raise BadRequestException("No data to export")
        
        # Convert datetime objects to strings
        cleaned_data = []
        for item in data:
            clean_item = {}
            for key, value in item.items():
                if isinstance(value, (datetime, date)):
                    clean_item[key] = value.isoformat()
                elif isinstance(value, (dict, list)):
                    clean_item[key] = str(value)
                else:
                    clean_item[key] = value
            cleaned_data.append(clean_item)
        
        # Convert to DataFrame
        df = pd.DataFrame(cleaned_data)
        
        # Write to Excel
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name=sheet_name, index=False)
        
        output.seek(0)
        return output.read()
    
    async def export_to_pdf(
        self,
        title: str,
        data: List[Dict[str, Any]],
        summary: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """Export data to PDF format"""
        try:
            from reportlab.lib.pagesizes import letter, A4
            from reportlab.lib import colors
            from reportlab.lib.units import inch
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        except ImportError:
            raise BadRequestException("ReportLab library not available for PDF export")
        
        if not data:
            raise BadRequestException("No data to export")
        
        output = io.BytesIO()
        doc = SimpleDocTemplate(output, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a365d'),
            spaceAfter=30,
            alignment=1  # Center
        )
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 0.3 * inch))
        
        # Summary section
        if summary:
            summary_style = styles['Heading2']
            elements.append(Paragraph("Summary", summary_style))
            elements.append(Spacer(1, 0.1 * inch))
            
            summary_data = [[k.replace('_', ' ').title(), str(v)] for k, v in summary.items()]
            summary_table = Table(summary_data, colWidths=[3 * inch, 2 * inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.beige),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 0.3 * inch))
        
        # Data table
        if data:
            elements.append(Paragraph("Details", styles['Heading2']))
            elements.append(Spacer(1, 0.1 * inch))
            
            # Prepare table data (limit columns for PDF)
            headers = list(data[0].keys())[:6]  # Limit to 6 columns
            table_data = [headers]
            
            for row in data[:50]:  # Limit to 50 rows
                table_data.append([str(row.get(h, ''))[:30] for h in headers])
            
            data_table = Table(table_data)
            data_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            elements.append(data_table)
        
        # Build PDF
        doc.build(elements)
        output.seek(0)
        return output.read()
