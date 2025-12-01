from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import settings
from typing import Optional

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

db = Database()

async def connect_to_mongo():
    """Connect to MongoDB"""
    db.client = AsyncIOMotorClient(settings.MONGODB_URL)
    db.db = db.client[settings.MONGODB_DB_NAME]
    print(f"✅ Connected to MongoDB: {settings.MONGODB_DB_NAME}")
    
    # Create indexes
    await create_indexes()

async def close_mongo_connection():
    """Close MongoDB connection"""
    if db.client:
        db.client.close()
        print("❌ Closed MongoDB connection")

async def create_indexes():
    """Create database indexes for performance"""
    # Users
    await db.db.users.create_index("email", unique=True)
    await db.db.users.create_index("user_id", unique=True)
    
    # Patients
    await db.db.patients.create_index("patient_id", unique=True)
    await db.db.patients.create_index("phone")
    await db.db.patients.create_index("email")
    
    # Appointments
    await db.db.appointments.create_index([("appointment_date", 1), ("patient_id", 1)])
    await db.db.appointments.create_index("status")
    
    # Products
    await db.db.products.create_index("barcode")
    await db.db.products.create_index("category")
    await db.db.products.create_index([("current_stock", 1), ("min_stock_level", 1)])
    
    # Invoices
    await db.db.invoices.create_index("invoice_number", unique=True)
    await db.db.invoices.create_index([("invoice_date", -1)])
    await db.db.invoices.create_index("payment_status")
    
    print("✅ Database indexes created")

def get_database() -> AsyncIOMotorDatabase:
    """Dependency to get database"""
    return db.db
