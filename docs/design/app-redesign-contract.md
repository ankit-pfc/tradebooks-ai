# App Redesign — Implementation Contract

> The single, authoritative vocabulary for the TradeBooks **app** redesign
> (`src/app/(app)/**`, `src/components/ui/**`, app-side shared components).
> Source of intent: [`ui-redesign.md`](./ui-redesign.md). This file is the
> *how* — exact classes, component APIs, and rules every implementer follows so
> the result is coherent. Marketing (`(marketing)`, `components/marketing`) is a
> DIFFERENT session — do not touch it.

The token foundation is **already done** (`globals.css` + `app-theme-provider`).
The app is scoped under `.tb-app` on `<html>`; do not re-declare tokens.

---

## 1. Color & surface vocabulary (Tailwind utilities, all token-backed)

NEVER use raw `indigo-*`, `blue-*`, `gray-*`, `slate-*`, `zinc-*`, `green-*`,
`red-*`, `amber-*`, or raw hex. Use ONLY these:

| Need | Class | Token |
|---|---|---|
| App canvas bg | `bg-background` | `--bg` |
| Card/panel bg | `bg-card` (or `bg-surface`) | `--surface` |
| Inset / table header / hover | `bg-surface-2` (or `bg-muted`) | `--surface-2` |
| Chip / number bubble | `bg-surface-3` | `--surface-3` |
| Action (buttons, active) | `bg-primary` / `text-primary` | `--primary` `#1F5AE0` |
| Primary text | `text-foreground` (or `text-ink`) | `--ink` |
| Secondary text / labels | `text-ink-2` | `--ink-2` |
| Tertiary / placeholder / caption | `text-ink-3` | `--ink-3` |
| Default border / divider | `border-hairline` (or `border-border`) | `--hairline` |
| Input / focused divider | `border-hairline-strong` | `--hairline-strong` |
| Link / info / chart accent | `text-cyan` | `--cyan` (never a button) |

**Financial semantics — meaning only, never decoration, ALWAYS with icon or label:**

| Meaning | Class |
|---|---|
| Credit / gain / success | `text-pos` / `bg-pos` |
| Debit / loss / failed | `text-neg` / `bg-neg` |
| Needs review / exception / pending | `text-warn` / `bg-warn` |
| Running / queued / info | `text-info` |

Tinted fills: `bg-pos/10`, `bg-warn/10`, `bg-primary/10`, etc. (the `/NN` opacity
modifier works on every token color).

Dark mode is automatic — every token has a dark value. Do NOT write `dark:`
variants for color; the tokens flip themselves. Only use `dark:` for the rare
structural tweak.

---

## 2. Typography & numbers (the highest-leverage rule)

- Headings: `font-sans` (Inter) + weight 600 (`font-semibold`) + `tracking-tight`
  at ≥20px. Screen title `text-2xl font-semibold tracking-tight` (24px). Card
  title `text-lg font-semibold` (18px). Section `text-[15px] font-semibold`.
- Body: `text-sm` (14px) default in-app. `text-ink-2` for secondary.
- Caption / table headers / overlines: `text-xs font-medium uppercase tracking-wide text-ink-2`.
- **EVERY figure** — money, quantity, ledger code, account number, date, id,
  timestamp, timer, percentage, count in a table — renders in the `mono-data`
  class (Geist Mono + tabular). Inline prose numbers may use `tabular` instead.
- Numeric **table columns**: `text-right mono-data`, decimals aligned.
  Negative/debit → `text-neg`; positive/credit → `text-pos`; zero → `text-ink-3`.
  Currency symbol in `text-ink-3`, amount in `text-ink` (unless semantic).
- Format money as Indian grouping where the codebase already has a helper; reuse
  it. Do not invent new formatters.

---

## 3. Depth, radius, spacing, motion

- Elevation: add class `e1` (cards/panels), `e2` (dropdowns, popovers, sticky
  headers), `e3` (dialogs, sheets, command palette). NEVER `shadow-md`/`shadow-lg`.
- Radius: controls (button/input/select) `rounded-md`; cards/panels `rounded-xl`;
  dialogs/sheets `rounded-xl`; dense chips/cells `rounded-sm`. (Base is 8px.)
- Spacing: 4/8 grid — `gap-2 gap-3 gap-4 gap-6 gap-8`, `p-3 p-4 p-6`. Page padding
  `px-6 py-6` (data screens) / `px-8 py-8` (forms/settings). Kill `px-10`/`py-2.5`.
- Borders are hairlines: `border border-hairline`. Remove `ring-1 ring-foreground/10`.
- Motion: transitions `transition-colors`/`transition-[...] duration-150 ease-out`.
  Press feedback `active:scale-[.98]`. No animating width/height/top/left. Respect
  reduced motion (handled globally for `.tb-app`).

---

## 4. New primitives (build in `src/components/ui/`, with tests)

Import in pages from `@/components/ui/<name>`. Each ships a `*.test.tsx`
(behavior, not snapshot) per project TDD rules.

### `StatusDot` — `status-dot.tsx`
`<StatusDot tone="pos|neg|warn|info|neutral" label="Reconciled" />`
Renders an 8px dot in the semantic color + label text. Optional `srOnly` label
only. This is the dense-table status (NOT a filled pill).

### `Stat` (KPI block) — `stat.tsx`
```
<Stat label="Vouchers generated" value={287} sub="Tally-ready"
      delta={{ value: "+12%", direction: "up" }} icon={<FileText/>} />
```
`label` → caption; `value` → `mono-data` large (text-2xl/3xl); `sub` → ink-3;
`delta.direction` `up`→`text-pos` with ↑, `down`→`text-neg` with ↓. Wraps in a
`Card`-like surface with `e1`.

### `Skeleton` — `skeleton.tsx`
`<Skeleton className="h-4 w-32" />` — animated `bg-surface-2` pulse. Provide
`<SkeletonRows cols={n} rows={n}/>` helper for tables. Spinners only for <300ms.

### `DataTable<T>` — `data-table.tsx`
Declarative table for SIMPLE lists (dashboard recent batches, batches page). Do
NOT force this onto pages with existing server-side pagination/search logic
(ledger-masters) — those use the enhanced Table primitives instead.
```
type Column<T> = {
  id: string; header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  sortable?: boolean; sortValue?: (row: T) => string | number;
  width?: string; headerClassName?: string; cellClassName?: string;
};
<DataTable
  data={rows} columns={cols} getRowId={(r)=>r.id}
  density={density}                       // optional; defaults to useDensity()
  initialSort={{ id: "date", dir: "desc" }}
  onRowClick={(r)=>...}                   // optional
  selection={{ selectedIds, onChange }}   // optional → checkbox col + bulk bar
  bulkActions={<Button.../>}              // shown in sticky bar on selection
  toolbar={<...left...>} toolbarRight={<...>}
  loading={bool} error={msg} emptyState={<EmptyState .../>}
/>
```
Behavior: sticky `bg-surface-2` header with `e2` once scrolled, sortable columns
toggle asc/desc with caret + `aria-sort`, rows hairline-bottom + `hover:bg-surface-2`,
selected row `bg-primary/[.06]` + 2px left `--primary` marker, density via
`data-density`, skeleton rows when `loading`, `emptyState` when no rows.
Tests: sort toggles + aria-sort, selection add/remove + bulk bar visibility,
empty/loading/error rendering.

### `EmptyState` — `empty-state.tsx`
`<EmptyState icon={...} title="No batches yet" description="..." action={<Button/>} />`

### `ThemeToggle` — `theme-toggle.tsx`
Uses `useAppTheme()`. Sun/Moon (lucide) button cycling light↔dark (long-press or
dropdown for system optional). `aria-label`, `e2` if dropdown.

### `DensityToggle` — `density-toggle.tsx`
Uses `useDensity()`. Two-segment control (Rows/Compact) or icon button.

### `CommandPalette` — `command-palette.tsx`
`⌘K`/`Ctrl-K` opens an `e3` dialog (radius xl) with a fuzzy filter input over a
static action list: navigate to each page (Dashboard, Upload, Ledger Masters,
History, Settings), toggle theme, toggle density. Accept an optional `extraItems`
prop so pages can register ledger/batch jump targets later. Keyboard: ↑/↓ select,
Enter run, Esc close. Use existing `Dialog`. Tests: open on ⌘K, filter narrows
list, Enter runs the selected item's `onSelect`.

---

## 5. Re-tokened existing primitives (`src/components/ui/`)

Keep every export name, prop, and `data-slot`/variant key identical (pages depend
on them). Change ONLY classes per §1–3.

- **button.tsx**: `default` = `bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]`,
  `rounded-md`, `active:scale-[.98]`, focus ring `ring-2 ring-primary/40 ring-offset-2`.
  Variants: `secondary` (`bg-surface-2 border border-hairline text-ink hover:bg-surface-3`),
  `outline`, `ghost` (`hover:bg-surface-2`), `destructive` (`bg-[var(--neg)] text-white`),
  `link` (`text-primary`). Sizes sm=32/h-8, default=36/h-9, lg=40/h-10. Keep a
  loading/disabled affordance.
- **card.tsx**: `bg-card border border-hairline rounded-xl e1`. Remove
  `ring-1 ring-foreground/10`. Title → `text-lg font-semibold tracking-tight`.
- **input.tsx / textarea.tsx**: `h-9 rounded-md border border-hairline-strong bg-card`,
  focus → `border-primary ring-2 ring-primary/15`, placeholder `text-ink-3`.
- **badge.tsx**: keep pill ("soft") mode = `text-<tone> bg-<tone>/12 rounded-full`
  for detail views; map default/secondary/destructive to tokens. (Dense tables use
  `StatusDot` instead.)
- **table.tsx**: header `bg-surface-2 text-ink-2 text-xs uppercase tracking-wide`,
  rows `border-b border-hairline hover:bg-surface-2`, density-aware padding via
  `var(--cell-py)/var(--cell-px)` and row height `var(--row-h)`. Add a
  `SortableHeader` helper (caret + `aria-sort`) and make the container support a
  sticky header. Cells default left; numeric cells get `text-right mono-data`.
- **dialog.tsx / sheet.tsx**: `e3`, `rounded-xl`, scrim `bg-[rgba(11,31,51,.45)]`
  (dark handled by tokens). Remove hand shadows/rings.
- **select / dropdown-menu / popover / tooltip**: content `e2 rounded-xl bg-popover
  border border-hairline`. Items hover `bg-surface-2`.
- **alert.tsx**: semantic tone via tokens + a lucide icon; `rounded-xl border-hairline`.
- **progress.tsx / separator.tsx / tabs.tsx / scroll-area.tsx**: re-token to
  hairline/surface/primary; tabs active = `text-primary` + 2px `--primary` underline.
- **logo.tsx**: ensure the wordmark uses `text-ink` + `text-primary` for "AI"; the
  app sidebar passes a variant for light bg now (was white-on-navy).

Icons: **lucide-react** (already a dep), stroke 1.5, sizes 16/20/24. No emoji, no
hand-drawn inline SVG for standard glyphs (replace ad-hoc SVGs with lucide).

---

## 6. Shell (owned by orchestrator, listed for context)

Light sidebar (248px, `bg-sidebar` = surface, hairline right border), active item
= `text-primary` + `bg-surface-2` + 3px left `--primary` bar; topbar (56px, sticky,
`e1` on scroll) with breadcrumb, FY/company context, `ThemeToggle`, `DensityToggle`,
⌘K trigger, user menu. Page agents should assume a topbar exists and NOT render
their own top-level page chrome duplicating it (keep the in-page `<h1>` + actions).

---

## 7. Hard rules (reject your own output if it violates these)

1. Zero raw `indigo/blue/gray/slate/green/red/amber-NNN` or raw hex in app code.
2. Every figure in `mono-data`/`tabular`. Numeric table columns right-aligned.
3. Status = dot/icon + label; never color alone.
4. One primary (`bg-primary`) CTA per screen; rest secondary/ghost.
5. Elevation only via `e1/e2/e3`. Radius only via the rounded scale (§3).
6. Preserve ALL existing data fetching, server actions, state, props, and
   especially ledger-masters server-side search+pagination. Redesign is visual +
   structural shell only — do not change business logic or API calls.
7. New components get real behavior tests (no `toBeTruthy()` filler).
8. `npm run build`, `npm run lint`, `npm run test:run` must pass.
