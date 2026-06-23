# Eye Care ERP — Session Changelog (2026-06-23)

A reference document for the next Claude session covering all changes made to the codebase on this date.

---

## 1. Fix: Sales Order Assistant crash on Lens step (step 3)

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Root cause:** Radix `<Checkbox>` uses `CheckboxPrimitive.Indicator` which uses `@radix-ui/react-presence` (`usePresence` hook). When `checked` toggles false→true, the Indicator mounts and its ref callback fires `setNode(node)` → useState update → `useLayoutEffect` chain dispatching to a state machine. Combined with other Radix Presence instances already on the page (SearchableLOV Popovers), this cascades past React's 50-nested-commit limit and throws `checkForNestedUpdates`.

**Fix:** Replaced all three historical-toggle `<Checkbox>` components (global SO toggle, frame step toggle, lens step toggle) with plain `<div role="checkbox">` elements containing a conditional `<RiCheckLine />` icon. Zero Radix internals, zero `usePresence`.

**Rule going forward:** Do not use Radix `<Checkbox>` inside steps that already contain `SearchableLOV` (which uses Radix `Popover` + `Command`, both of which use `usePresence`). Use a plain styled div instead.

---

## 2. Fix: "Product not found in catalogue" when submitting an SO with historical frame/lens

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Root cause:** Historical frames were submitted as `line_type: 'product'`. The backend's `sales_order_service.py` product-path does a strict catalogue lookup and throws `NotFoundException` for unknown `product_id` values like `'HISTORICAL_FRAME'`.

**Fix:**
- Changed historical frames to `line_type: 'frame'` — this backend path has a graceful manual-entry fallback when `product_id` is not in the catalogue.
- Changed historical lenses to `line_type: 'lens'` — same fallback applies.
- Also fixed `saveDraftAndLeave`: it was checking `values.salesOrder.isOld` to detect historical items but the correct per-step flags are `values.frame.isOld` / `values.lens.isOld`.

---

## 3. Feature: Reference-only mode for frame and lens steps

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Business need:** When a patient comes for a frame-change only, staff record the existing lens details for reference at $0 (no charge). Previously there was no way to mark an item as reference-only inside the SO wizard.

**Implementation:**
- Added `isReference: boolean` (default `false`) to both `frame` and `lens` zod sub-schemas and `defaultValues`.
- When `isReference = true` on a step, the price field renders as disabled and the submitted price is forced to `0`.
- A blue "Reference only — no charge" sub-toggle appears inside the manual-entry section of each historical step (the amber historical toggle must be enabled first).
- `onSubmit` and `saveDraftAndLeave` use sentinel `product_id` values:
  - `'REF_FRAME'` / `'REF_LENS'` for reference items (price 0)
  - `'HISTORICAL_FRAME'` / `'HISTORICAL_LENS'` for priced historical items
- `mapDraftToFormValues` detects these sentinels when restoring a draft and sets `isReference: true` accordingly.
- The global historical toggle resets `isReference` to `false` when toggled off.

**Sentinel product ID table:**

| `product_id` | `line_type` | Meaning |
|---|---|---|
| `HISTORICAL_FRAME` | `frame` | Manually entered frame from paper records — has a price |
| `HISTORICAL_LENS` | `lens` | Manually entered lens from paper records — has a price |
| `REF_FRAME` | `frame` | Reference-only existing frame on a lens-change order — $0 |
| `REF_LENS` | `lens` | Reference-only existing lens on a frame-change order — $0 |

All four bypass the product catalogue via the `line_type: 'frame'` / `'lens'` backend paths.

---

## 4. Fix: Prescription expiry blocking invoice creation

**File:** `backend/app/services/invoice_service.py`

**Problem:** The service called `is_prescription_valid(prescription.valid_until)` and raised `BadRequestException` when a prescription had expired.

**Business rule:** Prescriptions are never expired in this system — they are only renewed by issuing a new one. There must be no expiry check on invoice creation.

**Fix:** Removed the check entirely. Left a comment at the call site: `# Prescriptions are not expired in this system — they are renewed. No expiry check.`

---

## 5. Feature: SO created date + time column in order records table

**File:** `Frontend/src/pages/SalesOrders.tsx`

**Change:** The `created_at` column now renders two lines:
- Line 1: formatted date (existing `formatDate()` helper)
- Line 2: time in HH:MM using `toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })` in a smaller `text-xs text-muted-foreground` span

---

## 6. Feature: Shared phone number support for household patients

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Business need:** Patients from the same household may share one phone number. The old system hard-blocked SO creation if the entered phone matched any existing patient — preventing legitimate household orders.

**Implementation:**
- Replaced `freshMatchedPatient: Patient | null` state with `phoneMatches: Patient[]`.
- `handleNext` on step 0 collects **all** patients whose phone digits match (not just the first) via `results.filter(...)`. Name-only matches still produce a single-item list.
- If `phoneMatches.length > 0`, `showDuplicateDialog` opens with the full list.
- The duplicate dialog maps over `phoneMatches`, showing each as a card with name + phone and a "Use" button that calls `handlePatientAction(patient)` to link that patient to the form, then advances to step 1.
- Dialog title adapts: "Existing patient found" for 1 match vs. "N patients share this phone number" for multiple.
- A "New Patient (same number)" button dismisses the dialog and advances to step 1 — a new patient record will be created sharing the phone number.
- Removed the `exactDuplicate` hard block from `onSubmit` entirely. The dialog is now informational only, not a submission gate.

---

## Key architectural notes for next session

### `SalesOrderIntakeForm.tsx` step structure
Steps are a static `const STEPS` array (IDs 0–6): Patient → Prescription → Frame → Lens → Expenses → Order Info → Review. All 7 steps are always shown. `handleNext` uses `Math.min(prev + 1, STEPS.length - 1)`, `handleBack` uses `Math.max(prev - 1, 0)`.

### Radix Checkbox ban in this form
Never use shadcn `<Checkbox>` (which wraps `CheckboxPrimitive.Indicator` / `usePresence`) in `SalesOrderIntakeForm`. Use `<div role="checkbox">` with a conditional `<RiCheckLine />` instead.

### Backend `line_type` routing
- `'product'` → strict catalogue lookup, throws if `product_id` not found
- `'frame'` → manual fallback when variant not found + `product_name` present
- `'lens'` → manual fallback when lens master not found
- `'expense'` / `'complimentary'` → no catalogue lookup

### What the user still wants to build (discussed but not yet implemented)
The user wants order-type tracking (Frame+Lens / Frame only / Lens only) reflected in order **statuses/display** — not in the SO wizard steps. This means tracking which components were ordered and showing appropriate status badges per component on the order detail / records pages. The SO wizard itself should remain unchanged (all steps always visible).
