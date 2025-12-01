# Eye Care Institute Management System - Use Cases

## Table of Contents
1. [Patient Management Use Cases](#patient-management-use-cases)
2. [Appointment Management Use Cases](#appointment-management-use-cases)
3. [Prescription Management Use Cases](#prescription-management-use-cases)
4. [Inventory Management Use Cases](#inventory-management-use-cases)
5. [Invoice & Billing Use Cases](#invoice--billing-use-cases)
6. [Reporting & Analytics Use Cases](#reporting--analytics-use-cases)
7. [Dashboard Use Cases](#dashboard-use-cases)
8. [User & Role Management Use Cases](#user--role-management-use-cases)

---

## Patient Management Use Cases

### UC-P1: Register New Patient
**Actor:** Receptionist, Admin  
**Description:** Register a new patient in the system with complete demographic and medical information.

**Preconditions:**
- User must be logged in
- User has receptionist or admin role

**Main Flow:**
1. User navigates to patient registration
2. User enters patient details:
   - Personal info (name, DOB, gender, contact)
   - Address information
   - Emergency contact
   - Medical history (allergies, conditions, medications)
   - Insurance information
3. System validates data
4. System generates unique patient ID (PAT000XXX)
5. System saves patient record
6. System displays success message with patient ID

**Alternative Flows:**
- **A1:** Phone number already exists → System shows error
- **A2:** Missing required fields → System highlights errors
- **A3:** Invalid date of birth → System shows validation error

**API Endpoint:** `POST /api/v1/patients`

**Example Request:**
```json
{
  "name": "John Doe",
  "date_of_birth": "1990-01-15",
  "gender": "male",
  "phone": "+1234567890",
  "email": "john@example.com",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip_code": "10001"
  },
  "emergency_contact": {
    "name": "Jane Doe",
    "relationship": "Spouse",
    "phone": "+1234567891"
  },
  "medical_history": {
    "allergies": ["Penicillin"],
    "chronic_conditions": ["Myopia"],
    "current_medications": []
  }
}
```

---

### UC-P2: Search Patient Records
**Actor:** All Staff  
**Description:** Search and retrieve patient information by various criteria.

**Search Criteria:**
- Patient ID
- Patient name (partial match)
- Phone number
- Email address

**Main Flow:**
1. User enters search term
2. System queries database
3. System displays matching results with pagination
4. User selects patient to view details

**API Endpoint:** `GET /api/v1/patients?search=John&page=1&page_size=10`

---

### UC-P3: Update Patient Information
**Actor:** Receptionist, Admin, Doctor  
**Description:** Update existing patient information including contact details and medical history.

**Main Flow:**
1. User searches and selects patient
2. User updates fields
3. System validates changes
4. System updates record with timestamp
5. System logs changes in audit trail

**API Endpoint:** `PUT /api/v1/patients/{patient_id}`

---

### UC-P4: View Patient History
**Actor:** Doctor, Optometrist, Admin  
**Description:** View complete patient history including visits, prescriptions, and invoices.

**Information Displayed:**
- Visit history
- Previous prescriptions
- Billing history
- Medical notes
- Appointment history

**API Endpoints:**
- `GET /api/v1/patients/{patient_id}`
- `GET /api/v1/patients/{patient_id}/appointments`
- `GET /api/v1/patients/{patient_id}/prescriptions`
- `GET /api/v1/patients/{patient_id}/invoices`

---

## Appointment Management Use Cases

### UC-A1: Schedule New Appointment
**Actor:** Receptionist, Admin  
**Description:** Schedule a new appointment for a patient with a doctor.

**Preconditions:**
- Patient must exist in system
- Doctor must be available
- Time slot must be free

**Main Flow:**
1. User selects patient
2. User selects doctor
3. User chooses date and time
4. User specifies appointment type (consultation, follow-up, emergency)
5. User enters reason for visit
6. System checks for conflicts
7. System creates appointment
8. System sends confirmation (optional)

**Appointment Types:**
- Consultation
- Follow-up
- Emergency
- Screening

**Appointment Statuses:**
- Scheduled
- Confirmed
- In-Progress
- Completed
- Cancelled
- No-Show

**API Endpoint:** `POST /api/v1/appointments`

**Example Request:**
```json
{
  "patient_id": "PAT000001",
  "doctor_id": "USR000002",
  "appointment_date": "2024-02-15",
  "appointment_time": "10:00:00",
  "duration_minutes": 30,
  "type": "consultation",
  "reason": "Regular eye checkup"
}
```

---

### UC-A2: View Daily Schedule
**Actor:** Doctor, Receptionist  
**Description:** View all appointments for a specific date and doctor.

**Filters:**
- Date (today, tomorrow, specific date)
- Doctor
- Status
- Patient

**API Endpoint:** `GET /api/v1/appointments?appointment_date=2024-02-15&doctor_id=USR000002`

---

### UC-A3: Reschedule Appointment
**Actor:** Receptionist, Admin  
**Description:** Change appointment date/time while maintaining patient and doctor assignment.

**Main Flow:**
1. User finds existing appointment
2. User selects new date/time
3. System checks availability
4. System updates appointment
5. System notifies patient (optional)

**API Endpoint:** `PUT /api/v1/appointments/{appointment_id}`

---

### UC-A4: Cancel Appointment
**Actor:** Receptionist, Admin  
**Description:** Cancel an appointment with reason.

**Main Flow:**
1. User finds appointment
2. User cancels appointment
3. User enters cancellation reason
4. System updates status to "cancelled"
5. System records cancellation timestamp

**API Endpoint:** `DELETE /api/v1/appointments/{appointment_id}`

---

### UC-A5: Check-in Patient
**Actor:** Receptionist  
**Description:** Mark patient as checked-in for their appointment.

**Main Flow:**
1. Patient arrives at clinic
2. Receptionist searches for appointment
3. Receptionist marks as "in-progress"
4. Doctor receives notification

**API Endpoint:** `PUT /api/v1/appointments/{appointment_id}` with status "in-progress"

---

## Prescription Management Use Cases

### UC-PR1: Create Eye Prescription
**Actor:** Doctor, Optometrist  
**Description:** Create a new prescription for eyeglasses or contact lenses.

**Prescription Components:**
- Right eye measurements (SPH, CYL, Axis, Add, PD)
- Left eye measurements
- Prescription type (single-vision, bifocal, progressive)
- Diagnosis
- Validity period (typically 1-2 years)

**Main Flow:**
1. Doctor completes eye examination
2. Doctor enters prescription details
3. System validates measurements
4. System generates prescription ID
5. System saves prescription
6. System allows printing/PDF generation

**API Endpoint:** `POST /api/v1/prescriptions`

**Example Request:**
```json
{
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
}
```

---

### UC-PR2: Add Medication Prescription
**Actor:** Doctor  
**Description:** Add medication prescription for eye conditions (drops, ointments).

**Medication Details:**
- Medication name
- Dosage
- Frequency (e.g., "3 times daily")
- Duration (e.g., "7 days")
- Instructions
- Quantity

**Main Flow:**
1. Doctor diagnoses condition
2. Doctor prescribes medication
3. Doctor enters dosage and instructions
4. System saves medication details
5. Patient receives prescription

---

### UC-PR3: View Patient Prescription History
**Actor:** Doctor, Optometrist, Patient (self)  
**Description:** View all past prescriptions for a patient.

**API Endpoint:** `GET /api/v1/prescriptions?patient_id=PAT000001`

---

### UC-PR4: Print/Generate Prescription PDF
**Actor:** Doctor, Receptionist  
**Description:** Generate PDF copy of prescription for patient.

**API Endpoint:** `GET /api/v1/prescriptions/{prescription_id}/pdf`

---

## Inventory Management Use Cases

### UC-I1: Add New Product
**Actor:** Admin, Staff  
**Description:** Add new product to inventory (frames, lenses, contact lenses, drops).

**Product Categories:**
- Contact Lenses
- Eyeglasses/Lenses
- Frames
- Sunglasses
- Eye Drops
- Accessories

**Main Flow:**
1. User enters product details
2. User sets pricing (cost, selling, MRP)
3. User sets stock levels (min, max, reorder)
4. User adds supplier information
5. System generates product ID
6. System saves product

**API Endpoint:** `POST /api/v1/products`

**Example Request:**
```json
{
  "name": "Ray-Ban Aviator Frame",
  "category": "frames",
  "brand": "Ray-Ban",
  "sku": "RB-AVI-001",
  "cost_price": 80.00,
  "selling_price": 149.99,
  "mrp": 179.99,
  "current_stock": 25,
  "min_stock_level": 5,
  "supplier": {
    "name": "Luxottica",
    "contact": "+1234567890"
  }
}
```

---

### UC-I2: Update Stock Levels
**Actor:** Staff, Admin  
**Description:** Adjust stock levels for purchases, sales, damages, or returns.

**Transaction Types:**
- Purchase (add stock)
- Sale (reduce stock)
- Adjustment (manual correction)
- Return (add back)
- Damaged (remove)

**Main Flow:**
1. User selects product
2. User specifies quantity change
3. User selects transaction type
4. User enters reason/notes
5. System updates stock
6. System logs transaction
7. System checks if reorder needed

**API Endpoint:** `POST /api/v1/products/{product_id}/adjust-stock`

**Example Request:**
```json
{
  "quantity": -5,
  "reason": "Damaged items removed",
  "notes": "Found 5 damaged bottles during inspection"
}
```

---

### UC-I3: View Low Stock Alert
**Actor:** Admin, Staff  
**Description:** View products that need reordering.

**Alert Conditions:**
- Current stock ≤ Minimum stock level
- Out of stock items
- Expiring soon items

**API Endpoint:** `GET /api/v1/products?low_stock=true`

---

### UC-I4: Generate Purchase Order
**Actor:** Admin  
**Description:** Create purchase order for low stock items.

**Main Flow:**
1. System identifies low stock items
2. User reviews reorder list
3. User generates purchase order
4. System calculates reorder quantities
5. System sends to supplier

---

### UC-I5: Product Expiry Tracking
**Actor:** Staff, Admin  
**Description:** Track and alert on products nearing expiry.

**Use Case for:**
- Eye drops
- Contact lens solutions
- Medications

**API Endpoint:** `GET /api/v1/dashboard/inventory-alerts`

---

## Invoice & Billing Use Cases

### UC-B1: Create Invoice
**Actor:** Receptionist, Admin  
**Description:** Create invoice for products/services sold to patient.

**Invoice Components:**
- Patient information
- Line items (products with quantity, price)
- Discounts
- Taxes
- Payment method
- Due date

**Main Flow:**
1. User selects patient
2. User adds products/services
3. System calculates totals
4. User applies discounts (if any)
5. User selects payment method
6. System generates invoice number
7. System saves invoice
8. System updates inventory (reduces stock)

**API Endpoint:** `POST /api/v1/invoices`

**Example Request:**
```json
{
  "patient_id": "PAT000001",
  "invoice_date": "2024-02-01",
  "due_date": "2024-03-01",
  "items": [
    {
      "product_id": "PRD000001",
      "product_name": "Contact Lens Solution",
      "sku": "CLS-360",
      "quantity": 2,
      "unit_price": 12.99,
      "discount": 0,
      "tax": 1.30,
      "total": 27.28
    }
  ],
  "payment_method": "cash"
}
```

---

### UC-B2: Record Payment
**Actor:** Receptionist, Admin  
**Description:** Record full or partial payment for an invoice.

**Payment Methods:**
- Cash
- Credit/Debit Card
- UPI
- Net Banking
- Insurance

**Main Flow:**
1. User selects invoice
2. User enters payment amount
3. User selects payment method
4. User enters transaction ID (if applicable)
5. System updates paid amount
6. System recalculates balance
7. System updates payment status

**Payment Statuses:**
- Paid (balance = 0)
- Partial (some amount paid)
- Pending (no payment)
- Overdue (past due date)

**API Endpoint:** `POST /api/v1/invoices/{invoice_id}/payment`

---

### UC-B3: Insurance Claim Processing
**Actor:** Admin, Receptionist  
**Description:** Process insurance claims for patient invoices.

**Main Flow:**
1. User creates invoice
2. User enters insurance details
3. System submits claim to insurance
4. System tracks claim status
5. System updates invoice when approved
6. System calculates patient responsibility

---

### UC-B4: Generate Invoice PDF
**Actor:** Receptionist, Admin  
**Description:** Generate printable invoice for patient.

**API Endpoint:** `GET /api/v1/invoices/{invoice_id}/pdf`

---

### UC-B5: View Outstanding Payments
**Actor:** Admin  
**Description:** View all invoices with pending or partial payments.

**Filters:**
- Payment status
- Date range
- Patient
- Amount range

**API Endpoint:** `GET /api/v1/invoices?payment_status=pending`

---

## Reporting & Analytics Use Cases

### UC-R1: Generate Sales Report
**Actor:** Admin, Manager  
**Description:** Generate comprehensive sales report for a date range.

**Report Contains:**
- Total revenue
- Number of invoices
- Payment breakdown (paid/pending)
- Discounts given
- Tax collected
- Daily/weekly/monthly trends

**API Endpoint:** `GET /api/v1/reports/sales?start_date=2024-01-01&end_date=2024-01-31`

---

### UC-R2: Generate Inventory Report
**Actor:** Admin, Manager  
**Description:** Generate complete inventory status report.

**Report Contains:**
- All products with stock levels
- Total inventory value
- Low stock items
- Out of stock items
- Fast-moving items
- Slow-moving items

**API Endpoint:** `GET /api/v1/reports/inventory`

---

### UC-R3: Generate Patient Report
**Actor:** Admin, Doctor  
**Description:** Generate patient statistics and growth report.

**Report Contains:**
- Total registered patients
- Active vs inactive patients
- New patient registrations
- Patient demographics
- Visit frequency
- Revenue per patient

**API Endpoint:** `GET /api/v1/reports/patients?start_date=2024-01-01&end_date=2024-01-31`

---

### UC-R4: Export Report to Excel/CSV/PDF
**Actor:** Admin, Manager  
**Description:** Export any report in multiple formats.

**Supported Formats:**
- CSV (for data analysis)
- Excel (.xlsx) (formatted spreadsheet)
- PDF (for printing/sharing)

**Main Flow:**
1. User generates report
2. User selects export format
3. System formats data
4. System generates file
5. System downloads to user

**API Endpoint:** `POST /api/v1/reports/export`

**Example Request:**
```json
{
  "report_type": "sales",
  "format": "excel",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31"
}
```

---

## Dashboard Use Cases

### UC-D1: View Dashboard Overview
**Actor:** All Users  
**Description:** View real-time statistics and key metrics.

**Dashboard Widgets:**
- Total patients
- Today's appointments
- Revenue (today, this month)
- Pending payments
- Low stock alerts
- Recent activities

**API Endpoint:** `GET /api/v1/dashboard/stats`

**Response Example:**
```json
{
  "total_patients": 1250,
  "total_appointments": 3450,
  "today_appointments": 15,
  "pending_payments": 25000.00,
  "low_stock_items": 8,
  "revenue_today": 5670.50,
  "revenue_month": 125430.75
}
```

---

### UC-D2: View Revenue Analytics
**Actor:** Admin, Manager  
**Description:** View detailed revenue trends and analytics.

**Analytics Include:**
- Daily revenue chart
- Payment status breakdown
- Revenue by doctor
- Revenue by service type
- Month-over-month comparison

**API Endpoint:** `GET /api/v1/dashboard/revenue?start_date=2024-01-01&end_date=2024-01-31`

---

### UC-D3: View Appointment Calendar
**Actor:** Receptionist, Doctor  
**Description:** View appointments in calendar format.

**Views:**
- Day view
- Week view
- Month view
- Doctor-wise view

**API Endpoint:** `GET /api/v1/dashboard/appointments-summary`

---

### UC-D4: View Inventory Alerts
**Actor:** Admin, Staff  
**Description:** View critical inventory notifications.

**Alerts:**
- Low stock items
- Out of stock items
- Expiring soon items
- Reorder recommendations

**API Endpoint:** `GET /api/v1/dashboard/inventory-alerts`

---

### UC-D5: View Top Products
**Actor:** Admin, Manager  
**Description:** View best-selling products.

**Metrics:**
- Quantity sold
- Total revenue
- Profit margin
- Trend analysis

**API Endpoint:** `GET /api/v1/dashboard/top-products?limit=10`

---

## User & Role Management Use Cases

### UC-U1: User Login
**Actor:** All Users  
**Description:** Authenticate user and provide access token.

**Main Flow:**
1. User enters email and password
2. System validates credentials
3. System generates JWT token
4. System returns token and user info
5. System logs login activity

**API Endpoint:** `POST /api/v1/auth/login`

**Roles Available:**
- Admin (full access)
- Doctor (patient records, prescriptions, appointments)
- Optometrist (eye exams, prescriptions)
- Staff (inventory, invoices)
- Receptionist (appointments, patient registration)

---

### UC-U2: View Current User Profile
**Actor:** All Users  
**Description:** View logged-in user's profile information.

**API Endpoint:** `GET /api/v1/auth/me`

---

### UC-U3: Logout
**Actor:** All Users  
**Description:** End user session and invalidate token.

**API Endpoint:** `POST /api/v1/auth/logout`

---

## Common Workflows

### Workflow 1: New Patient Visit - Complete Journey

