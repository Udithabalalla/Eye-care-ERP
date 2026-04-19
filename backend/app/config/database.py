from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config.settings import settings
from typing import Optional

class Database:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

db = Database()

async def connect_to_mongo():
    """Connect to MongoDB with optimized connection pooling"""
    db.client = AsyncIOMotorClient(
        settings.MONGODB_URL,
        # Connection pool settings for better performance
        maxPoolSize=50,          # Maximum connections in pool
        minPoolSize=10,          # Minimum connections to maintain
        maxIdleTimeMS=30000,     # Close idle connections after 30s
        waitQueueTimeoutMS=5000, # Max wait time for connection
        connectTimeoutMS=10000,  # Connection timeout
        serverSelectionTimeoutMS=10000,  # Server selection timeout
        # Compression for reduced network overhead (zlib is built-in)
        compressors=['zlib'],
        # Read/Write settings
        retryWrites=True,
        retryReads=True,
    )
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
    """Create database indexes for performance optimization"""
    from pymongo.errors import DuplicateKeyError, OperationFailure
    
    async def safe_create_index(collection, keys, **kwargs):
        """Create index with error handling for existing indexes or duplicates"""
        try:
            await collection.create_index(keys, **kwargs)
        except (DuplicateKeyError, OperationFailure) as e:
            # Index already exists or duplicate key - skip silently
            index_name = kwargs.get('name', str(keys))
            print(f"⚠️  Index {index_name} skipped: {str(e)[:50]}...")
    
    # Users - authentication and lookup
    await safe_create_index(db.db.users, "email", unique=True)
    await safe_create_index(db.db.users, "user_id", unique=True)
    await safe_create_index(db.db.users, "is_active")

    # Password reset OTPs
    await safe_create_index(db.db.password_reset_otps, "email", unique=True)
    await safe_create_index(db.db.password_reset_otps, "expires_at", expireAfterSeconds=0)
    
    # Patients - search and filtering
    await safe_create_index(db.db.patients, "patient_id", unique=True)
    await safe_create_index(db.db.patients, "phone")
    await safe_create_index(db.db.patients, "email")
    await safe_create_index(db.db.patients, "is_active")
    # Text index for patient search
    await safe_create_index(db.db.patients, [
        ("name", "text"), 
        ("phone", "text"),
        ("email", "text")
    ], name="patient_search_index")
    # Compound index for listing with pagination
    await safe_create_index(db.db.patients, [("is_active", 1), ("created_at", -1)])
    
    # Appointments - scheduling queries
    await safe_create_index(db.db.appointments, [("appointment_date", 1), ("patient_id", 1)])
    await safe_create_index(db.db.appointments, "status")
    await safe_create_index(db.db.appointments, "doctor_id")
    # Compound index for dashboard queries
    await safe_create_index(db.db.appointments, [
        ("appointment_date", 1), 
        ("status", 1)
    ], name="appointment_schedule_index")
    await safe_create_index(db.db.appointments, [("doctor_id", 1), ("appointment_date", 1)])
    
    # Products - inventory management
    await safe_create_index(db.db.products, "barcode")
    await safe_create_index(db.db.products, "sku", unique=True, sparse=True)
    await safe_create_index(db.db.products, "category")
    await safe_create_index(db.db.products, "is_active")
    # Compound index for low stock alerts
    await safe_create_index(db.db.products, [
        ("is_active", 1),
        ("current_stock", 1), 
        ("min_stock_level", 1)
    ], name="stock_alert_index")
    # Expiry date index for alerts
    await safe_create_index(db.db.products, [("expiry_date", 1), ("is_active", 1)])
    
    # Invoices - financial queries (non-unique to handle existing data)
    await safe_create_index(db.db.invoices, "invoice_number")
    await safe_create_index(db.db.invoices, "invoice_id")
    await safe_create_index(db.db.invoices, [("invoice_date", -1)])
    await safe_create_index(db.db.invoices, "payment_status")
    await safe_create_index(db.db.invoices, "patient_id")
    # Compound index for revenue queries
    await safe_create_index(db.db.invoices, [
        ("invoice_date", -1), 
        ("payment_status", 1)
    ], name="invoice_revenue_index")
    # Text index for invoice search
    await safe_create_index(db.db.invoices, [
        ("invoice_number", "text"),
        ("patient_name", "text")
    ], name="invoice_search_index")
    
    # Prescriptions - patient history
    await safe_create_index(db.db.prescriptions, "prescription_id", unique=True)
    await safe_create_index(db.db.prescriptions, "patient_id")
    await safe_create_index(db.db.prescriptions, [("patient_id", 1), ("created_at", -1)])

    # Sales Orders - unique identifiers and list filters
    await safe_create_index(db.db.sales_orders, "order_id", unique=True)
    await safe_create_index(db.db.sales_orders, "order_number", unique=True)
    await safe_create_index(db.db.sales_orders, "patient_id")
    await safe_create_index(db.db.sales_orders, "status")
    await safe_create_index(db.db.sales_orders, [("created_at", -1)], name="sales_order_created_at_index")
    
    # Doctors - lookup
    await safe_create_index(db.db.doctors, "doctor_id", unique=True)
    await safe_create_index(db.db.doctors, "is_active")
    await safe_create_index(db.db.doctors, "specialization")

    # Suppliers and procurement
    await safe_create_index(db.db.suppliers, "id", unique=True)
    await safe_create_index(db.db.suppliers, "supplier_name")
    await safe_create_index(db.db.suppliers, "company_name")
    await safe_create_index(db.db.suppliers, "phone")
    await safe_create_index(db.db.suppliers, "email")

    await safe_create_index(db.db.purchase_orders, "id", unique=True)
    await safe_create_index(db.db.purchase_orders, "supplier_id")
    await safe_create_index(db.db.purchase_orders, "status")
    await safe_create_index(db.db.purchase_orders, [("supplier_id", 1), ("status", 1)], name="po_supplier_status_index")

    await safe_create_index(db.db.supplier_invoices, "id", unique=True)
    await safe_create_index(db.db.supplier_invoices, "supplier_id")
    await safe_create_index(db.db.supplier_invoices, "purchase_order_id")
    await safe_create_index(db.db.supplier_invoices, "invoice_number", unique=True)
    await safe_create_index(db.db.supplier_invoices, "status")

    await safe_create_index(db.db.supplier_payments, "id", unique=True)
    await safe_create_index(db.db.supplier_payments, "invoice_id")
    await safe_create_index(db.db.supplier_payments, ["invoice_id", "payment_date"], name="supplier_payment_history_index")

    await safe_create_index(db.db.stock_receipts, "id", unique=True)
    await safe_create_index(db.db.stock_receipts, "purchase_order_id")
    
    print("✅ Database indexes created")

def get_database() -> AsyncIOMotorDatabase:
    """Dependency to get database"""
    return db.db
