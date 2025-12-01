# PowerShell script to migrate backend files to backend folder

Write-Host "🚀 Starting Backend Migration..." -ForegroundColor Green

# Set location
Set-Location "d:\Eye care ERP"

# Create backend directory
Write-Host "📁 Creating backend directory..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path "backend" -Force | Out-Null

# Move directories
Write-Host "📦 Moving backend directories..." -ForegroundColor Cyan
if (Test-Path "app") {
    Move-Item -Path "app" -Destination "backend\app" -Force
    Write-Host "  ✅ Moved app/" -ForegroundColor Green
}

if (Test-Path "scripts") {
    Move-Item -Path "scripts" -Destination "backend\scripts" -Force
    Write-Host "  ✅ Moved scripts/" -ForegroundColor Green
}

if (Test-Path "tests") {
    Move-Item -Path "tests" -Destination "backend\tests" -Force
    Write-Host "  ✅ Moved tests/" -ForegroundColor Green
}

# Move files
Write-Host "📄 Moving backend files..." -ForegroundColor Cyan
if (Test-Path "requirements.txt") {
    Move-Item -Path "requirements.txt" -Destination "backend\requirements.txt" -Force
    Write-Host "  ✅ Moved requirements.txt" -ForegroundColor Green
}

if (Test-Path ".env") {
    Move-Item -Path ".env" -Destination "backend\.env" -Force
    Write-Host "  ✅ Moved .env" -ForegroundColor Green
}

if (Test-Path ".env.example") {
    Move-Item -Path ".env.example" -Destination "backend\.env.example" -Force
    Write-Host "  ✅ Moved .env.example" -ForegroundColor Green
}

# Create backend README
Write-Host "📝 Creating backend README..." -ForegroundColor Cyan
$backendReadme = @"
# Eye Care ERP - Backend

Python FastAPI backend for Eye Care Institute Management System.

## Quick Start

``````bash
# Activate virtual environment
..\venv\Scripts\activate

# Or create new venv here
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database seeding (first time only)
python scripts\seed_data.py

# Start server
python -m app.main
``````

Backend runs at: http://localhost:8000
API Docs: http://localhost:8000/api/docs

## Environment Variables

Copy ``.env.example`` to ``.env`` and configure:

``````env
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=eye_care_institute
SECRET_KEY=your-secret-key-here
``````

## Default Login Credentials

- Admin: admin@eyecare.com / admin123
- Doctor: doctor@eyecare.com / doctor123
- Receptionist: receptionist@eyecare.com / reception123

## Project Structure

``````
backend/
├── app/
│   ├── api/          # API endpoints
│   ├── models/       # Database models
│   ├── schemas/      # Pydantic schemas
│   ├── services/     # Business logic
│   ├── repositories/ # Data access
│   ├── core/         # Security, middleware
│   └── utils/        # Helpers
├── scripts/          # Database scripts
├── tests/           # Test files
└── requirements.txt
``````
"@

Set-Content -Path "backend\README.md" -Value $backendReadme
Write-Host "  ✅ Created backend\README.md" -ForegroundColor Green

# Update main README
Write-Host "📝 Updating main README..." -ForegroundColor Cyan
$mainReadme = @"
# Eye Care Institute Management System

Complete ERP system for Eye Care Institutes with Python FastAPI backend and React TypeScript frontend.

## 🚀 Quick Start

### Backend Setup

``````bash
cd backend
..\venv\Scripts\activate
pip install -r requirements.txt
python scripts\seed_data.py
python -m app.main
``````

Backend: http://localhost:8000

### Frontend Setup

``````bash
cd frontend
npm install
npm run dev
``````

Frontend: http://localhost:3000

## 📦 Project Structure

``````
Eye care ERP/
├── backend/          # Python FastAPI backend
│   ├── app/
│   ├── scripts/
│   └── tests/
├── frontend/         # React TypeScript frontend
│   ├── src/
│   └── public/
├── docs/            # Documentation
└── README.md
``````

## 🔐 Default Credentials

- Admin: admin@eyecare.com / admin123
- Doctor: doctor@eyecare.com / doctor123
- Receptionist: receptionist@eyecare.com / reception123

## 📚 Documentation

- Backend API: http://localhost:8000/api/docs
- Use Cases: [docs/USE_CASES.md](./docs/USE_CASES.md)
- Backend Setup: [backend/README.md](./backend/README.md)
- Frontend Setup: [frontend/README.md](./frontend/README.md)

## 🛠️ Technology Stack

### Backend
- FastAPI
- MongoDB with Motor
- JWT Authentication
- Pydantic validation
- Report generation (CSV/Excel/PDF)

### Frontend
- React 18 + TypeScript
- Vite
- Zustand for state
- React Query
- Tailwind CSS
- React Router

## ✅ Features

- Patient Management
- Appointment Scheduling
- Prescription Management
- Inventory & Products
- Invoicing & Billing
- Reports & Analytics
- Dashboard with real-time stats
"@

Set-Content -Path "README.md" -Value $mainReadme
Write-Host "  ✅ Updated README.md" -ForegroundColor Green

Write-Host ""
Write-Host "✨ Migration Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. cd backend" -ForegroundColor White
Write-Host "2. ..\venv\Scripts\activate" -ForegroundColor White
Write-Host "3. python -m app.main" -ForegroundColor White
Write-Host ""
Write-Host "In another terminal:" -ForegroundColor Yellow
Write-Host "1. cd frontend" -ForegroundColor White
Write-Host "2. npm run dev" -ForegroundColor White
Write-Host ""
