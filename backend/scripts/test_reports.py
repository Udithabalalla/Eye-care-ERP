"""Test report generation"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
from app.services.report_service import ReportService
from datetime import date, timedelta

async def test_reports():
    """Test report generation"""
    print("🧪 Testing Report Generation...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    try:
        report_service = ReportService(db)
        
        # Test sales report
        print("\n📊 Generating Sales Report...")
        sales_report = await report_service.get_sales_report(
            start_date=date.today() - timedelta(days=30),
            end_date=date.today()
        )
        print(f"✅ Sales Summary:")
        print(f"   Total Invoices: {sales_report['summary']['total_invoices']}")
        print(f"   Total Revenue: ${sales_report['summary']['total_revenue']:.2f}")
        print(f"   Total Paid: ${sales_report['summary']['total_paid']:.2f}")
        
        # Test inventory report
        print("\n📦 Generating Inventory Report...")
        inventory_report = await report_service.get_inventory_report()
        print(f"✅ Inventory Summary:")
        print(f"   Total Products: {inventory_report['summary']['total_products']}")
        print(f"   Total Value: ${inventory_report['summary']['total_inventory_value']:.2f}")
        print(f"   Low Stock Items: {inventory_report['summary']['low_stock_count']}")
        
        # Test patient report
        print("\n👥 Generating Patient Report...")
        patient_report = await report_service.get_patient_report()
        print(f"✅ Patient Summary:")
        print(f"   Total Patients: {patient_report['summary']['total_patients']}")
        print(f"   Active Patients: {patient_report['summary']['active_patients']}")
        print(f"   Total Visits: {patient_report['summary']['total_visits']}")
        
        print("\n✅ All reports generated successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_reports())
