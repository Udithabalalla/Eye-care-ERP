# Optical ERP Refactor Ã¢â‚¬â€ Session Summary

> **Date:** 2026-05-23
> **Scope:** Full transformation from generic ERP Ã¢â€ â€™ Optical retail ERP
> **Stack:** Python FastAPI Ã‚Â· MongoDB Ã‚Â· React 18 + TypeScript + shadcn/ui

---

## What Was Built

This session implemented the **core architectural layer** of the optical ERP refactor Ã¢â‚¬â€ the 3-layer inventory model (Catalog Ã¢â€ â€™ Variant Ã¢â€ â€™ Transaction) plus four new operational modules.

---

## Architecture Change (The Core Idea)

**Before:** Products were flat Ã¢â‚¬â€ one record per item (generic ERP pattern).

**After:** Frames are split into two layers:

```
FrameMaster (catalog, not stockable)
  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ FrameVariant (stockable, barcode-scannable)
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ color
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ eye_size
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ rim_type
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ sku  Ã¢â€ â€™ auto-generated: BOS-1602-BLK-52-F
        Ã¢â€Å“Ã¢â€â‚¬Ã¢â€â‚¬ barcode Ã¢â€ â€™ equals SKU (Code128)
        Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ current_stock  Ã¢â€ Â only incremented/decremented atomically
```

The old `products` collection is **still live** and untouched. All new optical logic uses the new collections. Migration is additive Ã¢â‚¬â€ nothing was deleted.

---

## New Files Created

### Backend (`backend/app/`)

#### Models
| File | Purpose |
|---|---|
| `models/frame_master.py` | Catalog entity Ã¢â‚¬â€ brand, model, material, shape, rim, gender, images |
| `models/frame_variant.py` | Stockable entity Ã¢â‚¬â€ color, eye_size, rim_type, sku, barcode, prices, stock |
| `models/goods_receipt.py` | Formal GRN Ã¢â‚¬â€ expected vs received vs damaged per variant |
| `models/quick_intake.py` | Rapid intake draft Ã¢â‚¬â€ rows of (variant, qty, cost) |

#### Schemas
| File | Purpose |
|---|---|
| `schemas/frame_master.py` | Create / Update / Response schemas |
| `schemas/frame_variant.py` | Create / BulkCreate / Update / StockAdjust / Response schemas |
| `schemas/goods_receipt.py` | Create / Update / Response schemas |
| `schemas/quick_intake.py` | Create / Update / Response schemas (includes total_cost, total_qty) |

#### Repositories
| File | Key methods |
|---|---|
| `repositories/frame_master_repository.py` | list_masters, get_by_brand_model, get_distinct_brands |
| `repositories/frame_variant_repository.py` | increment_stock_atomic, decrement_stock_atomic, get_by_scan_code, get_stock_summary_for_master |
| `repositories/goods_receipt_repository.py` | get_next_grn_number (GRN-YYYY-NNNN) |
| `repositories/quick_intake_repository.py` | get_next_intake_number (QI-YYYY-NNNN), delete_draft |

#### Services
| File | Purpose |
|---|---|
| `services/sku_generator_service.py` | Deterministic SKU: `{BRAND3}-{MODEL}-{COLOR3}-{SIZE}-{RIM}`. Color name Ã¢â€ â€™ 3-char code lookup table. Handles collisions with numeric suffix. |
| `services/barcode_service.py` | `generate_barcode_png(sku)` Ã¢â€ â€™ Code128 PNG bytes. `generate_label_pdf(items, label_type)` Ã¢â€ â€™ ReportLab A4 sheet (frame_tag / shelf_label / sticker). |
| `services/frame_master_service.py` | CRUD + variant count + total stock summary |
| `services/frame_variant_service.py` | Single create, bulk create (color Ãƒâ€” size matrix), scan lookup, stock adjust |
| `services/goods_receipt_service.py` | create + commit (atomic stock increments per received qty - damaged qty) |
| `services/quick_intake_service.py` | draft create/update + commit (atomic increment all rows) |

#### API Routes
| File | Prefix | Key endpoints |
|---|---|---|
| `api/v1/frame_masters.py` | `/frame-masters` | CRUD + `GET /brands` |
| `api/v1/frame_variants.py` | `/frame-variants` | CRUD + `POST /bulk` + `GET /scan/{code}` + `GET /{id}/barcode` + `GET /{id}/label` |
| `api/v1/goods_receipts.py` | `/goods-receipts` | CRUD + `POST /{grn}/commit` |
| `api/v1/quick_intakes.py` | `/quick-intakes` | CRUD + `POST /{id}/commit` + `DELETE /{id}` (draft only) |

#### Modified Files
| File | Change |
|---|---|
| `api/v1/router.py` | Added 4 new routers |
| `config/database.py` | Added indexes for frame_masters, frame_variants, goods_receipts, quick_intakes |
| `utils/constants.py` | Added: FrameMaterial, FrameShape, RimType, FrameGender, FrameCategory, StockMovementType, StockMovementRefType, GoodsReceiptStatus, QuickIntakeStatus, OpticalSalesOrderStatus |

---

### Frontend (`Frontend/src/`)

#### Types & API
| File | Purpose |
|---|---|
| `types/frames.types.ts` | All TypeScript interfaces: FrameMaster, FrameVariant, GoodsReceipt, QuickIntake, plus FRAME_MATERIALS/SHAPES/RIM_TYPES/GENDERS/CATEGORIES constants |
| `api/frames.api.ts` | 4 API clients: frameMastersApi, frameVariantsApi, goodsReceiptsApi, quickIntakesApi |

#### Shared Components (`components/frames/`)
| File | Purpose |
|---|---|
| `StockBadge.tsx` | Green/amber/red pill showing stock level. Props: `stock`, `reorderLevel`, `showCount`. |
| `BarcodeDisplay.tsx` | Fetches Code128 PNG from `/frame-variants/{id}/barcode` and renders as `<img>`. |
| `VariantPicker.tsx` | **Global reusable picker.** Popover with live search (debounced), barcode scanner trigger, clear button. Shows brand/model, color/size, StockBadge, price. Used everywhere a variant needs to be selected. |
| `SpreadsheetGrid.tsx` | **Keyboard-first inline-edit grid.** Tab = next cell, Ctrl+Enter = add row, hover = show duplicate/delete. Each row has VariantPicker + Qty + Cost Price. Auto-fills cost from selected variant. |

#### Pages
| File | Purpose |
|---|---|
| `pages/FrameMasters.tsx` | Frame catalog list. Create/edit via Dialog. Filters by brand + category. Shows variant_count + total_stock per model. |
| `pages/FrameVariants.tsx` | Compact inventory grid (h-9 rows). Barcode scan search. Filters: brand, color, rim, stock level. Inline print label. Stats cards click to filter by stock level. |
| `pages/QuickIntake.tsx` | **Primary daily tool.** SpreadsheetGrid entry + supplier picker + save draft + commit. History tab shows past intakes. |
| `pages/GoodsReceipts.tsx` | GRN list + create dialog. Per-line: expected/received/damaged/extra qty. Commit applies net stock. |

#### Modified Files
| File | Change |
|---|---|
| `App.tsx` | Added 4 lazy routes: `/frame-masters`, `/frame-variants`, `/quick-intake`, `/goods-receipts` |
| `components/common/Sidebar.tsx` | New **Frames** section (Frame Catalog, Frame Inventory) + **Operations** section (Quick Intake, Goods Receipts, Stock Adjustments) at the top. Removed old Inventory section redundancy. |

---

## Key Design Decisions

### SKU Format
`BOS-1602-BLK-52-F`
= `{brand_3chars}-{model}-{color_code_3chars}-{eye_size_mm}-{rim_code_1char}`
- Color codes: 50+ colors mapped (blackÃ¢â€ â€™BLK, goldÃ¢â€ â€™GLD, tortoiseÃ¢â€ â€™TRT, etc.)
- Rim codes: fullÃ¢â€ â€™F, halfÃ¢â€ â€™H, rimlessÃ¢â€ â€™R
- Collision handling: appends `-2`, `-3`, etc.

### Stock Atomicity
All stock changes use MongoDB `$inc` (atomic). No read-then-write. Two operations supported:
- `increment_stock_atomic(variant_id, qty)` Ã¢â‚¬â€ for intake/receipt
- `decrement_stock_atomic(variant_id, qty)` Ã¢â‚¬â€ for sales, only succeeds if sufficient stock

### Commit Pattern
Both QuickIntake and GoodsReceipt use a **draft Ã¢â€ â€™ commit** workflow:
- Draft: editable, no stock impact
- Commit: atomic stock updates, idempotency guard via status field
- Committed records cannot be edited or deleted

### Barcode = SKU
Every variant's barcode field is set equal to its SKU. No separate barcode generation step needed. The backend `GET /frame-variants/scan/{code}` endpoint tries: barcode Ã¢â€ â€™ SKU Ã¢â€ â€™ variant_id.

---

## What Is NOT Done Yet (Next Session)

These were designed/documented but not implemented:

1. **BulkVariantCreate UI** Ã¢â‚¬â€ the backend `/frame-variants/bulk` endpoint exists; the frontend matrix UI (color Ãƒâ€” size checkboxes) is missing
2. **Label print queue** Ã¢â‚¬â€ `BarcodeManager` page for adding variants to a print queue and generating a multi-label PDF sheet
3. **Sales Order refactor** Ã¢â‚¬â€ optical workflow (pending Ã¢â€ â€™ frame_selected Ã¢â€ â€™ lens_ordered Ã¢â€ â€™ in_lab Ã¢â€ â€™ ready Ã¢â€ â€™ delivered), stock deduction on delivery
4. **GoodsReceipts commit button in list** Ã¢â‚¬â€ currently shows for status !== 'complete' but the newly created GRNs have status 'complete' by default; should be 'pending' until committed
5. **Stock Movements log** Ã¢â‚¬â€ `stock_movements` collection schema exists in design but the movement records are not yet being written to a dedicated collection (stock just increments on the variant)
6. **Migration script** Ã¢â‚¬â€ `scripts/migrate_products_to_variants.py` for converting old `products` records to FrameMaster + FrameVariant
7. **FrameMaster detail page** Ã¢â‚¬â€ `/frame-masters/:id` showing only that model's variants in a grid, with bulk create button
8. **Dashboard optical widgets** Ã¢â‚¬â€ low stock count, out-of-stock count for frame variants

---

## MongoDB Collections Added

```
frame_masters       Ã¢â‚¬â€ frame_master_id (unique), brand+model compound, text search
frame_variants      Ã¢â‚¬â€ variant_id (unique), sku (unique), barcode (unique), frame_master_id,
                      compound (frame_master_id+color+size+rim), text search, stock alert
goods_receipts      Ã¢â‚¬â€ grn_number (unique), supplier_id, receipt_date desc
quick_intakes       Ã¢â‚¬â€ intake_id (unique), status, supplier_id, intake_date desc
```

---

## API Endpoints Added

```
GET    /api/v1/frame-masters
POST   /api/v1/frame-masters
GET    /api/v1/frame-masters/brands
GET    /api/v1/frame-masters/{id}
PUT    /api/v1/frame-masters/{id}
DELETE /api/v1/frame-masters/{id}

GET    /api/v1/frame-variants
POST   /api/v1/frame-variants
POST   /api/v1/frame-variants/bulk
GET    /api/v1/frame-variants/colors
GET    /api/v1/frame-variants/scan/{code}       Ã¢â€ Â barcode/SKU scanner lookup
GET    /api/v1/frame-variants/master/{master_id}
GET    /api/v1/frame-variants/{id}
PUT    /api/v1/frame-variants/{id}
POST   /api/v1/frame-variants/{id}/adjust-stock
DELETE /api/v1/frame-variants/{id}
GET    /api/v1/frame-variants/{id}/barcode      Ã¢â€ Â returns PNG
GET    /api/v1/frame-variants/{id}/label        Ã¢â€ Â returns PDF

GET    /api/v1/goods-receipts
POST   /api/v1/goods-receipts
GET    /api/v1/goods-receipts/{grn}
PUT    /api/v1/goods-receipts/{grn}
POST   /api/v1/goods-receipts/{grn}/commit      Ã¢â€ Â atomic stock update

GET    /api/v1/quick-intakes
POST   /api/v1/quick-intakes
GET    /api/v1/quick-intakes/{id}
PUT    /api/v1/quick-intakes/{id}
POST   /api/v1/quick-intakes/{id}/commit        Ã¢â€ Â atomic stock update
DELETE /api/v1/quick-intakes/{id}               Ã¢â€ Â draft only
```

---

## Routes Added to Frontend

```
/frame-masters    Ã¢â€ â€™ FrameMasters page (catalog)
/frame-variants   Ã¢â€ â€™ FrameVariants page (inventory grid)
/quick-intake     Ã¢â€ â€™ QuickIntake page (daily stock entry)
/goods-receipts   Ã¢â€ â€™ GoodsReceipts page (formal GRN)
```

---

## Existing Code Left Unchanged

- `/products` API Ã¢â‚¬â€ still live, still used by old Products page
- `Products.tsx` page Ã¢â‚¬â€ still exists at `/products`
- All clinical modules (Patients, Appointments, Prescriptions, Doctors)
- All financial modules (Invoices, Payments, Ledger, Transactions)
- Suppliers, Purchase Orders, Supplier Invoices/Payments
- Auth, Users, Roles, Audit Logs, Dashboard, Reports
