# Complete Eye Care Institute Management System - Python Backend with MongoDB

## Project Overview
Create a comprehensive Eye Care Institute Management System with Python FastAPI backend and MongoDB database, maintaining all existing functionalities from the TypeScript version but with proper relational database design.

---

## System Requirements

### Technology Stack
- **Backend**: Python 3.11+ with FastAPI
- **Database**: MongoDB (document-based with proper schema design)
- **Frontend**: React 18+ with TypeScript, Vite
- **Authentication**: JWT-based auth
- **API Documentation**: Auto-generated with FastAPI/Swagger
- **Validation**: Pydantic models

---

## Database Schema Design

### Collections Structure

#### 1. **users**
```python
{
    "_id": ObjectId,
    "user_id": str,  # Unique user identifier
    "email": str,  # Unique, indexed
    "password_hash": str,
    "name": str,
    "role": str,  # admin, doctor, optometrist, staff, receptionist
    "department": str,
    "phone": str,
    "is_active": bool,
    "avatar_url": str,
    "created_at": datetime,
    "updated_at": datetime,
    "last_login": datetime
}
```

#### 2. **patients**
```python
{
    "_id": ObjectId,
    "patient_id": str,  # Unique patient number (PAT000001)
    "name": str,
    "date_of_birth": date,
    "age": int,
    "gender": str,  # male, female, other
    "phone": str,  # Indexed
    "email": str,
    "address": {
        "street": str,
        "city": str,
        "state": str,
        "zip_code": str,
        "country": str
    },
    "emergency_contact": {
        "name": str,
        "relationship": str,
        "phone": str
    },
    "medical_history": {
        "allergies": [str],
        "chronic_conditions": [str],
        "current_medications": [str],
        "family_history": str
    },
    "insurance": {
        "provider": str,
        "policy_number": str,
        "coverage_type": str
    },
    "last_visit": datetime,
    "next_appointment": datetime,
    "total_visits": int,
    "notes": str,
    "is_active": bool,
    "created_at": datetime,
    "updated_at": datetime
}
```

#### 3. **appointments**
```python
{
    "_id": ObjectId,
    "appointment_id": str,  # APT000001
    "patient_id": str,  # Reference to patients.patient_id
    "patient_name": str,  # Denormalized for quick access
    "doctor_id": str,  # Reference to users.user_id
    "doctor_name": str,
    "appointment_date": date,
    "appointment_time": time,
    "duration_minutes": int,
    "type": str,  # consultation, follow-up, emergency, screening
    "status": str,  # scheduled, confirmed, in-progress, completed, cancelled, no-show
    "reason": str,
    "notes": str,
    "reminder_sent": bool,
    "created_by": str,
    "created_at": datetime,
    "updated_at": datetime,
    "cancelled_at": datetime,
    "cancellation_reason": str
}
```

#### 4. **prescriptions**
```python
{
    "_id": ObjectId,
    "prescription_id": str,  # PRE000001
    "patient_id": str,
    "patient_name": str,
    "doctor_id": str,
    "doctor_name": str,
    "appointment_id": str,  # Optional reference
    "prescription_date": date,
    "valid_until": date,
    
    # Eye Prescription
    "eye_prescription": {
        "right_eye": {
            "sphere": float,  # SPH
            "cylinder": float,  # CYL
            "axis": int,  # 0-180 degrees
            "add": float,  # Addition for reading
            "prism": float,
            "base": str,
            "pupillary_distance": float  # PD
        },
        "left_eye": {
            "sphere": float,
            "cylinder": float,
            "axis": int,
            "add": float,
            "prism": float,
            "base": str,
            "pupillary_distance": float
        },
        "prescription_type": str  # single-vision, bifocal, progressive
    },
    
    # Medications
    "medications": [
        {
            "medication_name": str,
            "dosage": str,
            "frequency": str,
            "duration": str,
            "instructions": str,
            "quantity": int
        }
    ],
    
    # Contact Lenses (if applicable)
    "contact_lenses": {
        "right_eye": {
            "brand": str,
            "power": float,
            "base_curve": float,
            "diameter": float
        },
        "left_eye": {
            "brand": str,
            "power": float,
            "base_curve": float,
            "diameter": float
        },
        "replacement_schedule": str
    },
    
    "diagnosis": str,
    "notes": str,
    "created_at": datetime,
    "updated_at": datetime
}
```

#### 5. **products**
```python
{
    "_id": ObjectId,
    "product_id": str,  # PRD000001
    "name": str,
    "description": str,
    "category": str,  # contact-lenses, eyeglasses, frames, sunglasses, eye-drops, accessories
    "subcategory": str,
    "brand": str,
    "sku": str,  # Stock Keeping Unit
    "barcode": str,  # Indexed
    "upc": str,
    
    # Pricing
    "cost_price": float,
    "selling_price": float,
    "mrp": float,
    "discount_percentage": float,
    "tax_percentage": float,
    
    # Inventory
    "current_stock": int,
    "min_stock_level": int,  # Reorder point
    "max_stock_level": int,
    "reorder_quantity": int,
    "unit_of_measure": str,  # piece, box, bottle
    
    # Supplier
    "supplier": {
        "name": str,
        "contact": str,
        "email": str
    },
    
    # Product Details
    "specifications": dict,  # Flexible field for product-specific attributes
    "images": [str],  # URLs
    "expiry_date": date,
    "manufacturing_date": date,
    "batch_number": str,
    "warranty_months": int,
    
    "is_active": bool,
    "is_prescription_required": bool,
    "created_at": datetime,
    "updated_at": datetime
}
```

#### 6. **invoices**
```python
{
    "_id": ObjectId,
    "invoice_id": str,
    "invoice_number": str,  # INV-2024-001 (unique, indexed)
    "patient_id": str,
    "patient_name": str,
    "patient_phone": str,
    "patient_email": str,
    
    "invoice_date": date,
    "due_date": date,
    
    # Items
    "items": [
        {
            "product_id": str,
            "product_name": str,
            "sku": str,
            "quantity": int,
            "unit_price": float,
            "discount": float,
            "tax": float,
            "total": float
        }
    ],
    
    # Calculations
    "subtotal": float,
    "total_discount": float,
    "total_tax": float,
    "total_amount": float,
    "paid_amount": float,
    "balance_due": float,
    
    # Payment
    "payment_status": str,  # paid, partial, pending, overdue, cancelled
    "payment_method": str,  # cash, card, upi, netbanking, insurance
    "payment_date": date,
    "transaction_id": str,
    
    # References
    "prescription_id": str,  # Optional
    "appointment_id": str,  # Optional
    
    # Insurance
    "insurance_claim": {
        "claim_number": str,
        "provider": str,
        "claim_amount": float,
        "approved_amount": float,
        "status": str
    },
    
    "notes": str,
    "created_by": str,
    "created_at": datetime,
    "updated_at": datetime
}
```

#### 7. **inventory_transactions**
```python
{
    "_id": ObjectId,
    "transaction_id": str,
    "product_id": str,
    "product_name": str,
    "transaction_type": str,  # purchase, sale, adjustment, return, damaged
    "quantity": int,  # Positive for in, negative for out
    "previous_stock": int,
    "new_stock": int,
    "unit_cost": float,
    "total_value": float,
    "reference_type": str,  # invoice, purchase_order, adjustment
    "reference_id": str,
    "notes": str,
    "performed_by": str,
    "transaction_date": datetime,
    "created_at": datetime
}
```

#### 8. **master_data**
```python
{
    "_id": ObjectId,
    "data_id": str,
    "type": str,  # category, supplier, insurance_provider, doctor_specialty, service_type
    "name": str,
    "code": str,
    "description": str,
    "parent_id": str,  # For hierarchical data
    "metadata": dict,  # Flexible attributes
    "is_active": bool,
    "display_order": int,
    "created_at": datetime,
    "updated_at": datetime
}
```

#### 9. **audit_logs**
```python
{
    "_id": ObjectId,
    "log_id": str,
    "user_id": str,
    "user_name": str,
    "action": str,  # create, read, update, delete, login, logout
    "entity_type": str,  # patient, invoice, product, etc.
    "entity_id": str,
    "changes": dict,  # Before and after values
    "ip_address": str,
    "user_agent": str,
    "timestamp": datetime
}
```

#### 10. **notifications**
```python
{
    "_id": ObjectId,
    "notification_id": str,
    "user_id": str,
    "type": str,  # appointment, inventory, payment, system
    "title": str,
    "message": str,
    "priority": str,  # low, medium, high, urgent
    "is_read": bool,
    "action_url": str,
    "metadata": dict,
    "created_at": datetime,
    "read_at": datetime
}
```

---

## Backend Project Structure

```
eye-care-backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── config/
│   │   ├── __init__.py
│   │   ├── settings.py         # Environment variables, config
│   │   └── database.py         # MongoDB connection
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── patient.py
│   │   ├── appointment.py
│   │   ├── prescription.py
│   │   ├── product.py
│   │   ├── invoice.py
│   │   ├── inventory.py
│   │   └── common.py           # Base models, enums
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py             # Pydantic request/response schemas
│   │   ├── patient.py
│   │   ├── appointment.py
│   │   ├── prescription.py
│   │   ├── product.py
│   │   ├── invoice.py
│   │   └── responses.py        # Common response models
│   ├── api/
│   │   ├── __init__.py
│   │   ├── deps.py             # Dependencies (auth, db)
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py       # Main API router
│   │       ├── auth.py
│   │       ├── patients.py
│   │       ├── appointments.py
│   │       ├── prescriptions.py
│   │       ├── products.py
│   │       ├── invoices.py
│   │       ├── inventory.py
│   │       ├── dashboard.py
│   │       └── reports.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── patient_service.py
│   │   ├── appointment_service.py
│   │   ├── prescription_service.py
│   │   ├── product_service.py
│   │   ├── invoice_service.py
│   │   ├── inventory_service.py
│   │   └── notification_service.py
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py             # Base repository with CRUD
│   │   ├── user_repository.py
│   │   ├── patient_repository.py
│   │   ├── appointment_repository.py
│   │   ├── prescription_repository.py
│   │   ├── product_repository.py
│   │   ├── invoice_repository.py
│   │   └── inventory_repository.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py         # JWT, password hashing
│   │   ├── exceptions.py       # Custom exceptions
│   │   └── middleware.py       # Request logging, CORS
│   └── utils/
│       ├── __init__.py
│       ├── helpers.py
│       ├── validators.py
│       ├── formatters.py
│       └── constants.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_api/
│   ├── test_services/
│   └── test_repositories/
├── scripts/
│   ├── seed_data.py            # Initialize database with sample data
│   ├── migrate.py              # Database migrations
│   └── backup.py               # Backup utilities
├── .env.example
├── .gitignore
├── requirements.txt
├── pyproject.toml
├── README.md
└── docker-compose.yml
```

---

## Key Implementation Files

### 1. **requirements.txt**
```txt
fastapi==0.109.0
uvicorn[standard]==0.27.0
motor==3.3.2                    # Async MongoDB driver
pymongo==4.6.1
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0  # JWT
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
email-validator==2.1.0
python-dateutil==2.8.2
pytz==2023.3
pandas==2.1.4                   # For reports/exports
openpyxl==3.1.2                 # Excel export
reportlab==4.0.7                # PDF generation
jinja2==3.1.2                   # Email templates
aiofiles==23.2.1
httpx==0.26.0
pytest==7.4.3
pytest-asyncio==0.21.1
faker==22.0.0                   # For test data
```

### 2. **app/config/settings.py**
```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Application
    APP_NAME: str = "Eye Care Institute Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = False
    
    # MongoDB
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "eye_care_institute"
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:5173"]
    
    # Email (optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### 3. **app/config/database.py**
```python
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
```

### 4. **app/main.py**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config.settings import settings
from app.config.database import connect_to_mongo, close_mongo_connection
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD
    )
```

### 5. **app/models/patient.py** (Example)
```python
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"

class Address(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = "USA"

class EmergencyContact(BaseModel):
    name: str
    relationship: str
    phone: str

class MedicalHistory(BaseModel):
    allergies: List[str] = Field(default_factory=list)
    chronic_conditions: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    family_history: Optional[str] = None

class Insurance(BaseModel):
    provider: Optional[str] = None
    policy_number: Optional[str] = None
    coverage_type: Optional[str] = None

class PatientModel(BaseModel):
    patient_id: str
    name: str
    date_of_birth: date
    age: int
    gender: Gender
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[Address] = None
    emergency_contact: Optional[EmergencyContact] = None
    medical_history: Optional[MedicalHistory] = None
    insurance: Optional[Insurance] = None
    last_visit: Optional[datetime] = None
    next_appointment: Optional[datetime] = None
    total_visits: int = 0
    notes: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "patient_id": "PAT000001",
                "name": "John Doe",
                "date_of_birth": "1990-01-15",
                "age": 34,
                "gender": "male",
                "phone": "+1234567890",
                "email": "john.doe@example.com"
            }
        }
```

---

## API Endpoints Structure

### Authentication
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### Patients
- `GET /api/v1/patients` - List patients (with pagination, search, filters)
- `GET /api/v1/patients/{patient_id}` - Get patient details
- `POST /api/v1/patients` - Create new patient
- `PUT /api/v1/patients/{patient_id}` - Update patient
- `DELETE /api/v1/patients/{patient_id}` - Delete patient
- `GET /api/v1/patients/{patient_id}/history` - Get patient medical history
- `GET /api/v1/patients/{patient_id}/appointments` - Get patient appointments
- `GET /api/v1/patients/{patient_id}/invoices` - Get patient invoices

### Appointments
- `GET /api/v1/appointments` - List appointments
- `GET /api/v1/appointments/{appointment_id}` - Get appointment
- `POST /api/v1/appointments` - Create appointment
- `PUT /api/v1/appointments/{appointment_id}` - Update appointment
- `DELETE /api/v1/appointments/{appointment_id}` - Cancel appointment
- `GET /api/v1/appointments/calendar` - Get calendar view
- `POST /api/v1/appointments/{appointment_id}/confirm` - Confirm appointment

### Prescriptions
- `GET /api/v1/prescriptions` - List prescriptions
- `GET /api/v1/prescriptions/{prescription_id}` - Get prescription
- `POST /api/v1/prescriptions` - Create prescription
- `PUT /api/v1/prescriptions/{prescription_id}` - Update prescription
- `GET /api/v1/prescriptions/{prescription_id}/pdf` - Generate PDF

### Products/Inventory
- `GET /api/v1/products` - List products
- `GET /api/v1/products/{product_id}` - Get product
- `POST /api/v1/products` - Create product
- `PUT /api/v1/products/{product_id}` - Update product
- `DELETE /api/v1/products/{product_id}` - Delete product
- `GET /api/v1/products/low-stock` - Get low stock items
- `POST /api/v1/products/{product_id}/adjust-stock` - Adjust stock

### Invoices
- `GET /api/v1/invoices` - List invoices
- `GET /api/v1/invoices/{invoice_id}` - Get invoice
- `POST /api/v1/invoices` - Create invoice
- `PUT /api/v1/invoices/{invoice_id}` - Update invoice
- `POST /api/v1/invoices/{invoice_id}/payment` - Record payment
- `GET /api/v1/invoices/{invoice_id}/pdf` - Generate PDF

### Dashboard
- `GET /api/v1/dashboard/stats` - Get dashboard statistics
- `GET /api/v1/dashboard/revenue` - Get revenue data
- `GET /api/v1/dashboard/appointments-summary` - Get appointments summary
- `GET /api/v1/dashboard/inventory-alerts` - Get inventory alerts

### Reports
- `GET /api/v1/reports/sales` - Sales report
- `GET /api/v1/reports/inventory` - Inventory report
- `GET /api/v1/reports/patients` - Patient report
- `POST /api/v1/reports/export` - Export report (CSV/Excel/PDF)

---

## Next Steps to Build

1. **Setup Python Environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Configure Environment**
   - Create `.env` file with MongoDB URL and secrets

3. **Implement Models & Schemas**
   - Create Pydantic models for all entities
   - Define request/response schemas

4. **Build Repositories**
   - Implement CRUD operations for each collection
   - Add business logic methods

5. **Create Services**
   - Implement business logic layer
   - Handle complex operations (invoice creation with stock updates)

6. **Develop API Endpoints**
   - Build FastAPI routes
   - Add authentication & authorization
   - Implement validation

7. **Write Tests**
   - Unit tests for services
   - Integration tests for APIs

8. **Add Documentation**
   - API documentation (auto-generated by FastAPI)
   - README with setup instructions

9. **Frontend Integration**
   - Update frontend API service to call Python backend
   - Ensure data compatibility

Would you like me to start implementing specific components of this system?

Made changes.