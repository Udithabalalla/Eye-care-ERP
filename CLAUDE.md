# Eye Care ERP — Frontend UI Rules

## Shadcn-First Component Policy

When editing **any** frontend UI component or page, follow this rule: **use shadcn/ui components first — do not reinvent the wheel.**

### How to pick a component

1. **Check for an existing shadcn component** in `Frontend/src/components/ui/` (individual files: `button.tsx`, `card.tsx`, `dialog.tsx`, etc.). If it covers the use case, use it.
2. **Install missing shadcn components** with `npx shadcn@latest add <name>` run from the `Frontend/` directory. The project uses `style: radix-mira`, `baseColor: mist` as in `Frontend/components.json`.
3. **If no shadcn component exists**, compose from shadcn design tokens (`--primary`, `--background`, `--border`, etc.) and Tailwind utilities. Do not add new UI libraries.

### After every `npx shadcn@latest add` (Tailwind v3 + React 18)

The shadcn components are generated for Tailwind v4 and React 19. This app runs Tailwind v3 and React 18, so check each generated file:

1. The CLI sometimes writes `import { cn } from "cn"` and adds an unrelated `cn` npm package. Change the import to `@/lib/utils` and revert `package.json` / `package-lock.json`.
2. Revert any edits the CLI makes to `src/styles/globals.css` or `tailwind.config.js`.
3. Never use `--overwrite` on files with local changes: `sheet.tsx` (pin/resize), `dialog.tsx`, `input.tsx`, `textarea.tsx` (forwardRef for react-hook-form), `button.tsx`, `sidebar.tsx`, `alert-dialog.tsx`.
4. React 18: wrap a generated component in `React.forwardRef` if it receives a react-hook-form ref (`register`, `field.ref`) or sits under a Radix `asChild` / `FormControl` slot. Otherwise the ref is dropped without an error.
5. Run `npm run lint` (from `Frontend/`): ESLint with `--max-warnings 0`, then `npm run check:tw`, which lists classes that compile to no CSS. `tailwind.config.js` already maps shadcn's v4 variants (`data-checked:`, `data-active:`, `data-horizontal:`, `aria-invalid:`, `has-data-[…]:`, `in-data-[…]:` …), opacity on theme colours (`bg-primary/10`) and half spacing steps (`pl-7.5`). Rewrite whatever it still flags:
   - `x-(--var)` → `x-[var(--var)]`
   - `utility!` → `!utility`
   - `**:data-[slot=x]:utility` → `[&_[data-slot=x]]:utility`
   - `*:[a]:utility` → `[&>a]:utility`
   - `group-data-horizontal/name:` → `group-data-[orientation=horizontal]/name:`
   - `--spacing(n)` → the rem value (`n × 0.25rem`)
   - `@md/name:` (container query) → `md:`

### Import rules

- Import shadcn components **directly from their file**:
  ```tsx
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  ```
- There is no barrel index: `@/components/ui` does not exist (ESLint blocks it). The old Untitled UI wrappers and `common/Button`, `common/Input`, `common/Modal` were removed.

---

## Icon Policy — RemixIcon Only

**Only use `@remixicon/react`.** Remove any imports from `lucide-react`, `@untitledui/icons`, or `@radix-ui/react-icons`.

```tsx
import { RiAddLine, RiSearchLine, RiCloseLine } from '@remixicon/react'
```

| Use case | RemixIcon name |
|---|---|
| Add / Plus | `RiAddLine` |
| Search | `RiSearchLine` |
| Close / X | `RiCloseLine` |
| Menu | `RiMenuLine` |
| Settings | `RiSettings4Line` |
| User | `RiUserLine` |
| Team / Users | `RiTeamLine` |
| User add | `RiUserAddLine` |
| User check | `RiUserCheckLine` |
| Calendar | `RiCalendarLine` |
| Home / Dashboard | `RiHomeLine` |
| File / Document | `RiFileTextLine` |
| File chart | `RiFileChartLine` |
| Bar chart | `RiBarChartLine` |
| Bar chart 2 | `RiBarChart2Line` |
| Money / Dollar | `RiMoneyDollarCircleLine` |
| Wallet | `RiWallet3Line` |
| Package / Box | `RiBox3Line` |
| Truck / Supplier | `RiTruckLine` |
| Receipt / Order | `RiReceiptLine` |
| Bell | `RiBellLine` |
| Logout | `RiLogoutBoxRLine` |
| Eye (show) | `RiEyeLine` |
| Eye (hide) | `RiEyeOffLine` |
| Lock | `RiLockLine` |
| Mail | `RiMailLine` |
| Phone | `RiPhoneLine` |
| Key | `RiKeyLine` |
| Shield check | `RiShieldCheckLine` |
| Alert / Warning | `RiAlertLine` |
| More actions (⋯) | `RiMore2Line` |
| Arrow down | `RiArrowDownSLine` |
| Arrow up/down | `RiArrowUpDownLine` |
| Chevron left | `RiArrowLeftSLine` |
| Chevron right | `RiArrowRightSLine` |
| Loader / Spinner | `RiLoader4Line` |
| Trending up | `RiTrendingUpLine` |
| Sun | `RiSunLine` |
| Moon | `RiMoonLine` |
| Sparkle | `RiSparklingLine` |

---

## Form Policy

Use **`react-hook-form` + `zod`** for all forms, rendered with shadcn **`Form`** (`FormField`, `FormItem`, `FormMessage`) — or, for large multi-step forms such as the sales order wizard and the sign-in page, shadcn **`Field`** with `register` / `Controller` and `FieldError`. Avoid raw `useState` form management.

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
```

`form.tsx` is installed at `src/components/ui/form.tsx`.

---

## Modal / Dialog Policy

Use shadcn **`Dialog`** (`src/components/ui/dialog.tsx`) for all modals (`AlertDialog` for confirmations, through `useConfirm()`; `Sheet` for detail drawers).

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
```

For controlled open state:
```tsx
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
```

---

## Confirmations, toasts and status colours

- **Confirm before a destructive action** with `useConfirm()` from `@/hooks/useConfirm` (a shadcn `AlertDialog` you can await), never `window.confirm()`:
  ```tsx
  const { confirm, confirmDialog } = useConfirm()
  if (!(await confirm({ title: 'Delete this frame?', destructive: true, confirmLabel: 'Delete' }))) return
  // render {confirmDialog} once in the component
  ```
- **Toasts:** `import { toast } from 'sonner'` (`toast.success`, `toast.error`, `toast.promise`; pass `action: { label, onClick }` for a button). The `Toaster` is mounted once in `main.tsx`.
- **Status colours:** use the `success`, `warning` and `info` tokens (`text-success`, `bg-warning/10`, `<Badge variant="success">`, `<Alert variant="warning">`) instead of raw palette classes like `text-emerald-600`.

---

## Table Policy

- Use **`DataTable`** (`@/components/data-table.tsx`) for server-side paginated TanStack tables.
- Use shadcn `Table` primitives (`@/components/ui/table`) for simple display tables.

---

## Pagination Policy

Use `Pagination` from `@/components/common/Pagination` (which wraps shadcn `Button`).

---

## Combobox / Searchable Select Policy

Use `SearchableLOV` from `@/components/common/SearchableLOV` — it is built on shadcn `Popover` + `Command`.

---

## What NOT to do

- Do not `import` from `lucide-react`
- Do not `import` from `@untitledui/icons`
- Do not `import` from `@radix-ui/react-icons`
- Do not use raw `<button>`, `<select>` or `<table>`: use `Button` (any variant, incl. `link`/`ghost` for rows and links), `ToggleGroup` / `Tabs` for choices, `Select` / `SearchableLOV`, `Table` / `DataTable`. Print documents (`InvoicePreview`, `PurchaseOrderPreview`) are the exception.
- Do not use raw palette colours (`text-emerald-600`, `bg-amber-50`) for status: use the `success` / `warning` / `info` / `destructive` tokens. Categorical palettes (status configs, chart and avatar colours) are the exception.
- Do not wrap theme tokens in `hsl(...)`: they are complete oklch colours. Use `var(--primary)`, opacity modifiers (`bg-primary/10`) or `color-mix(in_oklab,var(--primary)_12%,transparent)` in arbitrary values.
- Do not use `react-aria-components` for UI primitives — Radix/shadcn covers these
- Do not write custom dropdown/modal/tooltip implementations when shadcn already has them

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
