# Eye Care ERP - Setup Guide

## Prerequisites

- Python 3.11 or higher
- MongoDB 4.4 or higher
- Git

## Installation Steps

### 1. Clone the Repository

```bash
cd "d:\Eye care ERP"
```

### 2. Create Virtual Environment

```bash
python -m venv venv
```

### 3. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Setup MongoDB

1. Install MongoDB locally or use MongoDB Atlas (cloud)
2. Create a database named `eye_care_institute`
3. Note your connection string

### 6. Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

2. Edit `.env` and update:
```env
MONGODB_URL=mongodb://localhost:27017
SECRET_KEY=your-super-secret-key-change-this
```

### 7. Seed Initial Data

```bash
python scripts/seed_data.py
```

This creates initial users:
- **Admin**: admin@eyecare.com / admin123
- **Doctor**: doctor@eyecare.com / doctor123
- **Receptionist**: receptionist@eyecare.com / reception123

### 8. Run the Application

```bash
python -m app.main
```

Or using uvicorn directly:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 9. Access the Application

- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/api/docs
- **Health Check**: http://localhost:8000/health

## Testing the API

### Authentication Endpoints

#### 1. Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@eyecare.com",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "user_id": "USR000001",
    "email": "admin@eyecare.com",
    "name": "System Administrator",
    "role": "admin"
  }
}
```

**Save the token for subsequent requests:**
```bash
export TOKEN="your_access_token_here"
```

#### 2. Get Current User
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Logout
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

### Patient Endpoints

#### 1. Create a Patient
```bash
curl -X POST http://localhost:8000/api/v1/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "John Doe",
    "date_of_birth": "1990-01-15",
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
    }
  }'
```

#### 2. List All Patients (with pagination)
```bash
curl -X GET "http://localhost:8000/api/v1/patients?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Search Patients
```bash
curl -X GET "http://localhost:8000/api/v1/patients?search=John&page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Get Patient by ID
```bash
curl -X GET http://localhost:8000/api/v1/patients/PAT000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Update Patient
```bash
curl -X PUT http://localhost:8000/api/v1/patients/PAT000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "phone": "+1234567899",
    "email": "john.updated@example.com",
    "notes": "Updated patient information"
  }'
```

#### 6. Delete Patient (Soft Delete)
```bash
curl -X DELETE http://localhost:8000/api/v1/patients/PAT000001 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Appointment Endpoints

#### 1. Create an Appointment
```bash
curl -X POST http://localhost:8000/api/v1/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "PAT000001",
    "doctor_id": "USR000002",
    "appointment_date": "2024-02-15",
    "appointment_time": "10:00:00",
    "duration_minutes": 30,
    "type": "consultation",
    "reason": "Regular eye checkup"
  }'
```

#### 2. List All Appointments
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Filter Appointments by Date
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?start_date=2024-02-01&end_date=2024-02-29" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Filter Appointments by Status
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?status=scheduled" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Filter Appointments by Patient
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?patient_id=PAT000001" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Filter Appointments by Doctor
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?doctor_id=USR000002" \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Get Appointment by ID
```bash
curl -X GET http://localhost:8000/api/v1/appointments/APT000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 8. Update Appointment
```bash
curl -X PUT http://localhost:8000/api/v1/appointments/APT000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "confirmed",
    "notes": "Patient confirmed via phone"
  }'
```

#### 9. Cancel Appointment
```bash
curl -X DELETE http://localhost:8000/api/v1/appointments/APT000001 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Product/Inventory Endpoints

#### 1. Create a Product
```bash
curl -X POST http://localhost:8000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Contact Lens Solution 360ml",
    "description": "Multi-purpose contact lens solution",
    "category": "accessories",
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
    "supplier": {
      "name": "Medical Supplies Inc",
      "contact": "+1234567890",
      "email": "supplier@medical.com"
    }
  }'
```

#### 2. List All Products
```bash
curl -X GET "http://localhost:8000/api/v1/products?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Search Products
```bash
curl -X GET "http://localhost:8000/api/v1/products?search=contact&page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Filter Products by Category
```bash
curl -X GET "http://localhost:8000/api/v1/products?category=accessories" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Get Low Stock Products
```bash
curl -X GET "http://localhost:8000/api/v1/products?low_stock=true" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Get Product by ID
```bash
curl -X GET http://localhost:8000/api/v1/products/PRD000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Update Product
```bash
curl -X PUT http://localhost:8000/api/v1/products/PRD000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "selling_price": 13.99,
    "current_stock": 140
  }'
```

#### 8. Adjust Product Stock
```bash
curl -X POST http://localhost:8000/api/v1/products/PRD000001/adjust-stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantity": -5,
    "reason": "Damaged items removed",
    "notes": "Found 5 damaged bottles"
  }'
```

#### 9. Delete Product
```bash
curl -X DELETE http://localhost:8000/api/v1/products/PRD000001 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Invoice Endpoints

#### 1. Create an Invoice
```bash
curl -X POST http://localhost:8000/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "PAT000001",
    "invoice_date": "2024-02-01",
    "due_date": "2024-03-01",
    "items": [
      {
        "product_id": "PRD000001",
        "product_name": "Contact Lens Solution 360ml",
        "sku": "CLS-360",
        "quantity": 2,
        "unit_price": 12.99,
        "discount": 0,
        "tax": 1.30,
        "total": 27.28
      }
    ],
    "payment_method": "cash"
  }'
```

#### 2. List All Invoices
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Filter Invoices by Patient
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?patient_id=PAT000001" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Filter Invoices by Payment Status
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?payment_status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Filter Invoices by Date Range
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?start_date=2024-02-01&end_date=2024-02-29" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Get Invoice by ID
```bash
curl -X GET http://localhost:8000/api/v1/invoices/INV000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Update Invoice
```bash
curl -X PUT http://localhost:8000/api/v1/invoices/INV000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "payment_status": "paid",
    "notes": "Payment received"
  }'
```

#### 8. Record Payment
```bash
curl -X POST http://localhost:8000/api/v1/invoices/INV000001/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 27.28,
    "payment_method": "cash",
    "payment_date": "2024-02-01",
    "transaction_id": "TXN123456"
  }'
```

#### 9. Generate Invoice PDF
```bash
curl -X GET http://localhost:8000/api/v1/invoices/INV000001/pdf \
  -H "Authorization: Bearer $TOKEN" \
  --output invoice.pdf
```

---

### Prescription Endpoints

#### 1. Create a Prescription
```bash
curl -X POST http://localhost:8000/api/v1/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "PAT000001",
    "doctor_id": "USR000002",
    "prescription_date": "2024-02-01",
    "valid_until": "2025-02-01",
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
    "diagnosis": "Myopia with astigmatism",
    "notes": "Recommend anti-glare coating"
  }'
```

#### 2. List All Prescriptions
```bash
curl -X GET "http://localhost:8000/api/v1/prescriptions?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Filter Prescriptions by Patient
```bash
curl -X GET "http://localhost:8000/api/v1/prescriptions?patient_id=PAT000001" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Get Prescription by ID
```bash
curl -X GET http://localhost:8000/api/v1/prescriptions/PRE000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Update Prescription
```bash
curl -X PUT http://localhost:8000/api/v1/prescriptions/PRE000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "notes": "Updated prescription notes"
  }'
```

#### 6. Generate Prescription PDF
```bash
curl -X GET http://localhost:8000/api/v1/prescriptions/PRE000001/pdf \
  -H "Authorization: Bearer $TOKEN" \
  --output prescription.pdf
```

---

### Dashboard Endpoints

#### 1. Get Dashboard Statistics
```bash
curl -X GET http://localhost:8000/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Response Example:**
```json
{
  "total_patients": 1250,
  "total_appointments": 3450,
  "today_appointments": 15,
  "pending_payments": 25000,
  "low_stock_items": 8,
  "revenue_today": 5670.50,
  "revenue_month": 125430.75
}
```

#### 2. Get Revenue Data
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/revenue?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Get Appointments Summary
```bash
curl -X GET http://localhost:8000/api/v1/dashboard/appointments-summary \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Get Inventory Alerts
```bash
curl -X GET http://localhost:8000/api/v1/dashboard/inventory-alerts \
  -H "Authorization: Bearer $TOKEN"
```

---

### Report Endpoints

#### 1. Generate Sales Report
```bash
curl -X GET "http://localhost:8000/api/v1/reports/sales?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2. Generate Inventory Report
```bash
curl -X GET http://localhost:8000/api/v1/reports/inventory \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Generate Patient Report
```bash
curl -X GET "http://localhost:8000/api/v1/reports/patients?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Export Report (CSV)
```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "report_type": "sales",
    "format": "csv",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }' \
  --output sales_report.csv
```

#### 5. Export Report (Excel)
```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "report_type": "inventory",
    "format": "excel"
  }' \
  --output inventory_report.xlsx
```

#### 6. Export Report (PDF)
```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "report_type": "patients",
    "format": "pdf",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }' \
  --output patients_report.pdf
```

---

## Using Postman

### 1. Import as Postman Collection

Create a new collection in Postman and set these variables:
- `base_url`: `http://localhost:8000`
- `token`: (Set after login)

### 2. Setup Authorization

1. Go to Collection Settings → Authorization
2. Select Type: Bearer Token
3. Token: `{{token}}`

### 3. Login and Save Token

After login request:
1. Go to Tests tab
2. Add this script:
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.collectionVariables.set("token", jsonData.access_token);
}
```

---

## Using Python Requests

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "admin@eyecare.com",
    "password": "admin123"
})
token = response.json()["access_token"]

# Set headers
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Create patient
patient_data = {
    "name": "John Doe",
    "date_of_birth": "1990-01-15",
    "gender": "male",
    "phone": "+1234567890",
    "email": "john@example.com"
}
response = requests.post(f"{BASE_URL}/patients", json=patient_data, headers=headers)
print(response.json())

# List patients
response = requests.get(f"{BASE_URL}/patients?page=1&page_size=10", headers=headers)
print(response.json())
```

---

## Testing with Swagger UI

1. Navigate to http://localhost:8000/api/docs
2. Click "Authorize" button
3. Enter: `Bearer YOUR_TOKEN` (without quotes)
4. Click "Authorize"
5. Test any endpoint directly from the interface

---

## Common HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

---

## Project Structure

````markdown
# Eye Care ERP - Setup Guide

## Prerequisites

- Python 3.11 or higher
- MongoDB 4.4 or higher
- Git

## Installation Steps

### 1. Clone the Repository

```bash
cd "d:\Eye care ERP"
```

### 2. Create Virtual Environment

```bash
python -m venv venv
```

### 3. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Setup MongoDB

1. Install MongoDB locally or use MongoDB Atlas (cloud)
2. Create a database named `eye_care_institute`
3. Note your connection string

### 6. Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

2. Edit `.env` and update:
```env
MONGODB_URL=mongodb://localhost:27017
SECRET_KEY=your-super-secret-key-change-this
```

### 7. Seed Initial Data

```bash
python scripts/seed_data.py
```

This creates initial users:
- **Admin**: admin@eyecare.com / admin123
- **Doctor**: doctor@eyecare.com / doctor123
- **Receptionist**: receptionist@eyecare.com / reception123

### 8. Run the Application

```bash
python -m app.main
```

Or using uvicorn directly:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 9. Access the Application

- **API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/api/docs
- **Health Check**: http://localhost:8000/health

## Testing the API

### Authentication Endpoints

#### 1. Login
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@eyecare.com",
    "password": "admin123"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "user_id": "USR000001",
    "email": "admin@eyecare.com",
    "name": "System Administrator",
    "role": "admin"
  }
}
```

**Save the token for subsequent requests:**
```bash
export TOKEN="your_access_token_here"
```

#### 2. Get Current User
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Logout
```bash
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

### Patient Endpoints

#### 1. Create a Patient
```bash
curl -X POST http://localhost:8000/api/v1/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "John Doe",
    "date_of_birth": "1990-01-15",
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
    }
  }'
```

#### 2. List All Patients (with pagination)
```bash
curl -X GET "http://localhost:8000/api/v1/patients?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Search Patients
```bash
curl -X GET "http://localhost:8000/api/v1/patients?search=John&page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Get Patient by ID
```bash
curl -X GET http://localhost:8000/api/v1/patients/PAT000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Update Patient
```bash
curl -X PUT http://localhost:8000/api/v1/patients/PAT000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "phone": "+1234567899",
    "email": "john.updated@example.com",
    "notes": "Updated patient information"
  }'
```

#### 6. Delete Patient (Soft Delete)
```bash
curl -X DELETE http://localhost:8000/api/v1/patients/PAT000001 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Appointment Endpoints

#### 1. Create an Appointment
```bash
curl -X POST http://localhost:8000/api/v1/appointments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "PAT000001",
    "doctor_id": "USR000002",
    "appointment_date": "2024-02-15",
    "appointment_time": "10:00:00",
    "duration_minutes": 30,
    "type": "consultation",
    "reason": "Regular eye checkup"
  }'
```

#### 2. List All Appointments
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Filter Appointments by Date
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?start_date=2024-02-01&end_date=2024-02-29" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Filter Appointments by Status
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?status=scheduled" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Filter Appointments by Patient
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?patient_id=PAT000001" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Filter Appointments by Doctor
```bash
curl -X GET "http://localhost:8000/api/v1/appointments?doctor_id=USR000002" \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Get Appointment by ID
```bash
curl -X GET http://localhost:8000/api/v1/appointments/APT000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 8. Update Appointment
```bash
curl -X PUT http://localhost:8000/api/v1/appointments/APT000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "confirmed",
    "notes": "Patient confirmed via phone"
  }'
```

#### 9. Cancel Appointment
```bash
curl -X DELETE http://localhost:8000/api/v1/appointments/APT000001 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Product/Inventory Endpoints

#### 1. Create a Product
```bash
curl -X POST http://localhost:8000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Contact Lens Solution 360ml",
    "description": "Multi-purpose contact lens solution",
    "category": "accessories",
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
    "supplier": {
      "name": "Medical Supplies Inc",
      "contact": "+1234567890",
      "email": "supplier@medical.com"
    }
  }'
```

#### 2. List All Products
```bash
curl -X GET "http://localhost:8000/api/v1/products?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Search Products
```bash
curl -X GET "http://localhost:8000/api/v1/products?search=contact&page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Filter Products by Category
```bash
curl -X GET "http://localhost:8000/api/v1/products?category=accessories" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Get Low Stock Products
```bash
curl -X GET "http://localhost:8000/api/v1/products?low_stock=true" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Get Product by ID
```bash
curl -X GET http://localhost:8000/api/v1/products/PRD000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Update Product
```bash
curl -X PUT http://localhost:8000/api/v1/products/PRD000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "selling_price": 13.99,
    "current_stock": 140
  }'
```

#### 8. Adjust Product Stock
```bash
curl -X POST http://localhost:8000/api/v1/products/PRD000001/adjust-stock \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quantity": -5,
    "reason": "Damaged items removed",
    "notes": "Found 5 damaged bottles"
  }'
```

#### 9. Delete Product
```bash
curl -X DELETE http://localhost:8000/api/v1/products/PRD000001 \
  -H "Authorization: Bearer $TOKEN"
```

---

### Invoice Endpoints

#### 1. Create an Invoice
```bash
curl -X POST http://localhost:8000/api/v1/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "PAT000001",
    "invoice_date": "2024-02-01",
    "due_date": "2024-03-01",
    "items": [
      {
        "product_id": "PRD000001",
        "product_name": "Contact Lens Solution 360ml",
        "sku": "CLS-360",
        "quantity": 2,
        "unit_price": 12.99,
        "discount": 0,
        "tax": 1.30,
        "total": 27.28
      }
    ],
    "payment_method": "cash"
  }'
```

#### 2. List All Invoices
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Filter Invoices by Patient
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?patient_id=PAT000001" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Filter Invoices by Payment Status
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?payment_status=pending" \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Filter Invoices by Date Range
```bash
curl -X GET "http://localhost:8000/api/v1/invoices?start_date=2024-02-01&end_date=2024-02-29" \
  -H "Authorization: Bearer $TOKEN"
```

#### 6. Get Invoice by ID
```bash
curl -X GET http://localhost:8000/api/v1/invoices/INV000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 7. Update Invoice
```bash
curl -X PUT http://localhost:8000/api/v1/invoices/INV000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "payment_status": "paid",
    "notes": "Payment received"
  }'
```

#### 8. Record Payment
```bash
curl -X POST http://localhost:8000/api/v1/invoices/INV000001/payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 27.28,
    "payment_method": "cash",
    "payment_date": "2024-02-01",
    "transaction_id": "TXN123456"
  }'
```

#### 9. Generate Invoice PDF
```bash
curl -X GET http://localhost:8000/api/v1/invoices/INV000001/pdf \
  -H "Authorization: Bearer $TOKEN" \
  --output invoice.pdf
```

---

### Prescription Endpoints

#### 1. Create a Prescription
```bash
curl -X POST http://localhost:8000/api/v1/prescriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "patient_id": "PAT000001",
    "doctor_id": "USR000002",
    "prescription_date": "2024-02-01",
    "valid_until": "2025-02-01",
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
    "diagnosis": "Myopia with astigmatism",
    "notes": "Recommend anti-glare coating"
  }'
```

#### 2. List All Prescriptions
```bash
curl -X GET "http://localhost:8000/api/v1/prescriptions?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Filter Prescriptions by Patient
```bash
curl -X GET "http://localhost:8000/api/v1/prescriptions?patient_id=PAT000001" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Get Prescription by ID
```bash
curl -X GET http://localhost:8000/api/v1/prescriptions/PRE000001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 5. Update Prescription
```bash
curl -X PUT http://localhost:8000/api/v1/prescriptions/PRE000001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "notes": "Updated prescription notes"
  }'
```

#### 6. Generate Prescription PDF
```bash
curl -X GET http://localhost:8000/api/v1/prescriptions/PRE000001/pdf \
  -H "Authorization: Bearer $TOKEN" \
  --output prescription.pdf
```

---

### Dashboard Endpoints

#### 1. Get Dashboard Statistics
```bash
curl -X GET http://localhost:8000/api/v1/dashboard/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Response Example:**
```json
{
  "total_patients": 1250,
  "total_appointments": 3450,
  "today_appointments": 15,
  "pending_payments": 25000,
  "low_stock_items": 8,
  "revenue_today": 5670.50,
  "revenue_month": 125430.75
}
```

#### 2. Get Revenue Data
```bash
curl -X GET "http://localhost:8000/api/v1/dashboard/revenue?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Get Appointments Summary
```bash
curl -X GET http://localhost:8000/api/v1/dashboard/appointments-summary \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Get Inventory Alerts
```bash
curl -X GET http://localhost:8000/api/v1/dashboard/inventory-alerts \
  -H "Authorization: Bearer $TOKEN"
```

---

### Report Endpoints

#### 1. Generate Sales Report
```bash
curl -X GET "http://localhost:8000/api/v1/reports/sales?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### 2. Generate Inventory Report
```bash
curl -X GET http://localhost:8000/api/v1/reports/inventory \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Generate Patient Report
```bash
curl -X GET "http://localhost:8000/api/v1/reports/patients?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Export Report (CSV)
```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "report_type": "sales",
    "format": "csv",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }' \
  --output sales_report.csv
```

#### 5. Export Report (Excel)
```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "report_type": "inventory",
    "format": "excel"
  }' \
  --output inventory_report.xlsx
```

#### 6. Export Report (PDF)
```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "report_type": "patients",
    "format": "pdf",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31"
  }' \
  --output patients_report.pdf
```

---

## Using Postman

### 1. Import as Postman Collection

Create a new collection in Postman and set these variables:
- `base_url`: `http://localhost:8000`
- `token`: (Set after login)

### 2. Setup Authorization

1. Go to Collection Settings → Authorization
2. Select Type: Bearer Token
3. Token: `{{token}}`

### 3. Login and Save Token

After login request:
1. Go to Tests tab
2. Add this script:
```javascript
if (pm.response.code === 200) {
    var jsonData = pm.response.json();
    pm.collectionVariables.set("token", jsonData.access_token);
}
```

---

## Using Python Requests

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# Login
response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "admin@eyecare.com",
    "password": "admin123"
})
token = response.json()["access_token"]

# Set headers
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Create patient
patient_data = {
    "name": "John Doe",
    "date_of_birth": "1990-01-15",
    "gender": "male",
    "phone": "+1234567890",
    "email": "john@example.com"
}
response = requests.post(f"{BASE_URL}/patients", json=patient_data, headers=headers)
print(response.json())

# List patients
response = requests.get(f"{BASE_URL}/patients?page=1&page_size=10", headers=headers)
print(response.json())
```

---

## Testing with Swagger UI

1. Navigate to http://localhost:8000/api/docs
2. Click "Authorize" button
3. Enter: `Bearer YOUR_TOKEN` (without quotes)
4. Click "Authorize"
5. Test any endpoint directly from the interface

---

## Common HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `422 Unprocessable Entity` - Validation error
- `500 Internal Server Error` - Server error

---

## Project Structure
````

