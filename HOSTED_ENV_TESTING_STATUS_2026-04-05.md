# Hosted Main-Branch Environment Testing Report

Date: 2026-04-05
Workspace: E:/Eye care ERP
Target Environment: Hosted deployment (Vercel + Railway)

## Endpoints Tested
- Frontend (Vercel): https://eye-care-erp.vercel.app
- Backend (Railway): https://eye-care-erp-production.up.railway.app
- Backend API base (from deployed frontend bundle): https://eye-care-erp-production.up.railway.app/api/v1

## Test Coverage
- Frontend availability
- Backend health and docs availability
- OpenAPI discovery
- Authentication with demo credentials
- Protected endpoint access behavior without token

## Fully Working Items

### 1) Hosted frontend availability
Status: Fully Working
Evidence:
- GET https://eye-care-erp.vercel.app -> HTTP 200

### 2) Hosted backend availability
Status: Fully Working
Evidence:
- GET /health -> 200 with response:
  - {"status":"healthy","app":"Vision Optical","version":"1.0.0"}
- GET /api/docs -> HTTP 200
- GET /openapi.json -> PASS (34 API paths detected)

## Partially Working Items

### 1) Protected APIs are reachable but require valid authorization
Status: Partially Working
Evidence:
- GET /api/v1/patients?page=1&page_size=2 (no token) -> 403
- GET /api/v1/dashboard/stats (no token) -> 403
- GET /api/v1/invoices?page=1&page_size=2 (no token) -> 403
Interpretation:
- API routes are online and guarded.
- Business flow validation could not proceed because authentication failed for all tested users.

## Broken Items

### 1) Hosted authentication with published demo credentials
Status: Broken
Evidence:
- POST /api/v1/auth/login with admin@eyecare.com / admin123 -> 401
- POST /api/v1/auth/login with doctor@eyecare.com / doctor123 -> 401
- POST /api/v1/auth/login with receptionist@eyecare.com / reception123 -> 401
Impact:
- Cannot validate authenticated modules (patients, appointments, products, invoices, reports) in hosted environment.
- Frontend sign-in using documented demo accounts is expected to fail.

## Additional Observation
- Hosted backend health reports app name "Vision Optical", while local run previously showed "Eye Care Institute Management System".
- This suggests hosted configuration/seed data may differ from local setup.

## Command Summary
1. Frontend GET check -> PASS (200)
2. Backend health GET check -> PASS
3. Backend docs GET check -> PASS
4. Auth login checks (admin/doctor/receptionist) -> FAIL (401 each)
5. OpenAPI path inspection -> PASS (34 paths)
6. Protected endpoints without token -> 403 (guarded)

## Recommended Next Actions
1. Verify production user seed on Railway (admin/doctor/receptionist accounts).
2. Confirm if login field is email or username in hosted DB records.
3. Re-seed users in production database if seed did not run.
4. Re-run hosted authenticated smoke tests after auth is fixed.
