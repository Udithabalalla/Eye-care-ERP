# Optical ERP — Session History

> **Stack:** Python FastAPI · MongoDB · React 18 + TypeScript + shadcn/ui

---

## Session 1 — Core Optical Architecture (2026-05-23)

> **Scope:** Full transformation from generic ERP → Optical retail ERP

### Architecture Change

**Before:** Products were flat — one record per item (generic ERP pattern).

**After:** Frames are split into two layers:

```
FrameMaster (catalog, not stockable)
  └── FrameVariant (stockable, barcode-scannable)
        ├── color
        ├── eye_size
        ├── rim_type
        ├── sku  → auto-generated: BOS-1602-BLK-52-F
        ├── barcode → equals SKU (Code128)
        └── current_stock  ← only incremented/decremented atomically
```

The old `products` collection is **still live** and untouched. All new optical logic uses the new collections. Migration is additive — nothing was deleted.

### Backend Files Created

#### Models
| File | Purpose |
|---|---|
| `models/frame_master.py` | Catalog entity — brand, model, material, shape, rim, gender, images |
| `models/frame_variant.py` | Stockable entity — color, eye_size, rim_type, sku, barcode, prices, stock |
| `models/goods_receipt.py` | Formal GRN — expected vs received vs damaged per variant |
| `models/quick_intake.py` | Rapid intake draft — rows of (variant, qty, cost) |

#### Schemas / Repositories / Services
| File | Purpose |
|---|---|
| `schemas/frame_master.py` | Create / Update / Response schemas |
| `schemas/frame_variant.py` | Create / BulkCreate / Update / StockAdjust / Response schemas |
| `schemas/goods_receipt.py` | Create / Update / Response schemas |
| `schemas/quick_intake.py` | Create / Update / Response schemas (includes total_cost, total_qty) |
| `repositories/frame_master_repository.py` | list_masters, get_by_brand_model, get_distinct_brands |
| `repositories/frame_variant_repository.py` | increment_stock_atomic, decrement_stock_atomic, get_by_scan_code, get_stock_summary_for_master |
| `repositories/goods_receipt_repository.py` | get_next_grn_number (GRN-YYYY-NNNN) |
| `repositories/quick_intake_repository.py` | get_next_intake_number (QI-YYYY-NNNN), delete_draft |
| `services/sku_generator_service.py` | Deterministic SKU: `{BRAND3}-{MODEL}-{COLOR3}-{SIZE}-{RIM}`. 50+ color→3-char codes. Collision suffix. |
| `services/barcode_service.py` | `generate_barcode_png(sku)` → Code128 PNG. `generate_label_pdf()` → ReportLab PDF (frame_tag / shelf_label / sticker). |
| `services/frame_master_service.py` | CRUD + variant count + total stock summary |
| `services/frame_variant_service.py` | Single create, bulk create (color × size matrix), scan lookup, stock adjust |
| `services/goods_receipt_service.py` | create + commit (atomic stock increments per received − damaged) |
| `services/quick_intake_service.py` | draft create/update + commit (atomic increment all rows) |

#### API Routes Added
| Prefix | Key endpoints |
|---|---|
| `/frame-masters` | CRUD + `GET /brands` |
| `/frame-variants` | CRUD + `POST /bulk` + `GET /scan/{code}` + `GET /{id}/barcode` + `GET /{id}/label` + `POST /{id}/adjust-stock` |
| `/goods-receipts` | CRUD + `POST /{grn}/commit` |
| `/quick-intakes` | CRUD + `POST /{id}/commit` + `DELETE /{id}` (draft only) |

#### Backend Files Modified
| File | Change |
|---|---|
| `api/v1/router.py` | Added 4 new routers |
| `config/database.py` | Added indexes for frame_masters, frame_variants, goods_receipts, quick_intakes |
| `utils/constants.py` | Added: FrameMaterial, FrameShape, RimType, FrameGender, FrameCategory, StockMovementType, GoodsReceiptStatus, QuickIntakeStatus |

### Frontend Files Created

| File | Purpose |
|---|---|
| `types/frames.types.ts` | FrameMaster, FrameVariant, GoodsReceipt, QuickIntake interfaces + constants |
| `api/frames.api.ts` | 4 API clients: frameMastersApi, frameVariantsApi, goodsReceiptsApi, quickIntakesApi |
| `components/frames/StockBadge.tsx` | Green/amber/red stock level pill |
| `components/frames/BarcodeDisplay.tsx` | Fetches Code128 PNG, renders as `<img>` |
| `components/frames/VariantPicker.tsx` | Global reusable Popover picker with live search + barcode scan |
| `components/frames/SpreadsheetGrid.tsx` | Keyboard-first inline-edit grid (Tab=next, Ctrl+Enter=add row) |
| `pages/FrameMasters.tsx` | Frame catalog list with CRUD dialogs, brand/category filters |
| `pages/FrameVariants.tsx` | Compact inventory grid, barcode scan, stock-level filter cards |
| `pages/QuickIntake.tsx` | SpreadsheetGrid entry + draft + commit. Primary daily stock tool. |
| `pages/GoodsReceipts.tsx` | GRN list + create dialog. Per-line expected/received/damaged/extra qty. |

### Key Design Decisions

**SKU Format:** `BOS-1602-BLK-52-F` = `{brandme_3}-{model}-{color_3}-{size_mm}-{rim_code}`

**Stock Atomicity:** All changes via MongoDB `$inc`. `increment_stock_atomic` / `decrement_stock_atomic`.

**Commit Pattern:** draft → commit (atomic, idempotent). Committed records immutable.

**Barcode = SKU.** Scan endpoint tries: barcode → SKU → variant_id.

---

## Session 2 — Inventory Gap Fixes + Navigation Redesign (2026-05-23)

> **Scope:** Fix inventory gaps, complete the SO→stock flow, rebuild inventory pages, unify navigation

### Backend Fixes (staging branch)

#### `models/inventory_movement.py`
- Added `from typing import Optional`
- Changed `product_id: str` → `product_id: Optional[str] = None` (fixed startup NameError)

#### `services/inventory_movement_service.py`
- Added `RETURN` movement type handling: increments stock (same as `PURCHASE_IN`)
- Added `movement_type` filter param to `list_movements`

#### `repositories/inventory_movement_repository.py`
- Added `movement_type: Optional[str] = None` filter to `list_movements` query

#### `api/v1/inventory_movements.py`
- Added `movement_type: Optional[str] = None` query parameter
- Raised `page_size` limit to 500

#### `services/sales_order_service.py`
- Added SO cancellation stock reversal in `update_sales_order_status`:
  - Triggers when status → `CANCELLED` and previous status was not `DRAFT`
  - Guard: only runs if no invoice attached
  - Idempotency: checks for existing RETURN movements before creating
  - Creates `InventoryMovement(type=RETURN)` per frame-type line item, increments stock atomically

### Frontend Pages Created

#### `pages/StockAdjustments.tsx`
- `VariantPicker` to select a variant (shows current stock + delta preview)
- Absolute stock count input (backend sets to the value, not delta)
- Reason dropdown: Cycle count correction, Damaged goods write-off, Theft/loss, Supplier return, Opening stock entry, System error correction, Other
- Adjustment history table filtered to `movement_type: ADJUSTMENT`

#### `pages/InventoryMovements.tsx`
- Full audit log with server-side pagination (20/page)
- Filters: movement type (PURCHASE_IN / SALE_OUT / RETURN / ADJUSTMENT) + reference type
- +/− color coding per movement direction
- Shows `variant_id` or `product_id` in Item column

### Frontend Pages Modified

#### `pages/GoodsReceipts.tsx`
- Replaced plain PO ID input with `<Select>` populated from open POs (status=Ordered)
- PO options display: `{po.id} · {supplier_name}`
- "Load from PO" button calls `goodsReceiptsApi.prefillFromPo(poId)` to pre-fill items
- GRN list resolves `supplier_id` → supplier name via cached suppliers query

#### `api/frames.api.ts`
- Added `goodsReceiptsApi.prefillFromPo(poId)` → `GET /goods-receipts/prefill-from-po/{poId}`

#### `api/erp.api.ts`
- Added `movement_type?: string` param to `inventoryMovementsApi.getAll`

#### `types/erp.types.ts`
- Added `variant_id?: string` to `InventoryMovement` interface

### Navigation Redesign

#### Before (messy)
```
Frames (1 item — lonely section)
Operations: Quick Intake, Goods Receipts, Stock Adjustments, Inventory Movements
Clinical: Patients, Appointments, Prescriptions, Doctors, Products  ← Products buried here
```

#### After (logical)
```
Inventory:   Frames, Products, Goods Receipts, Quick Intake, Stock Adjustments, Movement History
Purchasing:  Suppliers, Purchase Orders, Stock Receipts, Supplier Invoices, Supplier Payments
Sales:       Sales Orders, Invoices, Payments, Refunds
Clinical:    Patients, Appointments, Prescriptions, Doctors
Finance:     Transactions, Ledger, Reports
System:      Users, Roles & Permissions, Activity Logs, Company Profile, Basic Data
```

**Icon fixes:** Suppliers → `RiBuilding2Line` (was same as Users), Transactions → `RiExchangeDollarLine` (was same as Payments), Prescriptions → `RiEyeLine` (optical context), Basic Data → `RiListSettingsLine`

**Label fix:** "Inventory Movements" → "Movement History" (clearer to non-technical staff)

---

## Session 3 — Frames Page Merge + PO UX + Quick Variant Creation (2026-05-23)

> **Scope:** Merge Frame Catalog + Frame Inventory into one page; improve PO line UX; enable inline variant creation

### `pages/FrameMasters.tsx` — Full Rewrite (merged page)

Replaced the separate Frame Catalog (`FrameMasters.tsx`) and Frame Inventory (`FrameVariants.tsx`) pages with a single expandable-row table.

**Top-level rows (FrameMaster):**
- Brand/Model, Category, Material, Gender, Rim, Variants count, Total Stock
- Click row → selects it (highlighted) + expands variant sub-rows
- Selection shows contextual action bar inline: **Add Variant** (primary), **Edit Model** (icon), **Delete Model** (icon)
- "click to manage" hint on unselected rows

**Nested variant rows (FrameVariant) — lazy loaded via `getForMaster`:**
- Color, Eye Size, Rim, SKU (monospace), StockBadge, Cost, Sell Price
- Hover reveals: Edit / Print Label / Delete actions
- Uses `VariantRows` sub-component — mounted only when expanded, fetches its own query

**Removed:** Separate `/frame-variants` route and `FrameVariants.tsx` page. Sidebar reduced to single "Frames" entry.

**Stats cards:** Frame Models count, Brands count, Total Variants count.

### `types/supplier.types.ts`

- Extended `PurchaseOrderAssistantItem`: added `product_id?: string`, `frame_variant_id?: string`, `item_type: 'product' | 'frame_variant'`
- Updated `PurchaseOrderFormItem`: made `product_id` optional, added `frame_variant_id?` and `item_type?`
- Added `frame_variant_id?: string` to `PurchaseOrderItem`

### `components/purchase-orders/CreatePurchaseOrderAssistant.tsx` — Full Rewrite

Replaced cramped 3-button layout + separate variant modal with inline per-line design:

- **`DraftItem` type:** extends `PurchaseOrderAssistantItem` with `_key: string` (UUID, stable React key) and `variantObj?: FrameVariant` (display state, stripped from payload)
- **Per-line type toggle** `[Variant | Product]` — resets all item fields on type switch
- **Inline `VariantPicker`** per variant line — it's a Popover, no modal needed
- **`+ New` button** on variant lines → opens `QuickAddVariantDialog`
- **`+ New` button** on product lines → opens `AddProductAssistant` (existing)
- **6-column grid layout:** `[120px_1fr_80px_110px_90px_36px]` = type | picker | qty | cost | subtotal | delete
- Description field on second row (below main row, indented)
- `save()` correctly omits `_key` and `variantObj` from payload; conditionally spreads `product_id`/`frame_variant_id`

### `components/frames/QuickAddVariantDialog.tsx` — New Component

2-step dialog for creating a frame variant inline without leaving the current screen.

**Step 1 — Select Frame Model:**
- Searchable list of existing masters (brand/model/category/variant count)
- "Create new frame model" button → Step 2a

**Step 2a — New Frame Model form (if needed):**
- Fields: brand, model code, frame name, category, gender, material
- On submit: creates master, proceeds directly to step 2b

**Step 2b — New Variant form:**
- Fields: color, eye size, rim type, bridge size, cost price, selling price, opening stock, reorder level
- On submit: creates variant, calls `onCreated(variant)` which auto-fills the PO line

**Props:** `open`, `onClose`, `onCreated: (v: FrameVariant) => void`, `lockedMasterId?: string`

---

## Session 4 — Hybrid Inventory Architecture (2026-05-24)

> **Scope:** Redesign inventory UX into a workflow-driven hybrid architecture. Frontend-only — backend unchanged.

### New Pages Created

| File | Route | Replaces |
|---|---|---|
| `pages/inventory/FramesWorkspace.tsx` | `/inventory/frames` | FrameMasters + drawers for receive/adjust/print/history |
| `pages/inventory/GeneralInventory.tsx` | `/inventory/general` | Products page |
| `pages/inventory/ReceivingWorkspace.tsx` | `/inventory/receiving` | GoodsReceipts + QuickIntake merged into tabs |
| `pages/inventory/MovementsLog.tsx` | `/inventory/movements` | InventoryMovements |
| `pages/inventory/AdjustmentsWorkspace.tsx` | `/inventory/adjustments` | StockAdjustments |

### New Drawer Components Created

| File | Purpose |
|---|---|
| `components/inventory/ReceiveStockDrawer.tsx` | Inline receive stock — creates + commits a Quick Intake in one step |
| `components/inventory/AdjustStockDrawer.tsx` | Inline stock adjustment with reason |
| `components/inventory/PrintBarcodeDrawer.tsx` | Label format picker + barcode preview + PDF open |
| `components/inventory/VariantHistoryDrawer.tsx` | Shows all movements for a specific variant |

### Key UX Changes

**Frames workspace:** Hover over a variant row to reveal 4 inline action buttons (Receive, Adjust, Print, History). Each opens a 480px side drawer — no page navigation required. Added a "Low Stock" stat card.

**Receiving:** GoodsReceipts and QuickIntake are now two tabs on one page (`/inventory/receiving`). GRN tab + Quick Intake tab. Same functionality, unified entry point.

**General Inventory:** Products page moved under `/inventory/general`. Hover-reveal action buttons (Edit, Adjust, Print).

**Sidebar restructured:** Operations section removed. New `INVENTORY` section with 5 entries. Products removed from Clinical. Purchasing moved before Sales.

### Old Routes → Redirects

All old routes redirect to new ones so bookmarks and external links still work:
- `/frame-masters` → `/inventory/frames`
- `/frame-variants` → `/inventory/frames`
- `/goods-receipts` → `/inventory/receiving`
- `/quick-intake` → `/inventory/receiving`
- `/stock-adjustments` → `/inventory/adjustments`
- `/inventory-movements` → `/inventory/movements`
- `/products` → `/inventory/general`

### Icon Fixes Applied

- Suppliers: `RiBuilding2Line` (was `RiTeamLine` — same as Users)
- Transactions: `RiExchangeDollarLine` (was `RiMoneyDollarCircleLine` — same as Payments)
- Prescriptions: `RiEyeLine` (optical context)
- Basic Data: `RiListSettingsLine`
- Adjustments: `RiEqualizer2Line`

---

## Current Sidebar Structure

```
Dashboard

INVENTORY
  Frames              /inventory/frames       — expandable model→variant table + 4 inline drawers
  General Inventory   /inventory/general      — flat product inventory (contact lenses, drops, accessories)
  Receiving           /inventory/receiving    — tabbed: PO Receiving (GRN) | Quick Intake
  Stock Movements     /inventory/movements    — full audit log
  Adjustments         /inventory/adjustments  — manual absolute stock corrections

PURCHASING
  Suppliers           /suppliers
  Purchase Orders     /purchase-orders        — includes inline VariantPicker per line
  Stock Receipts      /stock-receipts
  Supplier Invoices   /supplier-invoices
  Supplier Payments   /supplier-payments

SALES
  Sales Orders        /sales-orders           — cancellation reverses stock (RETURN movement)
  Invoices            /invoices
  Payments            /payments
  Refunds             /refunds

CLINICAL
  Patients            /patients
  Appointments        /appointments
  Prescriptions       /prescriptions
  Doctors             /doctors

FINANCE
  Transactions        /transactions
  Ledger              /ledger
  Reports             /reports

SYSTEM
  Users               /users
  Roles & Permissions /roles-permissions
  Activity Logs       /activity-logs
  Company Profile     /settings
  Basic Data          /basic-data  (sub-menu: Other Expenses, Lenses, Product Categories, Price Rules)
```

---

## Inventory Movement Types

| Type | Trigger | Stock Effect |
|---|---|---|
| `PURCHASE_IN` | GRN commit / Quick Intake commit | +qty (atomic increment) |
| `SALE_OUT` | SO transitions from DRAFT → any active status | −qty (atomic decrement) |
| `RETURN` | SO cancelled (no invoice) | +qty (atomic increment) |
| `ADJUSTMENT` | Stock Adjustments page (absolute value) | ±delta |

All movements stored in `inventory_movements` collection with `variant_id`, `product_id`, `reference_type`, `reference_id`, `created_by`, `created_at`.

---

## Key Architectural Rules

1. **Stock is always atomic** — `$inc` only, never read-then-write.
2. **Draft → Commit** — GRNs and Quick Intakes are editable until committed. Committed records are immutable.
3. **RETURN is idempotent** — cancellation logic checks for existing RETURN movements before creating new ones.
4. **Barcode = SKU** — scan endpoint resolves: barcode → SKU → variant_id.
5. **Products collection untouched** — `/products` API and `Products.tsx` page still live. New optical logic is additive.
6. **`product_id` is optional on movements** — frame variant movements use `variant_id`; legacy product movements use `product_id`.

---

## Pending / Not Yet Implemented

1. **BulkVariantCreate UI** — backend `/frame-variants/bulk` exists; frontend color × size matrix UI missing
2. **Label print queue** — `BarcodeManager` page for multi-label PDF batches
3. **Sales Order optical workflow** — full optical status flow (frame_selected → lens_ordered → in_lab → ready → delivered)
4. **Migration script** — `scripts/migrate_products_to_variants.py` to convert legacy products → FrameMaster + FrameVariant
5. **Dashboard optical widgets** — low stock / out-of-stock counts for frame variants
6. **Product Categories — module scoping** — Basic Data → Product Categories should flag which categories apply to Frames vs General Inventory
7. **FrameMaster detail page** — `/frame-masters/:id` showing that model's variants + bulk create button
8. **Hybrid inventory architecture** — planned future redesign to unify Frames + General Inventory under a single stock engine with shared receiving, barcode, movement, and supplier workflows while keeping specialized Frames UI
