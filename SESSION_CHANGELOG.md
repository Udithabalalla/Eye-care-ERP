# Eye Care ERP — Session Changelog (2026-06-23)

## Summary of all changes made in this session

---

## 1. Fix: Sales Order Assistant crash on Lens step

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Problem:** Clicking the historical-lens toggle on step 3 caused a React `checkForNestedUpdates` crash ("Maximum update depth exceeded"). Root cause: Radix `<Checkbox>` uses `CheckboxPrimitive.Indicator` internally which uses `@radix-ui/react-presence`. When checked state toggled, the `usePresence` ref callback fired `setNode(node)` → useState update → `useLayoutEffect` chain dispatching `send("ANIMATION_END")` to a state machine. Combined with existing Radix Presence instances (SearchableLOV Popovers), this pushed React's 50-nested-commit limit.

**Fix:** Replaced all three historical-toggle `<Checkbox>` components (global SO toggle, frame step toggle, lens step toggle) with plain `<div role="checkbox">` elements using conditional `RiCheckLine` icon. Zero Radix internals, zero `usePresence`.

---

## 2. Fix: "Product not found in catalogue" when creating SO with historical frame/lens

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Problem:** Historical frames were submitted with `line_type: 'product'`. The backend's `sales_order_service.py` product path does a strict catalogue lookup and throws `NotFoundException` for unknown `product_id` values like `'HISTORICAL_FRAME'`.

**Fix:** Changed historical frames/lenses to use `line_type: 'frame'` and `line_type: 'lens'` respectively. These backend paths have graceful manual-entry fallbacks when the product_id is not found in the catalogue.

Also fixed: `saveDraftAndLeave` was checking `values.salesOrder.isOld` to detect historical items, but the per-step `isOld` flags on `frame`/`lens` are the correct source. Corrected to check `values.frame.isOld` / `values.lens.isOld`.

---

## 3. Feature: Reference-only mode for frame/lens steps

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Problem:** When a patient comes for a frame change, the employee records the existing lens info for reference — but $0 price (no charge). Previously there was no way to mark an item as reference-only.

**Implementation:**
- Added `isReference: boolean` field to both `frame` and `lens` zod schema objects (default `false`).
- When `isReference = true`, the price field is disabled and forced to `0`.
- A blue "Reference only — no charge" sub-toggle appears within the manual entry section of each step (amber historical toggle must be on first).
- Submitted items use sentinel `product_id: 'REF_FRAME'` or `'REF_LENS'` (distinguishable from `'HISTORICAL_FRAME'`/`'HISTORICAL_LENS'`).
- `mapDraftToFormValues` detects these sentinels when restoring drafts and sets `isReference: true`.
- Backend handles these gracefully via the `line_type: 'frame'`/`'lens'` fallback path.

---

## 4. Fix: Prescription expiry blocking invoice creation

**File:** `backend/app/services/invoice_service.py`

**Problem:** `invoice_service.py` called `is_prescription_valid(prescription.valid_until)` which raised `BadRequestException` when a prescription's `valid_until` date had passed.

**Business rule:** Prescriptions are never expired in this system — they are only renewed. There should be no expiry check.

**Fix:** Removed the expiry check block entirely. Left a one-line comment explaining why.

---

## 5. Feature: SO created date + time in order records table

**File:** `Frontend/src/pages/SalesOrders.tsx`

**Change:** Updated the `created_at` column cell renderer to show the date on the first line and the time (HH:MM) in a smaller secondary line below it, using `toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })`.

---

## 6. Feature: Order Type selector (Frame+Lens / Frame only / Lens only)

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Problem:** When a patient only needs a frame replacement, the lens step is irrelevant but was always shown. The user wanted a way to skip unused steps.

**Implementation:**
- Added `orderType: 'full' | 'frame-only' | 'lens-only'` local state (default `'full'`).
- Added `visibleSteps` useMemo that filters `STEPS` based on `orderType`:
  - `frame-only` → hides step 3 (Lens)
  - `lens-only` → hides step 2 (Frame)
- Added `nextStep(current)` / `prevStep(current)` helper functions that navigate within visible steps only.
- `handleNext` and `handleBack` now use these helpers instead of `prev ± 1`.
- Updated `StepIndicator` to accept a `steps` prop instead of using the global `STEPS` constant, so it renders only visible steps. Step numbers are visual indices (1, 2, 3…) rather than raw IDs.
- A 3-pill selector ("Frame + Lens" / "Frame only" / "Lens only") was added to the Patient step (step 0) card, after the Sale Location section.
- In `onSubmit`: frame validation is skipped for `lens-only`; frame items are not added for `lens-only`; lens items are not added for `frame-only`.

---

## 7. Feature: Shared phone number support for household patients

**File:** `Frontend/src/components/sales-orders/SalesOrderIntakeForm.tsx`

**Problem:** Patients from the same household may share a phone number. The previous system hard-blocked SO creation if the typed phone number matched any existing patient, preventing legitimate household SOs.

**Implementation:**
- Replaced `freshMatchedPatient: Patient | null` state with `phoneMatches: Patient[]`.
- `handleNext` on step 0 now collects ALL patients whose phone matches (not just the first) using `results.filter(...)`.
- If matches exist, `showDuplicateDialog` opens with the full list.
- The duplicate dialog now maps over `phoneMatches` and shows each patient as a card with a "Use" button that links that patient to the form.
- A "New Patient (same number)" button lets staff proceed and save a new patient record sharing the phone (no block).
- Removed the `exactDuplicate` hard block from `onSubmit` entirely — the dialog is informational, not a gate.

---

## Sentinel product IDs used

| Sentinel | Meaning |
|---|---|
| `HISTORICAL_FRAME` | Manually entered frame from paper records (has a price) |
| `HISTORICAL_LENS` | Manually entered lens from paper records (has a price) |
| `REF_FRAME` | Reference-only frame (existing lens on a frame-change order, $0) |
| `REF_LENS` | Reference-only lens (existing frame on a lens-change order, $0) |

All four use `line_type: 'frame'` or `line_type: 'lens'` so the backend skips catalogue lookup and uses the manual fallback path.
