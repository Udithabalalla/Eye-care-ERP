# Eye Care ERP Testing Strategy

## Goal
Validate the platform from the user journey level down to the service and API layers so we can confirm core clinic operations are stable: login, patient and appointment management, doctor setup, inventory, invoicing, payments, purchasing, sales orders, reporting, and admin/configuration screens.

## Test Layers

### 1. Smoke checks
Fast checks that confirm the app is alive and wired correctly.
- Backend startup and `/health`
- OpenAPI docs availability
- Frontend production build
- Auth reachability from the UI

### 2. API integration checks
Validate each major backend module through HTTP or service-level scripts.
- Authentication
- Patients
- Appointments
- Doctors
- Products and inventory
- Invoices and payments
- Sales orders
- Suppliers and purchase flows
- Reports and dashboard totals
- Roles, users, audit logs, settings, and basic data

### 3. Data-flow checks
Validate that records move correctly across modules.
- Patient -> appointment -> prescription -> invoice
- Product -> stock movement -> invoice -> inventory reduction
- Sales order -> fulfillment -> invoice/payment tracking
- Supplier purchase -> stock receipt -> inventory update

### 4. UI checks
Validate the key frontend pages against the backend.
- Login, forgot password, signup
- Dashboard
- Patients, appointments, doctors
- Products, inventory movements, stock adjustments, stock receipts
- Invoices, payments, refunds, transactions, ledger
- Purchase orders, supplier invoices, supplier payments, suppliers
- Sales orders, reports, activity logs, roles/permissions, clinic settings

### 5. Regression checks
Protect the platform from breaking when features change.
- Backend pytest suite
- Frontend TypeScript compile
- Frontend lint
- Targeted test scripts for high-risk flows

## Recommended Execution Order

1. Start backend services and confirm `/health`.
2. Run backend pytest.
3. Run service-level smoke scripts for dashboard, invoices, and reports.
4. Run frontend `npm run build`.
5. Run frontend lint.
6. Manually exercise the core UI flows with seeded data.
7. Re-run the targeted smoke scripts after any fix.

## Feature Coverage Matrix

- Authentication: login, logout, current user, password reset.
- Patients: create, update, list, search, delete.
- Appointments: create, reschedule, filter, status changes.
- Doctors: profile management, specialization, active status.
- Products: CRUD, categories, stock fields, pricing.
- Inventory: movements, receipts, stock adjustments, low-stock alerts.
- Invoices: create, view, pay, refund, line items, totals.
- Payments: record payment, payment status, reconciliation.
- Prescriptions: create and link to patient/appointment.
- Reports: sales, inventory, patient, dashboard KPIs.
- Purchase orders: draft -> approved -> ordered -> received.
- Supplier invoices/payments: capture liabilities and settlement.
- Sales orders: optical measurements, tested-by, expected delivery, fulfillment flow.
- Users/Roles/Audit logs: access control and traceability.
- Company/profile/basic data: configuration and clinic identity.

## Current Validation Status

### Passing
- Backend pytest: 3 passed.
- Dashboard smoke script: passed.
- Invoice smoke script: passed.
- Reports smoke script: passed.

### Failing
- Frontend build: fails on `src/api/axios.ts` because `axios-retry` is not installed in the frontend node_modules and one callback parameter is implicitly `any`.
- Frontend lint: fails because there is no ESLint configuration file in `Frontend/`.

### Existing Risk Area
- Hosted auth was previously failing for demo credentials, so hosted end-to-end validation still depends on fixing production user seed or login data.

## Acceptance Criteria
The platform should be considered healthy when all of the following are true:
- Backend smoke and pytest checks pass.
- Frontend build passes.
- Frontend lint passes.
- Core authenticated flows work in both local and hosted environments.
- A seeded dataset exists that makes dashboard and report totals meaningful, not just technically non-empty.

## Short-Term Next Fixes
1. Restore the frontend `axios-retry` dependency and fix the strict TS error in `src/api/axios.ts`.
2. Add an ESLint config so the lint gate is executable.
3. Re-run hosted authentication and the UI smoke path once the frontend gate is green.
4. Add real pytest coverage for the API endpoints that are currently only covered by scripts.
