"""Seed database with initial data"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date, time, timedelta, timezone
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.settings import settings
from app.core.security import get_password_hash
from app.models.user import UserModel
from app.utils.constants import UserRole

def now_utc():
    """Get current UTC datetime with timezone info"""
    return datetime.now(timezone.utc)

def date_to_datetime(d: date) -> datetime:
    """Convert date to datetime at midnight UTC"""
    return datetime.combine(d, time.min).replace(tzinfo=timezone.utc)

async def seed_users(db):
    """Seed initial users"""
    print("\n📋 Seeding Users...")
    now = now_utc()
    users = [
        {
            "user_id": "USR000001",
            "email": "admin@eyecare.com",
            "password_hash": get_password_hash("admin123"),
            "name": "System Administrator",
            "role": UserRole.ADMIN,
            "department": "Administration",
            "phone": "+1234567890",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "user_id": "USR000002",
            "email": "doctor@eyecare.com",
            "password_hash": get_password_hash("doctor123"),
            "name": "Dr. Sarah Johnson",
            "role": UserRole.DOCTOR,
            "department": "Ophthalmology",
            "phone": "+1234567891",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "user_id": "USR000003",
            "email": "receptionist@eyecare.com",
            "password_hash": get_password_hash("reception123"),
            "name": "Emily Davis",
            "role": UserRole.RECEPTIONIST,
            "department": "Front Desk",
            "phone": "+1234567892",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "user_id": "USR000004",
            "email": "optometrist@eyecare.com",
            "password_hash": get_password_hash("optom123"),
            "name": "Dr. Michael Chen",
            "role": UserRole.OPTOMETRIST,
            "department": "Optometry",
            "phone": "+1234567893",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for user in users:
        existing = await db.users.find_one({"email": user["email"]})
        if not existing:
            await db.users.insert_one(user)
            print(f"  ✅ Created user: {user['email']}")
        else:
            print(f"  ⏭️  User already exists: {user['email']}")

async def seed_patients(db):
    """Seed sample patients"""
    print("\n👥 Seeding Patients...")
    now = now_utc()
    patients = [
        {
            "patient_id": "PAT000001",  # Added patient_id
            "name": "John Doe",
            "date_of_birth": date_to_datetime(date(1990, 1, 15)),
            "age": 34,
            "gender": "male",
            "phone": "+1234567890",
            "email": "john.doe@example.com",
            "address": {
                "street": "123 Main St",
                "city": "New York",
                "state": "NY",
                "zip_code": "10001",
                "country": "USA"
            },
            "emergency_contact": {
                "name": "Jane Doe",
                "relationship": "Spouse",
                "phone": "+1234567891"
            },
            "medical_history": {
                "allergies": ["Penicillin"],
                "chronic_conditions": ["Myopia"],
                "current_medications": [],
                "family_history": "Mother has glaucoma"
            },
            "insurance": {
                "provider": "Blue Cross",
                "policy_number": "BC123456",
                "coverage_type": "Full"
            },
            "total_visits": 3,
            "notes": "Regular patient, prefers morning appointments",
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "patient_id": "PAT000002",  # Added patient_id
            "name": "Alice Smith",
            "date_of_birth": date_to_datetime(date(1985, 5, 20)),
            "age": 39,
            "gender": "female",
            "phone": "+1234567895",
            "email": "alice.smith@example.com",
            "address": {
                "street": "456 Oak Ave",
                "city": "Los Angeles",
                "state": "CA",
                "zip_code": "90001",
                "country": "USA"
            },
            "emergency_contact": {
                "name": "Bob Smith",
                "relationship": "Husband",
                "phone": "+1234567896"
            },
            "medical_history": {
                "allergies": [],
                "chronic_conditions": ["Astigmatism"],
                "current_medications": [],
                "family_history": "None"
            },
            "total_visits": 5,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "patient_id": "PAT000003",  # Added patient_id
            "name": "Robert Johnson",
            "date_of_birth": date_to_datetime(date(1975, 8, 10)),
            "age": 49,
            "gender": "male",
            "phone": "+1234567897",
            "email": "robert.j@example.com",
            "address": {
                "street": "789 Pine Rd",
                "city": "Chicago",
                "state": "IL",
                "zip_code": "60601",
                "country": "USA"
            },
            "medical_history": {
                "allergies": ["Dust"],
                "chronic_conditions": ["Presbyopia", "Dry Eyes"],
                "current_medications": ["Artificial Tears"],
                "family_history": "Father had cataracts"
            },
            "total_visits": 8,
            "is_active": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for patient in patients:
        existing = await db.patients.find_one({"patient_id": patient["patient_id"]})
        if not existing:
            await db.patients.insert_one(patient)
            print(f"  ✅ Created patient: {patient['name']} ({patient['patient_id']})")
        else:
            print(f"  ⏭️  Patient already exists: {patient['patient_id']}")

async def seed_products(db):
    """Seed sample products"""
    print("\n📦 Seeding Products...")
    now = now_utc()
    products = [
        {
            "product_id": "PRD000001",
            "name": "Contact Lens Solution 360ml",
            "description": "Multi-purpose contact lens solution",
            "category": "accessories",
            "subcategory": "Solutions",
            "brand": "Bausch & Lomb",
            "sku": "CLS-360",
            "barcode": "1234567890123",
            "cost_price": 8.50,
            "selling_price": 12.99,
            "mrp": 14.99,
            "discount_percentage": 0,
            "tax_percentage": 5,
            "current_stock": 150,
            "min_stock_level": 20,
            "max_stock_level": 500,
            "reorder_quantity": 100,
            "unit_of_measure": "bottle",
            "supplier": {
                "name": "Medical Supplies Inc",
                "contact": "+1234567890",
                "email": "supplier@medical.com"
            },
            "is_active": True,
            "is_prescription_required": False,
            "created_at": now,
            "updated_at": now
        },
        {
            "product_id": "PRD000002",
            "name": "Premium Progressive Lenses",
            "description": "High-quality progressive lenses with anti-glare coating",
            "category": "eyeglasses",
            "subcategory": "Lenses",
            "brand": "Essilor",
            "sku": "PPL-001",
            "barcode": "1234567890124",
            "cost_price": 120.00,
            "selling_price": 199.99,
            "mrp": 249.99,
            "discount_percentage": 10,
            "tax_percentage": 8,
            "current_stock": 50,
            "min_stock_level": 10,
            "max_stock_level": 100,
            "reorder_quantity": 30,
            "unit_of_measure": "pair",
            "supplier": {
                "name": "Essilor Distributors",
                "contact": "+1234567891",
                "email": "sales@essilor.com"
            },
            "is_active": True,
            "is_prescription_required": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "product_id": "PRD000003",
            "name": "Designer Frame - Ray-Ban",
            "description": "Classic Ray-Ban Wayfarer frame",
            "category": "frames",
            "subcategory": "Plastic Frames",
            "brand": "Ray-Ban",
            "sku": "RB-WAY-001",
            "barcode": "1234567890125",
            "cost_price": 80.00,
            "selling_price": 149.99,
            "mrp": 179.99,
            "discount_percentage": 0,
            "tax_percentage": 8,
            "current_stock": 25,
            "min_stock_level": 5,
            "max_stock_level": 50,
            "reorder_quantity": 20,
            "unit_of_measure": "piece",
            "supplier": {
                "name": "Luxottica",
                "contact": "+1234567892",
                "email": "orders@luxottica.com"
            },
            "specifications": {
                "material": "Plastic",
                "color": "Black",
                "size": "Medium"
            },
            "is_active": True,
            "is_prescription_required": False,
            "created_at": now,
            "updated_at": now
        },
        {
            "product_id": "PRD000004",
            "name": "Lubricating Eye Drops",
            "description": "Relief for dry and irritated eyes",
            "category": "eye-drops",
            "subcategory": "Lubricants",
            "brand": "Refresh",
            "sku": "LED-REF-10",
            "barcode": "1234567890126",
            "cost_price": 5.00,
            "selling_price": 9.99,
            "mrp": 12.99,
            "discount_percentage": 0,
            "tax_percentage": 5,
            "current_stock": 200,
            "min_stock_level": 50,
            "max_stock_level": 500,
            "reorder_quantity": 150,
            "unit_of_measure": "bottle",
            "expiry_date": date_to_datetime(date(2025, 12, 31)),
            "is_active": True,
            "is_prescription_required": False,
            "created_at": now,
            "updated_at": now
        },
        {
            "product_id": "PRD000005",
            "name": "Daily Contact Lenses - 30 Pack",
            "description": "Acuvue daily disposable contact lenses",
            "category": "contact-lenses",
            "subcategory": "Daily",
            "brand": "Acuvue",
            "sku": "ACU-DAY-30",
            "barcode": "1234567890127",
            "cost_price": 25.00,
            "selling_price": 39.99,
            "mrp": 44.99,
            "discount_percentage": 5,
            "tax_percentage": 8,
            "current_stock": 8,
            "min_stock_level": 15,
            "max_stock_level": 100,
            "reorder_quantity": 40,
            "unit_of_measure": "box",
            "is_active": True,
            "is_prescription_required": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for product in products:
        existing = await db.products.find_one({"product_id": product["product_id"]})
        if not existing:
            await db.products.insert_one(product)
            print(f"  ✅ Created product: {product['name']} ({product['product_id']})")
        else:
            print(f"  ⏭️  Product already exists: {product['product_id']}")

async def seed_appointments(db):
    """Seed sample appointments"""
    print("\n📅 Seeding Appointments...")
    now = now_utc()
    today = date.today()
    
    # Convert time to datetime for MongoDB
    def combine_date_time(d: date, t: time) -> datetime:
        return datetime.combine(d, t).replace(tzinfo=timezone.utc)
    
    appointments = [
        {
            "appointment_id": "APT000001",
            "patient_id": "PAT000001",
            "patient_name": "John Doe",
            "doctor_id": "USR000002",
            "doctor_name": "Dr. Sarah Johnson",
            "appointment_date": date_to_datetime(today + timedelta(days=1)),
            "appointment_time": combine_date_time(today + timedelta(days=1), time(10, 0, 0)),
            "duration_minutes": 30,
            "type": "consultation",
            "status": "scheduled",
            "reason": "Regular eye checkup",
            "notes": "Patient requested morning slot",
            "reminder_sent": False,
            "created_by": "USR000003",
            "created_at": now,
            "updated_at": now
        },
        {
            "appointment_id": "APT000002",
            "patient_id": "PAT000002",
            "patient_name": "Alice Smith",
            "doctor_id": "USR000004",
            "doctor_name": "Dr. Michael Chen",
            "appointment_date": date_to_datetime(today + timedelta(days=2)),
            "appointment_time": combine_date_time(today + timedelta(days=2), time(14, 30, 0)),
            "duration_minutes": 45,
            "type": "follow-up",
            "status": "confirmed",
            "reason": "Follow-up for new prescription",
            "notes": "Patient confirmed appointment",
            "reminder_sent": True,
            "created_by": "USR000003",
            "created_at": now,
            "updated_at": now
        },
        {
            "appointment_id": "APT000003",
            "patient_id": "PAT000003",
            "patient_name": "Robert Johnson",
            "doctor_id": "USR000002",
            "doctor_name": "Dr. Sarah Johnson",
            "appointment_date": date_to_datetime(today),
            "appointment_time": combine_date_time(today, time(9, 0, 0)),
            "duration_minutes": 30,
            "type": "consultation",
            "status": "completed",
            "reason": "Eye strain complaints",
            "notes": "Completed successfully",
            "reminder_sent": True,
            "created_by": "USR000003",
            "created_at": now - timedelta(days=1),
            "updated_at": now
        }
    ]
    
    for appointment in appointments:
        existing = await db.appointments.find_one({"appointment_id": appointment["appointment_id"]})
        if not existing:
            await db.appointments.insert_one(appointment)
            print(f"  ✅ Created appointment: {appointment['appointment_id']} - {appointment['patient_name']}")
        else:
            print(f"  ⏭️  Appointment already exists: {appointment['appointment_id']}")

async def seed_prescriptions(db):
    """Seed sample prescriptions"""
    print("\n💊 Seeding Prescriptions...")
    now = now_utc()
    prescriptions = [
        {
            "prescription_id": "PRE000001",
            "patient_id": "PAT000001",
            "patient_name": "John Doe",
            "doctor_id": "USR000002",
            "doctor_name": "Dr. Sarah Johnson",
            "appointment_id": "APT000003",
            "prescription_date": date_to_datetime(date.today() - timedelta(days=30)),
            "valid_until": date_to_datetime(date.today() + timedelta(days=335)),
            "eye_prescription": {
                "right_eye": {
                    "sphere": -2.50,
                    "cylinder": -0.75,
                    "axis": 180,
                    "add": 0,
                    "pupillary_distance": 32
                },
                "left_eye": {
                    "sphere": -2.25,
                    "cylinder": -0.50,
                    "axis": 175,
                    "add": 0,
                    "pupillary_distance": 32
                },
                "prescription_type": "single-vision"
            },
            "medications": [],
            "diagnosis": "Myopia with astigmatism",
            "notes": "Recommend anti-glare coating for computer use",
            "created_at": now - timedelta(days=30),
            "updated_at": now - timedelta(days=30)
        },
        {
            "prescription_id": "PRE000002",
            "patient_id": "PAT000003",
            "patient_name": "Robert Johnson",
            "doctor_id": "USR000002",
            "doctor_name": "Dr. Sarah Johnson",
            "prescription_date": date_to_datetime(date.today()),
            "valid_until": date_to_datetime(date.today() + timedelta(days=365)),
            "eye_prescription": {
                "right_eye": {
                    "sphere": -1.00,
                    "cylinder": 0,
                    "axis": 0,
                    "add": 2.00,
                    "pupillary_distance": 33
                },
                "left_eye": {
                    "sphere": -0.75,
                    "cylinder": 0,
                    "axis": 0,
                    "add": 2.00,
                    "pupillary_distance": 33
                },
                "prescription_type": "progressive"
            },
            "medications": [
                {
                    "medication_name": "Artificial Tears",
                    "dosage": "1-2 drops",
                    "frequency": "4 times daily",
                    "duration": "Ongoing",
                    "instructions": "Use as needed for dry eyes",
                    "quantity": 2
                }
            ],
            "diagnosis": "Presbyopia and dry eye syndrome",
            "notes": "Progressive lenses recommended. Continue artificial tears.",
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for prescription in prescriptions:
        existing = await db.prescriptions.find_one({"prescription_id": prescription["prescription_id"]})
        if not existing:
            await db.prescriptions.insert_one(prescription)
            print(f"  ✅ Created prescription: {prescription['prescription_id']} - {prescription['patient_name']}")
        else:
            print(f"  ⏭️  Prescription already exists: {prescription['prescription_id']}")

async def seed_invoices(db):
    """Seed sample invoices"""
    print("\n💰 Seeding Invoices...")
    now = now_utc()
    invoices = [
        {
            "invoice_id": "INV000001",
            "invoice_number": "INV-2024-000001",
            "patient_id": "PAT000001",
            "patient_name": "John Doe",
            "patient_phone": "+1234567890",
            "patient_email": "john.doe@example.com",
            "invoice_date": date_to_datetime(date.today() - timedelta(days=15)),
            "due_date": date_to_datetime(date.today() + timedelta(days=15)),
            "items": [
                {
                    "product_id": "PRD000001",
                    "product_name": "Contact Lens Solution 360ml",
                    "sku": "CLS-360",
                    "quantity": 2,  # Valid: greater than 0
                    "unit_price": 12.99,
                    "discount": 0,
                    "tax": 1.30,
                    "total": 27.28
                },
                {
                    "product_id": "PRD000004",
                    "product_name": "Lubricating Eye Drops",
                    "sku": "LED-REF-10",
                    "quantity": 1,  # Valid: greater than 0
                    "unit_price": 9.99,
                    "discount": 0,
                    "tax": 0.50,
                    "total": 10.49
                }
            ],
            "subtotal": 35.97,
            "total_discount": 0,
            "total_tax": 1.80,
            "total_amount": 37.77,
            "paid_amount": 37.77,
            "balance_due": 0,
            "payment_status": "paid",
            "payment_method": "cash",
            "payment_date": date_to_datetime(date.today() - timedelta(days=15)),
            "transaction_id": "TXN123456",
            "prescription_id": "PRE000001",
            "notes": "Cash payment received",
            "created_by": "USR000003",
            "created_at": now - timedelta(days=15),
            "updated_at": now - timedelta(days=15)
        },
        {
            "invoice_id": "INV000002",
            "invoice_number": "INV-2024-000002",
            "patient_id": "PAT000002",
            "patient_name": "Alice Smith",
            "patient_phone": "+1234567895",
            "patient_email": "alice.smith@example.com",
            "invoice_date": date_to_datetime(date.today() - timedelta(days=5)),
            "due_date": date_to_datetime(date.today() + timedelta(days=25)),
            "items": [
                {
                    "product_id": "PRD000002",
                    "product_name": "Premium Progressive Lenses",
                    "sku": "PPL-001",
                    "quantity": 1,  # Valid: greater than 0
                    "unit_price": 199.99,
                    "discount": 19.99,
                    "tax": 14.40,
                    "total": 194.40
                },
                {
                    "product_id": "PRD000003",
                    "product_name": "Designer Frame - Ray-Ban",
                    "sku": "RB-WAY-001",
                    "quantity": 1,  # Valid: greater than 0
                    "unit_price": 149.99,
                    "discount": 0,
                    "tax": 12.00,
                    "total": 161.99
                }
            ],
            "subtotal": 349.98,
            "total_discount": 19.99,
            "total_tax": 26.40,
            "total_amount": 356.39,
            "paid_amount": 0,
            "balance_due": 356.39,
            "payment_status": "pending",
            "payment_method": None,
            "payment_date": None,
            "notes": "Awaiting insurance approval",
            "created_by": "USR000003",
            "created_at": now - timedelta(days=5),
            "updated_at": now - timedelta(days=5)
        },
        {
            "invoice_id": "INV000003",
            "invoice_number": "INV-2024-000003",
            "patient_id": "PAT000003",
            "patient_name": "Robert Johnson",
            "patient_phone": "+1234567897",
            "patient_email": "robert.j@example.com",
            "invoice_date": date_to_datetime(date.today()),
            "due_date": date_to_datetime(date.today() + timedelta(days=30)),
            "items": [
                {
                    "product_id": "PRD000004",
                    "product_name": "Lubricating Eye Drops",
                    "sku": "LED-REF-10",
                    "quantity": 3,  # Valid: greater than 0
                    "unit_price": 9.99,
                    "discount": 0,
                    "tax": 1.50,
                    "total": 31.47
                }
            ],
            "subtotal": 29.97,
            "total_discount": 0,
            "total_tax": 1.50,
            "total_amount": 31.47,
            "paid_amount": 31.47,
            "balance_due": 0,
            "payment_status": "paid",
            "payment_method": "card",
            "payment_date": date_to_datetime(date.today()),
            "transaction_id": "TXN789012",
            "prescription_id": "PRE000002",
            "notes": "Card payment processed",
            "created_by": "USR000003",
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for invoice in invoices:
        existing = await db.invoices.find_one({"invoice_id": invoice["invoice_id"]})
        if not existing:
            await db.invoices.insert_one(invoice)
            print(f"  ✅ Created invoice: {invoice['invoice_number']} - {invoice['patient_name']}")
        else:
            print(f"  ⏭️  Invoice already exists: {invoice['invoice_id']}")

async def main():
    """Main seed function"""
    print("🌱 Starting database seeding...")
    print("="*60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGODB_DB_NAME]
    
    try:
        # Seed data in order
        await seed_users(db)
        await seed_patients(db)
        await seed_products(db)
        await seed_appointments(db)
        await seed_prescriptions(db)
        await seed_invoices(db)
        
        print("\n" + "="*60)
        print("✅ Database seeding completed successfully!")
        print("\n📊 Summary:")
        print(f"  - Users: {await db.users.count_documents({})}")
        print(f"  - Patients: {await db.patients.count_documents({})}")
        print(f"  - Products: {await db.products.count_documents({})}")
        print(f"  - Appointments: {await db.appointments.count_documents({})}")
        print(f"  - Prescriptions: {await db.prescriptions.count_documents({})}")
        print(f"  - Invoices: {await db.invoices.count_documents({})}")
        print("\n🔐 Login Credentials:")
        print("  Admin:        admin@eyecare.com / admin123")
        print("  Doctor:       doctor@eyecare.com / doctor123")
        print("  Receptionist: receptionist@eyecare.com / reception123")
        print("  Optometrist:  optometrist@eyecare.com / optom123")
        print("\n🚀 You can now test all API endpoints!")
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
