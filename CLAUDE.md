# Eye Care ERP — Frontend UI Rules

## Shadcn-First Component Policy

When editing **any** frontend UI component or page, follow this rule: **use shadcn/ui components first — do not reinvent the wheel.**

### How to pick a component

1. **Check for an existing shadcn component** in `Frontend/src/components/ui/` (individual files: `button.tsx`, `card.tsx`, `dialog.tsx`, etc.). If it covers the use case, use it.
2. **Install missing shadcn components** with `npx shadcn@latest add <name>` run from the `Frontend/` directory. The project uses `style: radix-mira`, `baseColor: mist` as in `Frontend/components.json`.
3. **If no shadcn component exists**, compose from shadcn design tokens (`--primary`, `--background`, `--border`, etc.) and Tailwind utilities. Do not add new UI libraries.

### Import rules

- Import shadcn components **directly from their file**:
  ```tsx
  import { Button } from '@/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
  ```
- **Never import from the barrel index** `@/components/ui` — that resolves to legacy Untitled UI wrappers.
- The legacy wrappers in `src/components/ui/base/` and `src/components/ui/application/` should be **replaced**, not used.

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

Use **`react-hook-form` + `zod` + shadcn `Form`** for all forms. Avoid raw `useState` form management.

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
```

`form.tsx` is installed at `src/components/ui/form.tsx`.

---

## Modal / Dialog Policy

Use shadcn **`Dialog`** (`src/components/ui/dialog.tsx`) for all modals. The `Modal` component in `@/components/common/Modal` is a thin wrapper around `Dialog` — prefer using `Dialog` directly in new code.

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
```

For controlled open state:
```tsx
<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
```

---

## Table Policy

- Use **`DataTable`** (`@/components/data-table.tsx`) for server-side paginated TanStack tables.
- Use shadcn `Table` primitives (`@/components/ui/table`) for simple display tables.
- Replace `TableCard` from `@/components/ui` with `Card` + `CardHeader` from `@/components/ui/card`.

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
- Do not `import { Button, Input, Select, Table, Modal, Pagination }` from `@/components/ui` (barrel index)
- Do not add raw CSS class strings like `btn-primary`, `card`, `input` (legacy custom CSS)
- Do not use `react-aria-components` for UI primitives — Radix/shadcn covers these
- Do not write custom dropdown/modal/tooltip implementations when shadcn already has them
