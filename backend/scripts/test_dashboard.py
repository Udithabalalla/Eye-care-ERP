"""Test dashboard endpoints"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from app.config.settings import settings
from app.services.dashboard_service import DashboardService
from datetime import date, timedelta

async def test_dashboard():
    """Test dashboard functionality"""
    print("🧪 Testing Dashboard Endpoints...")
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    try:
        dashboard_service = DashboardService(db)
        
        # Test dashboard stats
        print("\n📊 Getting Dashboard Stats...")
        stats = await dashboard_service.get_dashboard_stats()
        print(f"✅ Dashboard Stats:")
        print(f"   Total Patients: {stats['total_patients']}")
        print(f"   Today's Appointments: {stats['today_appointments']}")
        print(f"   Revenue Today: ${stats['revenue_today']:.2f}")
        print(f"   Revenue Month: ${stats['revenue_month']:.2f}")
        print(f"   Low Stock Items: {stats['low_stock_items']}")
        print(f"   Pending Payments: ${stats['pending_payments']:.2f}")
        
        # Test revenue data
        print("\n💰 Getting Revenue Data...")
        revenue = await dashboard_service.get_revenue_data(
            date.today() - timedelta(days=30),
            date.today()
        )
        print(f"✅ Revenue Summary (Last 30 Days):")
        print(f"   Total Revenue: ${revenue['summary']['total_revenue']:.2f}")
        print(f"   Total Paid: ${revenue['summary']['total_paid']:.2f}")
        print(f"   Total Invoices: {revenue['summary']['total_invoices']}")
        
        # Test appointments summary
        print("\n📅 Getting Appointments Summary...")
        appointments = await dashboard_service.get_appointments_summary()
        print(f"✅ Appointments Summary:")
        print(f"   Today: {appointments['today_count']}")
        print(f"   Upcoming (7 days): {appointments['upcoming_count']}")
        
        # Test inventory alerts
        print("\n📦 Getting Inventory Alerts...")
        alerts = await dashboard_service.get_inventory_alerts()
        print(f"✅ Inventory Alerts:")
        print(f"   Low Stock: {alerts['summary']['low_stock_count']}")
        print(f"   Out of Stock: {alerts['summary']['out_of_stock_count']}")
        print(f"   Expiring Soon: {alerts['summary']['expiring_soon_count']}")
        
        # Test top products
        print("\n🏆 Getting Top Products...")
        top_products = await dashboard_service.get_top_products(5)
        print(f"✅ Top 5 Products:")
        for i, product in enumerate(top_products, 1):
            print(f"   {i}. {product['product_name']}: ${product['total_revenue']:.2f}")
        
        print("\n✅ All dashboard tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_dashboard())
