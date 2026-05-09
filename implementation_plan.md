# Sales Order / Invoice Separation Refactor

## Background

The system already has a **significant head start** — many of the requested modules already exist in some form. The goal is therefore a targeted **gap-fill + correctness refactor**, not a from-scratch build.

### What Already Exists ✅

| Layer | Already Done |
|---|---|
| Backend Models | `SalesOrderModel`, `InvoiceModel` (with `sales_order_id`), `PaymentModel`, `TransactionModel`, `InventoryMovementModel`, `AuditLogModel` |
| Backend Services | `SalesOrderService` (with `convert_to_invoice`), `InvoiceService` (with `record_payment`), `PaymentService` → `TransactionService` chain, `AuditService`, `InventoryMovementService` |
| Backend APIs | `/sales-orders`, `/invoices`, `/payments`, `/transactions`, `/inventory-movements`, `/audit-logs` all routed |
| Frontend Pages | `SalesOrders.tsx`, `Invoices.tsx`, `Payments.tsx`, `Transactions.tsx`, `InventoryMovements.tsx`, `ActivityLogs.tsx` all exist |
| Frontend API | `salesOrdersApi`, `paymentsApi`, `transactionsApi`, `inventoryMovementsApi`, `auditLogsApi` all in `erp.api.ts` |

---

## What Actually Needs to Be Done

### 🔴 Critical Issues

1. **`/sales-orders` route in `App.tsx` is a redirect to `/invoices`** — Sales Orders has no dedicated route, it's being masked.
2. **`Invoices.tsx` page header says "Sales Orders"** — confused UI, needs renaming/correction.
3. **`Invoices.tsx` create button says "Create Sales Order"** — wrong context.
4. **Sidebar `Sales > Sales Orders` points to `/invoices`** — should point to `/sales-orders`.
5. **Sales Order model is missing required fields**: `measurements`, `tested_by`, `expected_delivery_date`, `created_by` display in UI.
6. **`POST /invoices/{id}/payment` still exists** — must be deprecated/removed per the spec in favor of `POST /payments`.

### 🟡 Enhancement Gaps

7. **Sales Order → Invoice flow**: The convert-to-invoice endpoint requires `COMPLETED` status. The requirement says generate-invoice should be available — needs endpoint alias `POST /sales-orders/{id}/generate-invoice`.
8. **SalesOrderModel missing fields**: `measurements` (PD, fitting height), `tested_by`, `expected_delivery_date`.
9. **Payments page lacks "Create Payment" button** — should allow creating payments from the Payments page against any invoice.
10. **Invoice UI still contains `payment_method` in the create form** — should be removed, payments go via `/payments` API only.
11. **Sidebar structure** — needs "Invoices" separate from "Sales Orders" and "Inventory" link consolidation per spec.

---

## Proposed Changes

### Backend

---

#### [MODIFY] [sales_order.py model](file:///e:/Eye%20care%20ERP/backend/app/models/sales_order.py)
Add missing fields: `measurements` (optical data dict), `tested_by` (optional str), `expected_delivery_date` (optional datetime).

#### [MODIFY] [schemas/sales_order.py](file:///e:/Eye%20care%20ERP/backend/app/schemas/sales_order.py)
- Add `measurements`, `tested_by`, `expected_delivery_date` to `SalesOrderCreate`, `SalesOrderUpdate`, `SalesOrderResponse`.
- Add `patient_name` to `SalesOrderResponse` (populated by service) for cleaner UI.

#### [MODIFY] [services/sales_order_service.py](file:///e:/Eye%20care%20ERP/backend/app/services/sales_order_service.py)
- Rename `convert_to_invoice` → keep it, plus add `generate_invoice` as an alias that works even when order is `confirmed` or later (softer requirement).
- Populate `patient_name` in `SalesOrderResponse`.
- Pass new fields (`measurements`, `tested_by`, `expected_delivery_date`) through create/update.

#### [MODIFY] [api/v1/sales_orders.py](file:///e:/Eye%20care%20ERP/backend/app/api/v1/sales_orders.py)
- Add `POST /{order_id}/generate-invoice` endpoint (maps to same service method, allowing confirmed+ status).

#### [MODIFY] [api/v1/invoices.py](file:///e:/Eye%20care%20ERP/backend/app/api/v1/invoices.py)
- **Deprecate** `POST /{invoice_id}/payment` — keep it but add a `deprecated=True` flag and a warning header so existing clients don't break, while directing new usage to `/payments`.

#### [MODIFY] [schemas/invoice.py](file:///e:/Eye%20care%20ERP/backend/app/schemas/invoice.py)
- Remove `payment_method` from `InvoiceCreate` (it's an operational field, not a financial document field).

---

### Frontend

---

#### [MODIFY] [App.tsx](file:///e:/Eye%20care%20ERP/Frontend/src/App.tsx)
- **Fix the redirect**: Change `/sales-orders` from a redirect to render `<SalesOrders />`.
- Add lazy import for `SalesOrders` component.

#### [MODIFY] [Sidebar.tsx](file:///e:/Eye%20care%20ERP/Frontend/src/components/common/Sidebar.tsx)
Per spec, update the navigation structure:
- `Sales Orders` → `/sales-orders`
- Add `Invoices` → `/invoices` (separate entry in Sales section)
- Keep Payments, add Refunds

#### [MODIFY] [Invoices.tsx](file:///e:/Eye%20care%20ERP/Frontend/src/pages/Invoices.tsx)
- Fix page header: "Sales Orders" → **"Invoices"**
- Fix button label: "Create Sales Order" → **"Create Invoice"**
- Fix search placeholder: "Search sales orders..." → **"Search invoices..."**
- Remove `payment_method` from create form (use PaymentModal only)
- Ensure the payment button routes to `POST /payments` API (already done via `PaymentModal` → `invoicesApi.recordPayment`) — verify and keep.

#### [MODIFY] [SalesOrders.tsx](file:///e:/Eye%20care%20ERP/Frontend/src/pages/SalesOrders.tsx)
- Add new fields to create/edit form: `expected_delivery_date`, `tested_by`, `measurements` (PD, fitting height, etc.) — optical staff-facing data.
- Update the "Convert to Invoice" button to call `generate-invoice` endpoint if order is not yet completed.
- Display patient name (not just ID) in the table using the patient lookup.

#### [MODIFY] [components/invoices/InvoiceForm.tsx](file:///e:/Eye%20care%20ERP/Frontend/src/components/invoices/InvoiceForm.tsx)
- Remove `payment_method` field from the invoice creation form — payments are handled post-invoice via the Payments flow.

#### [MODIFY] [Payments.tsx](file:///e:/Eye%20care%20ERP/Frontend/src/pages/Payments.tsx)
- Add a **"Record Payment"** button that opens a modal to create a payment against any invoice (using `POST /payments`).
- The modal should accept: invoice ID lookup, amount, payment method, date.

#### [NEW] [api/payments.api.ts](file:///e:/Eye%20care%20ERP/Frontend/src/api/payments.api.ts)
- Extract payments API into its own file with `create` method (currently missing — only `getAll` exists in `erp.api.ts`).

---

## Implementation Order

1. **Backend**: Add new fields to `SalesOrderModel` + schema + service
2. **Backend**: Add `generate-invoice` endpoint; deprecate `/invoices/{id}/payment`
3. **Frontend**: Fix `App.tsx` routing (unblock Sales Orders page)
4. **Frontend**: Fix `Sidebar.tsx` navigation structure
5. **Frontend**: Fix `Invoices.tsx` labels/UX
6. **Frontend**: Enhance `SalesOrders.tsx` with new fields
7. **Frontend**: Add create-payment to `Payments.tsx`
8. **Frontend**: Add `payments.api.ts`
9. **Git**: Checkout `staging` branch and commit all changes

---

## User Review Required

> [!IMPORTANT]
> The `convert-to-invoice` currently requires `COMPLETED` status. The spec says `generate-invoice` should work from a `confirmed` order onwards. This is a business rule change. I will implement `generate-invoice` allowing `confirmed` or later status (not draft/cancelled). **Please confirm this is the intended behaviour.**

> [!WARNING]
> The `POST /invoices/{id}/payment` endpoint will be **deprecated but kept** (not deleted) to avoid breaking any existing data or integrations. If you want it fully removed, please confirm.

> [!IMPORTANT]
> You are currently on the `apple-ui-changes` branch. All changes will be made on the **`staging`** branch as requested. The plan will checkout staging first.

---

## Verification Plan

### Automated
- Python: Confirm FastAPI app starts without import errors after model changes.
- Frontend: `npm run build` in the `Frontend/` directory to confirm TypeScript compiles cleanly.

### Manual
- Navigate to `/sales-orders` → should show the full SalesOrders page (not redirect to invoices).
- Navigate to `/invoices` → should show clean Invoice list titled "Invoices".
- Create a Sales Order → confirm new fields (measurements, tested_by, expected_delivery) appear.
- Click "Generate Invoice" from a Sales Order → confirm invoice is created and linked.
- Open Payments page → confirm "Record Payment" button opens modal and creates payment via `POST /payments`.
- Verify audit logs are created for each action.
- Push to staging and confirm CI passes.
