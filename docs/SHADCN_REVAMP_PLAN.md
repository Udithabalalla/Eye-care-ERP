# shadcn/ui revamp plan: Eye Care ERP frontend

Status (2026-11-14): **Phases 0a–7 are done** and merged to `main` and `staging`; see "Progress" below.
Surveyed on `origin/main` at `3e44167`.

## Progress

| Phase | State |
|---|---|
| 0a Tailwind v3 compatibility | Done: tokens via `color-mix`, shadcn v4 variants in the config, `npm run check:tw` |
| 0b Dead code and packages | Done: 61 files and 6 packages removed |
| 1 Building blocks | Done: alert, toggle-group, radio-group, input-group, spinner, empty, kbd, input-otp, progress, sonner; status tokens; `useConfirm()` |
| 2 Front desk | Done |
| 3 Sales orders, billing, prescriptions | Done (status colours app-wide, all `common/Modal` users on `Dialog`) |
| 4 Inventory | Done |
| 5 Purchasing and suppliers | Done |
| 6 Finance, settings, admin, auth | Done |
| 7 Wrap-up | Done: legacy CSS, colour aliases, `common/{Button,Input,Modal}` and `tw-animate-css` removed; ESLint guards |

Follow-up (done): the adjust-stock, receive-stock, product-receive and create-PO drawers, the bulk-variant dialog
and the Lenses / Other expenses dialogs moved from `useState` to react-hook-form + zod.

Follow-up (done): `npm run lint` passes with 0 problems and now runs `npm run check:tw` too, so the ESLint
guards and the class check fail the lint step.

Left for later:
- Status configs, chart, avatar and category colours keep their categorical palettes on purpose.
- Dev data: duplicate invoice ids (`INV000001`, …) cause duplicate-key warnings in invoice pickers.

The original plan follows.
Scope: `Frontend/src` (React 18, Vite 5, Tailwind CSS 3.4.18). The rules come from `CLAUDE.md`:
shadcn first, RemixIcon only, react-hook-form + zod, shadcn `Dialog`, `DataTable` / shadcn `Table`, `SearchableLOV`.

## 1. Summary

The migration is further along than the brief assumed. Nothing live imports the Untitled UI wrappers, the `@/components/ui` barrel no longer exists, and no live file uses `lucide-react`, `@untitledui/icons` or `react-aria-components`. Most remaining work is in four areas:

1. **Tailwind v3 can't read what the shadcn components are written in.** This is the biggest problem, and it's bigger than the `data-checked:` case:
   - About **430 opacity classes on theme colours** (`bg-primary/10`, `hover:bg-muted/50`, `border-border/60`, `ring-ring/30`) in **106 files** compile to nothing, because the colours are bare `var(--primary)`. That includes shadcn `table.tsx`'s own row hover.
   - The v4 variants `data-checked:`, `data-active:`, `data-horizontal:`, `data-placeholder:`, `aria-invalid:` and others also compile to nothing. In practice, a ticked `Checkbox` has no fill, the active `TabsTrigger` has no highlight, and a bare `<Separator />` (33 uses) has zero height.
2. **About 9,900 lines of dead code**: 62 files, including all of `components/ui/base`, `components/ui/application` and 8 old pages that now redirect. Delete it; don't migrate it.
3. **Leftover hand-rolled UI in live code**:
   - 73 raw `<button>` in 37 files
   - 8 `window.confirm()` calls
   - 100 native `title=` tooltips
   - 912 raw palette colour classes in 57 files
   - 20 forms or form-like screens kept in `useState`
   - 4 files on the `common/Button` and `common/Input` wrappers, and 9 on `common/Modal`
4. **Two installed components are in the old style**: `dropdown-menu.tsx` (new-york style, `@radix-ui/react-icons`) and `button.tsx` (`@radix-ui/react-slot` pulled in transitively).

Recommended order (section 6): a foundation PR for the Tailwind fixes, then a cleanup PR for dead code and dependencies, then shared building blocks, then six feature batches, highest traffic first.

## 2. How the numbers were produced

- **Live vs dead:** an import graph walked from `src/main.tsx`, following `@/` and relative imports, including `lazy(() => import(...))`. 218 live files, 62 dead.
- **Pattern counts:** regex scans over live files only. They're rough, but good enough to size PRs.
- **Tailwind:** I compiled the live sources with the project's own `tailwind.config.js` and Tailwind 3.4.18, then listed class tokens that produced no CSS. A scratch config confirmed the proposed fix in section 5 makes the missing classes compile.
- **Not checked:** I didn't open the app in a browser, didn't run `npm run lint`, and didn't run a build for this plan.

## 3. Inventory of legacy UI

### 3.1 Dead code: delete, don't migrate

Nothing reachable from `main.tsx` imports these files.

| Group | Files | Lines |
|---|---|---|
| Untitled UI wrappers: `components/ui/base/**`, `components/ui/application/**`, `components/ui/foundations/dot-icon.tsx` | 28 | ~3,800 |
| Old pages that now redirect (`App.tsx` routes them with `<Navigate>`): `FrameMasters`, `FrameVariants`, `GoodsReceipts`, `InventoryMovements`, `Products`, `QuickIntake`, `StockAdjustments`, `StockReceipts` | 8 | 2,633 |
| Orphaned components: `inventory/ManageSKUDrawer`, `PrintBarcodeDrawer`, `QuickPODrawer`, `QuickSellDrawer`; `invoices/InvoiceDetail`, `PaymentForm`, `PaymentModal`; `products/ProductForm`; `purchase-orders/CreateVariantDialog`; `suppliers/PurchaseOrderForm`, `ReceiveStockForm`; `frames/BarcodeDisplay`; `common/SearchBar`, `common/Table` | 14 | ~3,100 |
| Orphaned hooks, stores and utils: `use-breakpoint`, `use-resize-observer`, `useComplimentaryItems`, `store/{appointment,patient,product}Store`, `utils/{constants,cx,is-react-component,poSettings,validators}` | 11 | ~400 |
| `components/ui/scroll-area.tsx` (shadcn, unused) | 1 | 53 |

Keep `scroll-area.tsx`: it's a real shadcn component and will be used. Everything else can go once the user confirms none of it is planned work (decision D8). `QuickSellDrawer` and `ManageSKUDrawer` look like they might be.

**Dependencies that become removable:**

| Package | Why it can go |
|---|---|
| `lucide-react` | 0 importers |
| `@untitledui/icons` | Only the dead wrappers use it |
| `react-aria`, `react-aria-components` | Only the dead wrappers use them |
| `@radix-ui/react-icons`, `@radix-ui/react-dropdown-menu` | Only the old `dropdown-menu.tsx` uses them, and that file gets regenerated |

### 3.2 Barrel and icon imports

| Check | Live files |
|---|---|
| `from '@/components/ui'` (barrel) | 0. The barrel file is gone. |
| `lucide-react` | 0 |
| `@untitledui/icons` | 0 (dead code only) |
| `@radix-ui/react-icons` | 1: `components/ui/dropdown-menu.tsx` (`CheckIcon`, `ChevronRightIcon`, `DotFilledIcon`) |
| `react-aria` / `react-aria-components` | 0 (dead code only) |
| `@remixicon/react` | 118 files |

### 3.3 Legacy CSS classes (`globals.css` `@layer components`)

`.btn`, `.btn-primary/secondary/danger`, `.input`, `.label`, `.card`, `.table`, `.badge`, `.badge-success/warning/danger/info`

There are 3 live uses: 2 in `products/AddProductAssistant.tsx` (`<select className="input">`) and 1 in `dashboard/SalesTrendCard.tsx`. The rest are in dead files. Remove the CSS block once those 3 are gone.

### 3.4 Wrappers in `components/common`

| Wrapper | What it is | Live importers | Action |
|---|---|---|---|
| `common/Button` | Maps `primary`/`danger` to shadcn variants | `ClinicSettings`, `SupplierForm`, `ReceiveGoodsAssistant`, `AddProductAssistant` | Replace with `ui/button`, then delete |
| `common/Input` | shadcn `Input` with label and error | Same 4 files | Replace with `Form` / `Field`, then delete |
| `common/Modal` | Thin `Dialog` wrapper | `Doctors`, `SupplierForm`, `ReceiveGoodsAssistant`, `StockAdjustmentModal`, `ProductModal`, `PrescriptionModal`, `InvoiceModal`, `CreateSupplierInvoiceDialog`, `AppointmentModal` (9) | Inline `Dialog`, then delete (D9) |
| `common/Pagination` | shadcn `Button` + `Select` | 17 | Keep. `CLAUDE.md` names it. |
| `common/SearchableLOV` | `Popover` + `Command` | 8 | Keep |
| `common/DetailDrawer` | Shared drawer shell on shadcn `Sheet` | 6 detail sheets | Keep. Fix its 1 raw button and 12 raw colours. |
| `common/Loading` | Spinner with a full-screen `fixed inset-0` overlay | `App.tsx` Suspense fallback | Keep. Rebase on the shadcn `spinner`. |
| `common/QRScanner` | `fixed inset-0` overlay, raw button, `error-*` aliases | 1 | Move into a `Dialog` |

`cn` is defined twice: `@/lib/utils` (shadcn) and `@/utils/helpers` (19 importers). Make `helpers.cn` re-export from `lib/utils`.

### 3.5 Per-page / per-feature counts (live files)

Column key:
- **btn**: raw `<button>`
- **tbl**: raw `<table>`
- **useState**: `useState` calls
- **RHF**: uses `useForm`
- **pal**: raw palette colour classes (`text-emerald-600`, `bg-gray-100`, …)
- **title**: native `title=` tooltips
- **other**: anything else of note

Print documents (`InvoicePreview`, `PurchaseOrderPreview`, `AdvanceReceipt`) are left out on purpose. Raw tables and hex colours are correct for print.

| Feature | Files | btn | tbl | useState | RHF | pal | title | other |
|---|---|---|---|---|---|---|---|---|
| **App shell** | `Header`, `Sidebar`, `Layout`, `DetailDrawer`, `QRScanner`, `Loading` | 4 | 0 | 12 | – | 24 | some | 2 hand-rolled overlays |
| **Dashboard** | `Dashboard`, `KpiTile`, `SalesTrendCard`, `SalesMixCard` | 6 | 0 | 4 | – | 30 | 5 | 10 hex (chart colours), 1 legacy class |
| **Patients** | `Patients`, `PatientDetailSheet`, `PatientForm`, `PatientModal` | 6 | 0 | 10 | yes | 47 | 5 | list filters in `useState` |
| **Appointments** | `Appointments`, `AppointmentForm`, `AppointmentModal` | 7 | 0 | 10 | yes | 6 | 7 | `common/Modal` |
| **Sales orders** | `SalesOrders`, `SalesOrderIntakeForm` (3,252 lines), `SalesOrderDetailSheet`, `PaymentPanel`, `OrderSummaryPanel`, status config | 12 | 3 | 45 | yes (`register` + `Field`) | 209 | 18 | 5 native date inputs; status pills; `salesOrderStatusConfig` has 60 palette classes |
| **Invoices & payments** | `Invoices`, `InvoiceDetailSheet`, `InvoiceForm`, `InvoiceModal`, `Payments`, `Refunds`, `RecordPaymentDialog`, `PrescriptionSelectionModal` | 2 | 0 | 23 | partly | 4 | 4 | `Payments` form in `useState`; `common/Modal` |
| **Prescriptions** | `Prescriptions`, `PrescriptionForm`, `PrescriptionModal`, `PrescriptionDetail`, `EyeRxTable` | 1 | 2 | 9 | yes | 0 | – | Rx grid as raw `<table>`; `common/Modal` |
| **Inventory** | `FramesWorkspace` (857), `GeneralInventory`, `ReceivingWorkspace`, `LowStockReorder`, `MovementsLog`, `AdjustmentsWorkspace` | 2 | 0 | 62 | `FramesWorkspace` only | 28 | – | **8 `window.confirm()`**; 1 raw input |
| **Inventory drawers & dialogs** | `AdjustStockDrawer`, `CreatePODrawer`, `ProductReceiveDrawer`, `ReceiveStockDrawer`, `VariantHistoryDrawer`, `BulkLabelDialog`, `BulkVariantDialog`, `QuickAddVariantDialog`, `VariantPicker`, `FrameModelDrawer`, `SpreadsheetGrid`, `StockAdjustmentModal`, `ProductModal`, `AddProductAssistant` | 7 | 0 | ~45 | 2 of 14 | 28 | 20 | 6 forms in `useState`; native `<select>` and `.input`; `common/*` |
| **Purchasing** | `PurchaseOrders`, `PurchaseOrderCreate`, `PurchaseOrderWizard` (1,079), `PurchaseOrderDetailSheet`, `ReceiveGoodsDialog`, `ReceiveGoodsAssistant`, `SendPurchaseOrderDialog`, `RecordSupplierPaymentDialog`, `ProductPicker`, status config | 15 | 0 | 37 | mostly | 91 | 10 | `common/*` in `ReceiveGoodsAssistant`; `purchaseOrderStatusConfig` has 36 palette classes |
| **Suppliers & supplier invoices** | `Suppliers`, `SupplierForm`, `SupplierInvoices`, `SupplierInvoiceDetailSheet`, `AddSupplierInvoiceDialog`, `CreateSupplierInvoiceDialog`, `SupplierPayments` | 7 | 0 | 26 | partly | 42 | 3 | `SupplierForm` on `common/Modal` / `Input` / `Button`; `CreateSupplierInvoiceDialog` in `useState` |
| **Finance & reports** | `Transactions`, `Ledger`, `Reports`, `ActivityLogs` | 0 | 0 | ~16 | – | 112 | – | `Transactions` / `Ledger` are mostly palette colours for debit/credit |
| **Settings & basic data** | `SettingsHub`, `ClinicSettings`, `Lenses`, `OtherExpenses`, `ProductCategories`, `ComplimentaryItems` | 1 | 0 | 17 | 2 of 6 | 2 | – | `ClinicSettings` on `common/Button` / `Input`; `Lenses` / `OtherExpenses` dialogs in `useState`; 10 hex colours in `ProductCategories` |
| **Admin** | `Users`, `RolesPermissions`, `Sessions`, `UserFormDialog`, `UserPermissionsDialog`, `ResetPasswordDialog`, `PermissionGrid` | 2 | 0 | 12 | yes | 1 | 2 | – |
| **Auth** | `Login`, `Signup`, `ForgotPassword`, `ChangePasswordForm`, `ForcePasswordChange` | 0 | 0 | 10 | 3 of 4 | 3 | – | `Login` in `useState` (uses `Field`); 6-digit codes as plain `Input` (fits `input-otp`) |

**Cross-cutting counts (live code):**

| Pattern | Count | Files | shadcn replacement |
|---|---|---|---|
| Opacity on theme colours (`bg-primary/10`, …) that never compiles | 430 | 106 | Fix the Tailwind config (section 5); no source change needed |
| `window.confirm()` | 8 | 3 (`FramesWorkspace`, `GeneralInventory`, `ReceivingWorkspace`) | `AlertDialog` through a shared `useConfirm()` |
| Native `title=` tooltips | 100 | 38 | `Tooltip` for icon-only buttons; keep `title` on truncated text (D7) |
| Search or field icons positioned by hand (`absolute left-3 top-1/2`) | 34 | 23 | `input-group` |
| Spinners (`RiLoader4Line animate-spin`) | 80 | 31 | `spinner` |
| Native `<input type="date">` | 27 | 16 | Optional `DatePicker` on `Calendar` + `Popover` (D4) |
| Hand-made amber or red notice boxes | ~26 | 15 | `alert` |
| Segmented choices (`aria-pressed` / `role=radio` buttons) | 9 | 5 | `toggle-group` / `radio-group` |
| "No X found / yet" empty states | 24 | 21 | `empty` |
| `react-hot-toast` | 58 files | 58 | Keep, or switch to shadcn `sonner` (D3) |
| `brand-*`, `success-*`, `warning-*`, `error-*` alias classes | 23 | 5 | Semantic tokens (D6); then drop the aliases |

Note on the aliases in `tailwind.config.js`: `success` maps to `--chart-2` and `warning` to `--chart-4`. Both are blues in this theme, so `text-success-600` renders blue, not green.

### 3.6 Hand-rolled modals, dropdowns and tooltips

- **Modals:** no live `fixed inset-0` dialogs except `Loading` (full-screen fallback, fine) and `QRScanner` (move into `Dialog`). Every other modal already goes through `Dialog`, `Sheet` or `common/Modal`.
- **Dropdowns:** none hand-rolled. 24 files use `DropdownMenu`, which becomes radix-mira when `dropdown-menu.tsx` is regenerated.
- **Tooltips:** only 3 files use shadcn `Tooltip`. The 100 native `title=` attributes are the tooltip gap.

## 4. shadcn components

### 4.1 Installed (`src/components/ui/`)

`alert-dialog`, `avatar`, `badge`, `button` (+ `buttonVariants.ts`), `button-group`, `calendar`, `card`, `chart`, `checkbox`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `field`, `form`, `input`, `label`, `popover`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `switch`, `table`, `tabs`, `textarea`, `tooltip`

**Needing attention:**

| File | Problem |
|---|---|
| `dropdown-menu.tsx` | Old new-york style (no `data-slot`, `@radix-ui/react-icons`, `@radix-ui/react-dropdown-menu`). Regenerate in radix-mira. |
| `button.tsx` | Imports `Slot` from `@radix-ui/react-slot`, which isn't a direct dependency and is only present transitively. Switch to `Slot` from `radix-ui`. |
| `sheet.tsx`, `dialog.tsx`, `input.tsx`, `textarea.tsx`, `button.tsx`, `sidebar.tsx`, `alert-dialog.tsx` | **Customised locally.** `sheet.tsx` has pin and resize (commit `aecbae7`); `input` and `textarea` have `forwardRef` for react-hook-form (`2e2e873`). Never run `shadcn add --overwrite` on these. Diff by hand. |
| `calendar.tsx` | Installed, 0 uses |

### 4.2 To add

Run from `Frontend/`. The style and base colour come from `components.json` (`radix-mira`, `mist`).

| Component | Command | Needed for |
|---|---|---|
| alert | `npx shadcn@latest add alert` | ~26 hand-made notice boxes, `ErrorBoundary`, wizard callouts |
| toggle-group (pulls in toggle) | `npx shadcn@latest add toggle-group` | Status filter pills on `SalesOrders`, `PurchaseOrders`, `SupplierInvoices`; segmented choices in the SO wizard, `PaymentPanel`, `FramesWorkspace` |
| radio-group | `npx shadcn@latest add radio-group` | Single-choice option cards (`DoctorForm`, payment method) |
| input-group | `npx shadcn@latest add input-group` | 34 inputs with icons positioned by hand (search boxes, currency prefixes) |
| spinner | `npx shadcn@latest add spinner` | 80 hand-rolled spinners, `common/Loading` |
| empty | `npx shadcn@latest add empty` | 24 empty states |
| input-otp | `npx shadcn@latest add input-otp` | 6-digit codes in `Signup` and `ForgotPassword` |
| kbd | `npx shadcn@latest add kbd` | Keyboard hints (2 raw `<kbd>`; also used by `tooltip.tsx`) |
| progress | `npx shadcn@latest add progress` | Dashboard bars, receiving progress |
| sonner | `npx shadcn@latest add sonner` | Only if D3 = switch |
| dropdown-menu (regenerate) | `npx shadcn@latest add dropdown-menu --overwrite` | Replaces the old-style file (not customised; safe to overwrite) |

Not needed now: `accordion` (`collapsible` covers the 3 uses), `breadcrumb`, `hover-card`, `drawer` (`sheet` is used), `pagination` (`common/Pagination` stays per `CLAUDE.md`), `native-select` (use `Select` / `SearchableLOV`).

### 4.3 After every `shadcn add`: checklist

1. If the generated code has `import { cn } from "cn"`, change it to `@/lib/utils`. If `package.json` / `package-lock.json` gained a `cn` package (or anything else unasked), revert it.
2. Revert any edits the CLI made to `globals.css` or `tailwind.config.js` (it can append v4-style `@theme` or variables).
3. Check icons are `@remixicon/react` (`components.json` has `iconLibrary: remixicon`).
4. React 18: generated components are written for React 19 (plain function components that take `ref` as a prop). Wrap them in `React.forwardRef` if they receive a react-hook-form `ref` (`register`, `field.ref`) or sit under a Radix `asChild` / `FormControl` Slot. Otherwise focus-on-error and trigger positioning break silently.
5. Run the Tailwind class check (section 5.3) and fix whatever it flags.

## 5. Tailwind v3 compatibility

### 5.1 What's broken today

The shadcn radix-mira components are written for Tailwind v4. `globals.css` imports `shadcn/tailwind.css` and `tw-animate-css`, but both are v4 files (`@custom-variant`, `@theme`, `@utility`), so under v3 those rules do nothing. Only `data-open` / `data-closed` are mapped, in `tailwind.config.js`. The compile check found:

| Class group | Example | Where | Visible effect |
|---|---|---|---|
| Opacity on theme colours | `bg-primary/10`, `hover:bg-muted/50`, `border-border/60`, `ring-ring/30` | 430 uses, 106 files; also inside `table.tsx`, `badge.tsx`, `buttonVariants.ts`, `field.tsx` | Tints, hover states and soft borders missing everywhere |
| `data-checked:` / `data-unchecked:` | `data-checked:bg-primary` | `checkbox.tsx`, `field.tsx` | **A ticked checkbox gets no fill**; only the tick icon shows |
| `data-active:` | `data-active:bg-background` | `tabs.tsx` | Active tab not highlighted |
| `data-horizontal:` / `data-vertical:` | `data-horizontal:h-px` | `separator.tsx`, `button-group.tsx`, `tabs.tsx` | **A bare `<Separator />` is 0px tall** (33 uses); tab list height wrong |
| `data-placeholder:` / `data-disabled:` | `data-placeholder:text-muted-foreground` | `select.tsx` | Select placeholder in full text colour; disabled items look enabled |
| `aria-invalid:` | `aria-invalid:border-destructive` | `input`, `select`, `checkbox`, `switch`, `badge`, `buttonVariants` | No red border on invalid fields |
| `has-data-[…]:`, `group-has-data-[…]:`, `in-data-[…]:`, `not-data-[…]:`, `group-data-horizontal/…:` | `has-data-[icon=inline-start]:pl-2` | `buttonVariants`, `badge`, `tabs`, `card`, `avatar`, `calendar`, `alert-dialog`, `select` | Icon padding in buttons, card header grid, avatar group sizes |
| v4 value syntax | `h-(--cell-size)`, `origin-(--radix-…)`, `py-[calc(--spacing(1.25))]` | `calendar`, `select`, `popover`, `tooltip`, `chart`, `tabs` | Calendar cell sizes, select popper width and height, animation origin |
| v4-only variants | `**:`, `*:[a]:`, `@md/field-group:`, `nth-last-2:`, `supports-backdrop-filter:` | `select`, `tooltip`, `dialog`, `card`, `field` | Minor styling |
| v4 renames | `shadow-xs`, `outline-hidden`, `backdrop-blur-xs`, `underline-offset-3` | `buttonVariants`, `input`, `textarea`, `popover`, `select`, `dialog` | Missing shadow and outline reset |

### 5.2 Decision: add the variants to the config, don't rewrite classes

Rewriting `data-checked:` as `data-[state=checked]:` by hand (as `switch.tsx` did) works. But every future `shadcn add` would then need the same hand edits, and anyone who forgets ships a broken control. A config shim fixes all existing and future components at once, and `switch.tsx` keeps working either way. Recommended changes to `tailwind.config.js`:

1. **Opacity on theme colours.** Define each token colour with `color-mix` so Tailwind can apply alpha:
   ```js
   const token = (v) => `color-mix(in oklab, var(${v}) calc(<alpha-value> * 100%), transparent)`
   // colors: { primary: { DEFAULT: token('--primary'), foreground: token('--primary-foreground') }, border: token('--border'), ... }
   ```
   Verified with Tailwind 3.4.18: `bg-primary/10` compiles to `color-mix(in oklab, var(--primary) calc(0.1 * 100%), transparent)`, and plain `bg-primary` still compiles to full colour. This needs Chrome or Edge 111+, Safari 16.2+ or Firefox 113+ (D2).
2. **The shadcn custom variants.** Copy them from `node_modules/shadcn/dist/tailwind.css` into the existing plugin with `addVariant`: `data-checked`, `data-unchecked`, `data-selected`, `data-disabled`, `data-active`, `data-horizontal`, `data-vertical`, `data-placeholder` (plus the `data-open` / `data-closed` already there). Each maps to both `[data-state=…]` and `[data-…]`, exactly as shadcn defines them. Also add `aria-invalid` → `&[aria-invalid="true"]`. Verified: `data-checked:bg-primary` and `aria-invalid:ring-2` compile with this.
3. **Compound variants** via `matchVariant`: `has-data-[…]` → `&:has([data-…])`, `group-has-data-[…]/name`, `in-data-[…]` → `:where([data-…]) &`, `not-data-[…]` → `&:not([data-…])`, and `group-data-horizontal/tabs` / `group-data-vertical/tabs`.
4. **Theme additions:** `boxShadow.xs`, `backdropBlur.xs`, `textUnderlineOffset['3']`, and an `outline-hidden` utility (`outline: 2px solid transparent; outline-offset: 2px`).
5. **What a config can't express.** Rewrite these few in the generated files:
   - `x-(--var)` → `x-[var(--var)]`
   - `--spacing(1.25)` → `0.3125rem`
   - `**:` → `[&_*]:`
   - `*:[a]:` → `[&>a]:`
   - `nth-last-2:` → `[&:nth-last-child(2)]:`
   - `supports-backdrop-filter:` → `supports-[backdrop-filter]:`
   - `@md/field-group:` → `md:` (or add the official `@tailwindcss/container-queries` plugin)

The alternative is to upgrade to Tailwind v4 (D1). That removes the shim entirely and makes `shadcn add` output work as generated. But it touches every page at once (default ring width, `space-*` selectors, hover applying only on devices that can hover, the colour aliases, `@apply` in `globals.css`). Don't do it in the same PR as the shim.

### 5.3 Guard against regressions

Add `Frontend/scripts/check-tw-classes.mjs`, wired into `npm run lint`. It compiles `src/**` with the real config and fails if a `className` token with a variant or opacity modifier produces no CSS. (A prototype of this check produced the table above. It needs an allow-list for false positives such as `HH:mm` and CSS-in-JS strings.) Also add ESLint `no-restricted-imports` for `lucide-react`, `@untitledui/icons`, `@radix-ui/react-icons`, `react-aria*`, `@/components/ui` (barrel), `@/components/common/{Button,Input,Modal}`, and `no-restricted-globals` for `confirm`.

## 6. Phased order of work

Each batch is one PR, branched from `origin/main`.

**Acceptance checks for every PR:**
- `npx tsc --noEmit` and `npm run build` pass
- `npm run lint` passes (once the class check is wired in)
- In the browser, every touched page at 1440px and 375px wide, in light and dark mode
- Keyboard: Tab order, visible focus ring, Esc closes dialogs
- Forms: submit empty, errors appear on the right fields, first invalid field gets focus, valid submit still saves
- No console errors or React ref warnings
- No new raw `<button>` / `<table>` / palette colours in touched files (except print documents)

### Phase 0a: Tailwind compatibility and component fixes (foundation)

- `tailwind.config.js` shim (section 5.2, items 1–4); rewrite the item-5 classes in `components/ui/*`.
- Regenerate `dropdown-menu.tsx` (radix-mira, RemixIcon); `button.tsx` → `Slot` from `radix-ui`.
- Add `check-tw-classes.mjs`.
- `CLAUDE.md`: add the section 4.3 checklist and the Tailwind notes.

Acceptance, in addition to the standard checks:
- A ticked checkbox is filled
- The active tab is highlighted
- `<Separator />` is visible
- Table rows tint on hover
- Select placeholder is muted
- An invalid input has a red border
- The class check reports 0 issues in `components/ui/`

**Visual sweep needed:** about 430 classes start working at once. Borders get softer, tints and hover states appear, and separators appear where layouts were designed without them. Walk through the main pages in both themes and screenshot before and after.

### Phase 0b: Dead code and dependency cleanup (no visible change)

- Delete the 61 dead files from section 3.1 (keep `scroll-area.tsx`) after D8.
- Remove the dependencies listed in 3.1; `helpers.cn` re-exports `lib/utils`.
- Add the ESLint guards (5.3).

Acceptance: build passes; `npm ls` shows no removed packages still imported; bundle size goes down.

### Phase 1: Shared building blocks

- `npx shadcn@latest add alert toggle-group radio-group input-group spinner empty kbd input-otp progress` (+ `sonner` if D3), following the 4.3 checklist for each.
- `useConfirm()` hook plus `ConfirmDialog` on `AlertDialog`.
- `common/Loading` on `spinner`.
- Semantic status tokens `--success` / `--warning` / `--info` (light and dark) and matching `Badge` variants, if D6 is approved.
- Optional `DatePicker` (if D4).

Acceptance: each new component renders in light and dark mode on a scratch route or in the first page that uses it.

### Phase 2: Front desk (highest traffic)

App shell (`Header`, `Sidebar`, `DetailDrawer`, `QRScanner` → `Dialog`), Dashboard (`KpiTile`, `SalesTrendCard` legacy class, chart hex colours → `--chart-*`), Patients (`Patients`, `PatientDetailSheet`, `PatientForm`, `PatientModal`), Appointments (`AppointmentForm` raw buttons → `ToggleGroup` / `Button`, `AppointmentModal` off `common/Modal`).
- Icon-only buttons get a `Tooltip` and an `aria-label`.
- Search boxes use `InputGroup`.

Extra acceptance:
- Book an appointment end to end
- Create and edit a patient
- The patient detail sheet opens, pins and resizes

### Phase 3: Sales orders, invoices, payments, prescriptions

Split into two PRs if the diff gets large.

- **3a, Sales orders:**
  - `SalesOrders` status pills → `ToggleGroup`
  - `SalesOrderDetailSheet` raw table → `Table`
  - `SalesOrderIntakeForm`: 8 raw buttons, 2 raw tables, 137 palette classes → tokens or semantic tokens; date inputs per D4
  - `salesOrderStatusConfig` → `Badge` variants
  - The wizard already uses shadcn `Field` + `register`; keep it (D5)
  - Optional: split the 3,252-line file into one component per step, as a separate commit
- **3b, Billing and prescriptions:**
  - `Invoices`, `InvoiceDetailSheet`, `InvoiceForm`, `InvoiceModal` → `Dialog`
  - `Payments` and `Refunds` forms → react-hook-form + zod
  - `RecordPaymentDialog`, `PrescriptionSelectionModal`
  - `PrescriptionForm` / `EyeRxTable` → shadcn `Table`
  - `PrescriptionModal` → `Dialog`

Extra acceptance: create a sales order through every step, take a payment, print the advance receipt and the invoice (print output unchanged), scan a receipt barcode on `/sales-orders`, and add a prescription.

### Phase 4: Inventory

- **Workspaces:** `FramesWorkspace`, `GeneralInventory`, `ReceivingWorkspace` (8 `confirm()` → `useConfirm`), `LowStockReorder`, `MovementsLog`, `AdjustmentsWorkspace`.
- **Drawers and dialogs:** `AdjustStockDrawer`, `CreatePODrawer`, `ProductReceiveDrawer`, `ReceiveStockDrawer`, `BulkVariantDialog`, `BulkLabelDialog` → react-hook-form + zod. `VariantPicker`, `QuickAddVariantDialog`.
- **Products:** `ProductModal` / `AddProductAssistant` (native `<select>` + `.input` → `Select` / `SearchableLOV`, off `common/*`), `StockAdjustmentModal` off `common/Modal`.

Extra acceptance: add a frame model and variants, receive stock, adjust stock, print labels, and cancel a confirm dialog without side effects.

### Phase 5: Purchasing and suppliers

- **Purchase orders:** `PurchaseOrders` (pills → `ToggleGroup`), `PurchaseOrderWizard` (8 raw buttons, 28 palette), `PurchaseOrderDetailSheet`, `ReceiveGoodsDialog`, `ReceiveGoodsAssistant` (off `common/*`), `SendPurchaseOrderDialog`, `RecordSupplierPaymentDialog`, `ProductPicker`, `purchaseOrderStatusConfig` → `Badge` variants.
- **Suppliers:** `Suppliers` + `SupplierForm` (react-hook-form + zod, off `common/*`), `SupplierInvoices`, `SupplierInvoiceDetailSheet`, `AddSupplierInvoiceDialog`, `CreateSupplierInvoiceDialog` (react-hook-form, off `common/Modal`), `SupplierPayments`.

Extra acceptance: run a PO from draft through sent, received and paid; add a supplier invoice. PO print preview unchanged.

### Phase 6: Finance, reports, settings, admin, auth

- **Finance and reports:** `Transactions`, `Ledger` (debit/credit palette → semantic tokens), `Reports`, `ActivityLogs`.
- **Settings and basic data:** `SettingsHub`, `ClinicSettings` (react-hook-form, off `common/*`), `Lenses`, `OtherExpenses` (dialog forms → react-hook-form), `ProductCategories` (hex → tokens), `ComplimentaryItems`.
- **Admin:** `Users`, `RolesPermissions`, `Sessions`.
- **Auth:** `Login` (→ react-hook-form), `Signup` / `ForgotPassword` codes → `InputOTP`.

Extra acceptance: log in, sign up with code, reset a password, create a user, edit permissions, and revoke a session.

### Phase 7: Wrap-up

- Remove the legacy CSS block from `globals.css`, the `brand` / `success` / `warning` / `error` / `tertiary` / `quaternary` aliases from `tailwind.config.js`, and `common/{Button,Input,Modal}`.
- Remove the `shadcn/tailwind.css` and `tw-animate-css` imports if they're still inert (or keep them for a later v4 upgrade).
- Update `CLAUDE.md`.
- Final class-check and ESLint run with 0 issues; re-run the counts in section 3 and confirm they're at or near 0.
- Optional, separate: Tailwind v4 upgrade (D1).

## 7. Risks

| Risk | Mitigation |
|---|---|
| **Phase 0a changes how everything looks.** About 430 classes and 33 separators start rendering at once. | Treat it as a visual change: before/after screenshots of the main pages in both themes; adjust classes that relied on the bug. |
| **`color-mix` browser support.** Older browsers drop the colour completely. | Confirm the clinic's browsers (D2). Fallback: switch tokens to channel triplets (`--primary: 0.52 0.105 223` with `oklch(var(--primary) / <alpha-value>)`), at the cost of diverging from shadcn's token format. |
| **The shadcn CLI makes unasked changes**: `cn` import and package, CSS edits, `--overwrite` wiping local customisations. | The section 4.3 checklist; review `git diff package.json src/styles tailwind.config.js` after every `add`; never overwrite customised files. |
| **React 18 vs React 19-style components.** Lost refs break focus-on-error and `asChild` positioning, often without an error. | `forwardRef` rule (4.3, item 4); check for React ref warnings in the console during acceptance. |
| **Forms moving from `useState` to zod.** Validation rules can change by accident (optional vs required, number coercion, empty strings vs `null` in API payloads). | Write the zod schema from the existing checks and the backend Pydantic models; test submit with empty, minimal and full input; compare request payloads before and after in the network tab. |
| **Large files** (`SalesOrderIntakeForm` 3,252 lines, `PurchaseOrderWizard` 1,079, `FramesWorkspace` 857) are hard to review. | Keep UI swaps behaviour-preserving; do any file split in its own commit. |
| **No automated UI tests.** | Manual acceptance per phase. Consider a Playwright smoke test for login → patient → sales order as a follow-up. |
| **Concurrent work on the same files**, especially the sales order wizard. | All earlier wizard branches are merged into `origin/main` now; check open branches before starting each phase and rebase often. |
| **Print output.** Invoice, PO and receipt previews use raw tables and hex for print. | Leave print components out of colour and table rules; compare printed PDFs before and after. |

## 8. Decisions for the user

| # | Decision | Recommendation |
|---|---|---|
| D1 | Tailwind: v3 compatibility shim now, or upgrade to v4? | Shim now (Phase 0a, small). Consider v4 as a separate project after Phase 7. |
| D2 | Is `color-mix` acceptable (Chrome or Edge 111+, Safari 16.2+, Firefox 113+)? | Yes, if the clinic machines run a current Chrome or Edge. |
| D3 | Toasts: keep `react-hot-toast` (58 files) or switch to shadcn `sonner`? | Switch, in Phase 1 as one mechanical PR. The APIs (`toast.success/error/loading/promise`) map almost one to one. Keeping it is also fine. |
| D4 | Dates: keep native `<input type="date">` (27) or use a shadcn `DatePicker`? | Keep native for data entry (fast keyboard input, good on mobile). Use `DatePicker` only for range filters on list pages. |
| D5 | Form pattern: `CLAUDE.md` says shadcn `Form`; the SO wizard and `Login` use the newer shadcn `Field` + `register` / `Controller`. | Allow both. Prefer `Form` for dialogs and `Field` for large multi-step forms. Update `CLAUDE.md`. |
| D6 | Status and debit/credit colours: add semantic `--success` / `--warning` / `--info` tokens and `Badge` variants, or keep palette classes with `dark:` pairs? | Add tokens (removes ~200 palette classes in the status configs, `Ledger` and `Transactions`, and fixes "success" rendering blue). |
| D7 | Native `title=` tooltips: replace all 100, or only on icon-only buttons? | Icon-only buttons only (plus `aria-label`). Keep `title` on truncated text. |
| D8 | Delete the 62 dead files, including the 8 redirected pages and drawers such as `QuickSellDrawer` / `ManageSKUDrawer`? | Delete. Git history keeps them. Confirm none are planned work first. |
| D9 | `common/Modal`: delete it once its 9 importers are moved to `Dialog`, or keep it as a convenience? | Delete, so there's one way to open a dialog. |
