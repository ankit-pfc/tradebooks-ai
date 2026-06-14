# TradeBooks AI — UI/UX Redesign System

> **Goal:** move TradeBooks from "default Next.js + shadcn starter" to a **premium, proprietary financial instrument** that a CA or trading desk trusts on sight.
> **Chosen lane:** **Hybrid** — a calm, immaculate *shell* (Stripe/Mercury energy) wrapping a dense, **terminal-grade data layer** (Bloomberg/Linear energy) where the real work happens.
> **Status:** design spec, doc-only. No code changed yet. This is the source of truth for the implementation phase.

---

## 0. The honest diagnosis (why it looks "cheap SaaS" today)

This isn't a vibes problem — it's four concrete, fixable issues found in the current code:

1. **Brand tokens are defined but not applied.** `globals.css` declares `--tb-navy: #0B1F33` and `--tb-blue: #2D9CDB`, but real CTAs use raw `bg-indigo-600`, focus rings use `ring-indigo-100`, and `--ring` is `#1e4fd8` (a third, unrelated blue). Three different blues are fighting. The brand never accumulates.
   - Evidence: [dashboard/page.tsx:182](src/app/(app)/dashboard/page.tsx) `bg-indigo-600`; [globals.css:85](src/app/globals.css) `--ring: #1e4fd8`; [globals.css:80](src/app/globals.css) `--accent: #2d9d78` (a teal that matches neither brand green `#27AE60` nor anything else).
2. **No depth model.** Everything is `border border-gray-200`. There is no elevation scale, no shadow language — so nothing feels layered, nothing feels "real." Flat-because-borders reads as "template," not "product."
3. **Generic dark mode.** The `.dark` block is the stock shadcn pure-grayscale `oklch` palette ([globals.css:102–134](src/app/globals.css)). It's neutral gray-on-gray — the single most "anonymous SaaS" signal there is. For a finance tool, dark mode is a *headline feature*, and ours is the default template.
4. **No numeric treatment.** Money, quantities, ledger codes, and dates render in proportional Inter with no tabular figures and no monospace. Columns of numbers don't align on the decimal. For an accounting/trading product, **this is the thing pros notice first** — and it's the cheapest, highest-leverage fix we have.

Everything below fixes these in a coherent system.

---

## 1. Design philosophy

Three words, borrowed from the best fintech teams and adapted to us:

- **Clarity** — one obvious primary action per screen. The shell gets out of the way.
- **Density with rhythm** — finance pros *want* information density; the skill is making dense scannable, not sparse. We earn density with alignment, hairlines, and tabular numbers — not with cramming.
- **Conviction** — the product should be recognizable with the logo cropped off. One confident accent, a real dark mode, mono figures, a navy-tinted neutral ramp. No default blues, no default grays.

> The trap to avoid (and the reason most fintech apps look identical): copying Stripe's *surface* — dark bg, Inter, gradients — without the *structure*. "Stripe didn't simplify payments visually. They simplified them structurally." Our differentiator is **the ledger/data layer**, so that's where we spend the design budget.

### The hybrid model in one picture

```
┌──────────────────────────────────────────────────────────────┐
│  SHELL  (calm — Stripe/Mercury)                                │
│  ┌────────────┐  ┌────────────────────────────────────────┐   │
│  │            │  │  Topbar: breadcrumb · context · actions  │   │
│  │  Sidebar   │  ├────────────────────────────────────────┤   │
│  │  (quiet,   │  │                                          │   │
│  │   light or │  │   DATA LAYER  (dense — terminal/Linear)  │   │
│  │   navy)    │  │   tabular numbers · hairline rows ·      │   │
│  │            │  │   monospace figures · status dots ·      │   │
│  │            │  │   compact/comfortable density toggle     │   │
│  └────────────┘  └────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
   ^ generous whitespace, soft depth        ^ zero wasted pixels, surgical
```

---

## 2. Benchmark distillation — what to steal, what to skip

| Reference | Steal | Skip |
|---|---|---|
| **Razorpay / Blade** | Token discipline (every color/space/motion is a named token, applied everywhere). Geometric, confident, trustworthy blue. | Consumer-payments friendliness, illustration-heavy marketing look. We're a pro tool, not a checkout. |
| **Mercury** | Real dark canvas with *tinted* near-blacks (`#171721`/`#1e1e2a`, not gray), restrained accent (`#5266eb`) kept **off** decoration and reserved for action, weight-driven hierarchy (body weight 420). | Extreme pill radii (32–40px) and proprietary typeface — overkill/expensive for us. |
| **Stripe** | Surface the one metric that answers "is everything OK?" first, then drill in. Immaculate spacing. | The "everyone copies this" dark+gradient surface. |
| **Ramp** | Hierarchy in dense expense/transaction tables; AI-assist surfaced inline (we have the same: auto-mapping, exceptions). | — |
| **Linear / Bloomberg** | Terminal density done right: hairline rows, monospace figures, keyboard-first, compact mode, status dots over status pills. | Pure dark-only; we keep a first-class light mode. |
| **Brex** | "Color as conviction" — a non-default accent that says "not a generic bank." | Their literal orange (wrong for us). |

**Net direction for TradeBooks:** navy-anchored, one confident azure action color, financial green/red used *only* for credit/debit/gain/loss semantics, monospace for every figure, a genuine tinted dark mode, soft real depth in the shell, surgical density in the tables.

---

## 3. Foundations

### 3.1 Color

Replace the three-blues mess with **one brand ink, one action accent, and a strict financial-semantic set**, all on a **navy-tinted neutral ramp** (not pure gray — the tint is what makes neutrals feel "designed").

#### Brand + action

| Token | Light | Dark | Role |
|---|---|---|---|
| `--brand` | `#0B1F33` | `#0B1F33` | Navy. Wordmark, dark surfaces, the "house" color. *(keep — it's good)* |
| `--primary` | `#1F5AE0` | `#5B8DEF` | **The** action color. Replaces all `indigo-600`. Deeper/cooler than default indigo → reads engineered, not Bootstrap. |
| `--primary-hover` | `#1A4DC2` | `#74A1F2` | |
| `--accent-cyan` | `#2D9CDB` | `#39B0F0` | The existing brand blue, **demoted to info/data-viz only** (links, info chips, chart series). Never a button. |

> Why not just `#2563EB`? The 2026 fintech analysis is explicit: *default blues signal generic banking*. `#1F5AE0` is a small, deliberate shift — same trust, more identity.

#### Financial semantics (used for meaning, never decoration)

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--pos` (credit / gain) | `#0B815A` | `#3DD68C` | Money in, gains, succeeded. *Not* neon — an accountant's green. |
| `--neg` (debit / loss) | `#C8324B` | `#FF6B81` | Money out, losses, failed. A "financial" red, not the current pastel `#EB5757`. |
| `--warn` (needs review) | `#B45309` | `#F0A742` | Exceptions, pending, auto-suggested-needs-confirm. |
| `--info` (running) | `#1F5AE0` | `#5B8DEF` | In-progress, queued. |

Every semantic color **must** ship with an icon or text label, never color alone (colorblind safety + WCAG `color-not-only`). Status in tables uses a **dot + label**, not a filled pill, in the dense view.

#### Navy-tinted neutral ramp (the secret sauce)

Pure `gray-*` is what makes the current UI anonymous. Tint every neutral toward navy (`~220° hue`). This single change unifies the whole product.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FBFCFE` | `#0A0E14` | App canvas. Light: faint cool white. Dark: **tinted** near-black (à la Mercury `#171721`), not `#000`. |
| `--surface` | `#FFFFFF` | `#11161F` | Cards, panels, table container. |
| `--surface-2` | `#F4F6FA` | `#161C27` | Inset rows, table header, hover. |
| `--hairline` | `#E5E9F0` | `#222A38` | Borders/dividers. Replaces `gray-200` everywhere. |
| `--hairline-strong` | `#CBD3E0` | `#303A4C` | Input borders, focused dividers. |
| `--ink` | `#0B1F33` | `#E7ECF4` | Primary text. |
| `--ink-2` | `#475569` | `#9AA6B8` | Secondary text / labels. |
| `--ink-3` | `#7A8699` | `#697587` | Tertiary / placeholders / disabled. |

Contrast check (must hold): `--ink` on `--surface` ≥ 12:1; `--ink-2` on `--surface` ≥ 4.5:1; white on `--primary` ≥ 4.5:1; `--pos`/`--neg` text on `--surface` ≥ 4.5:1. Validate dark separately — never assume light values port.

### 3.2 Typography

**Keep the two-font architecture, fix the application.**

- **UI / text:** Inter (already loaded). Recommendation: rename the role to **Inter for body/labels** and use **negative tracking on large headings** (`-0.02em` at ≥24px) — this alone makes Inter read "designed" instead of "default."
  - *Optional upgrade (cheap, high-impact):* adopt **Geist Sans** for headings/display. You already load Geist Mono — using the matching Geist Sans for display gives a cohesive, modern, faintly-proprietary family (the Vercel signal) at zero licensing cost. Inter stays as the safe fallback.
- **Figures / data:** **Geist Mono** (already loaded) for **every** monetary amount, quantity, ledger code, account number, date, and timer. This is the single biggest "premium fintech" lever we have and it costs us nothing.
  - Apply tabular figures to Inter too where mono is too heavy: `font-feature-settings: "tnum" 1, "cv01" 1;`
  - All numeric table columns: right-aligned, `font-variant-numeric: tabular-nums`, decimals aligned.

#### Type scale (replace the loose 12/14/16/20/28/36 with a tighter, intentional ramp)

| Token | Size / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| `display` | 32 / 38 | 600 | -0.02em | Page title (rare) |
| `h1` | 24 / 30 | 600 | -0.02em | Screen title |
| `h2` | 18 / 26 | 600 | -0.01em | Section / card title |
| `h3` | 15 / 22 | 600 | 0 | Sub-section |
| `body` | 14 / 21 | 400 | 0 | Default app text *(note: shell drops from 16→14 for density; keep 16 on marketing pages for readability)* |
| `body-strong` | 14 / 21 | 500 | 0 | Emphasis, labels |
| `caption` | 12.5 / 18 | 500 | 0 | Meta, table headers (uppercase, +0.04em) |
| `mono-data` | 13 / 20 | 450 | 0 | **All figures** (Geist Mono) |
| `mono-sm` | 12 / 18 | 450 | 0 | Dense table figures, codes |

Weight hierarchy is doing the work (600 headings / 500 labels / 400 body) — borrowed from Mercury's weight-driven system. Avoid going below 12px for any real content.

### 3.3 Spacing & layout

- **4 / 8 base grid.** Spacing tokens: `4 8 12 16 24 32 48 64`. No arbitrary `py-2.5`/`px-10` one-offs — those are part of why it feels inconsistent today.
- **Two density modes** (the heart of the hybrid model):
  - **Comfortable** — shell, forms, settings, marketing, dashboard cards. Row height `48px`, cell padding `12px 16px`.
  - **Compact** — ledger-masters, exceptions, batches, any data grid. Row height `36px`, cell padding `6px 12px`, `mono-sm` figures. User-toggleable, remembered per table.
- **Container width:** content max-width `1440px` for data screens (tables want the room); `1120px` for forms/settings (reading comfort). Sidebar fixed `248px` (down from `288px` — reclaim it for data).
- **Page padding:** standardize on `24px` (data screens) / `32px` (form/settings screens). Kill the `px-10`/`px-8` inconsistency.

### 3.4 Depth & elevation (the missing layer)

Introduce a **4-step elevation scale** — soft, low, navy-tinted shadows (not the harsh default black). This is what separates "product" from "template."

| Level | Use | Light shadow | Dark |
|---|---|---|---|
| `e0` | Flush surfaces, table rows | none, hairline only | none, hairline only |
| `e1` | Cards, panels | `0 1px 2px rgba(11,31,51,.06), 0 1px 1px rgba(11,31,51,.04)` | `0 1px 0 rgba(0,0,0,.4)` + hairline |
| `e2` | Dropdowns, popovers, sticky table header | `0 4px 12px rgba(11,31,51,.08), 0 2px 4px rgba(11,31,51,.05)` | `0 8px 24px rgba(0,0,0,.5)` |
| `e3` | Dialogs, sheets, command palette | `0 16px 40px rgba(11,31,51,.16), 0 4px 8px rgba(11,31,51,.06)` | `0 24px 60px rgba(0,0,0,.6)` |

Rule: elevation is consistent and meaningful (higher = closer to user / more transient). No random `shadow-md` sprinkled by hand — only these four tokens.

### 3.5 Radius & borders

Current base `0.75rem` (12px) is a touch friendly/round for "elite proprietary." Tighten:

- `--radius`: **8px** base. Controls (inputs, buttons, selects): `6px`. Cards/panels: `10px`. Dialogs/sheets: `12px`. Dense terminal chips/cells: `4px`.
- Borders → **hairlines**. Replace `ring-1 ring-foreground/10` and `border-gray-200` with `1px solid var(--hairline)`. One hairline language across the whole product.

### 3.6 Motion

Fast, purposeful, interruptible. Tokens:

- Durations: `enter 180ms` / `exit 120ms` (exit faster than enter) / `micro 100ms` (hover, press).
- Easing: `ease-out` for enter, `ease-in` for exit. No `linear` on UI.
- Press: subtle `scale(0.98)` on buttons/cards, restore on release.
- Skeletons (not spinners) for any load > 300ms — especially tables and the dashboard.
- Respect `prefers-reduced-motion` globally (the `--design-system` checklist flags this).
- Avoid: decorative animation, animating `width/height/top/left` (use `transform`/`opacity`), anything > 400ms in-app.

---

## 4. The shell (calm — Stripe/Mercury)

### Sidebar
- Width `248px`. **Two viable treatments — pick one and commit:**
  - **(A) Navy sidebar (keep current `#0B1F33`)** but refine: active item gets a `3px` left accent bar in `--primary` + `bg-white/8`, label weight 500; inactive `--ink` at 70% opacity, hover `bg-white/5`. Section labels in `caption` uppercase at 45% opacity.
  - **(B) Light sidebar** (`--surface`, hairline right border) — more Stripe/Mercury-calm, lets the data breathe. Active item: `--primary` text + `--surface-2` fill + left accent bar.
  - *Recommendation:* **(B) light** for the hybrid lane — it makes the dark data tables (in dark mode) and the figures pop, and reads more "2026 premium." Keep navy as an option behind a theme setting.
- Logo lockup top, `64px` zone, hairline divider below.
- User/account control pinned bottom with hairline-top, avatar + name + chevron → dropdown.

### Topbar (new — we don't have one)
- `56px`, sticky, `e1` on scroll only. Left: breadcrumb (`Dashboard / Ledger Masters`) in `caption`/`body`. Center-right: context (active company/FY selector — critical for an accounting tool). Right: **⌘K command palette**, density toggle, theme toggle, notifications.
- The FY/company switcher living in the topbar is a genuine pro-tool signal and solves a real accounting-app need.

### Global patterns
- **Command palette (⌘K):** jump to any ledger, batch, page, or action. Single highest-leverage "proprietary tech" feature we can add. Keyboard-first is the Linear signal.
- **One primary CTA per screen**, in `--primary`. Everything else is secondary/ghost.
- Empty states: icon + one-line explanation + one primary action. Never a blank panel.

---

## 5. The data layer (dense — terminal/Linear)

This is where TradeBooks wins or loses. Spec for every table (ledger-masters, exceptions, batches, security mappings):

- **Row:** `36px` compact / `48px` comfortable. Hairline bottom (`--hairline`), hover `--surface-2`, selected `--primary` at 6% tint + `2px` left accent.
- **Sticky header:** `--surface-2`, `caption` uppercase `--ink-2`, `e2` shadow once scrolled, **sortable** with `aria-sort` + a direction caret. Sticky on vertical scroll.
- **Numbers:** Geist Mono, **right-aligned**, tabular, decimal-aligned. Negative/debit values in `--neg`; positive/credit in `--pos`; zero in `--ink-3`. Currency symbol in `--ink-3`, amount in `--ink`.
- **Status:** dot (`8px`, semantic color) + label in compact; reserve the filled pill/`Badge` for comfortable views and detail pages.
- **Density toggle** in the table toolbar; persist choice.
- **Row actions:** reveal on hover (desktop), in an overflow `⋯` menu; never a wall of buttons per row.
- **Bulk actions:** checkbox column → sticky action bar appears on selection (Ramp/Linear pattern). Critical for exceptions/mapping review where users approve in bulk.
- **Toolbar:** left = search (`⌘F`-style, scoped) + filter chips; right = density, columns, export (CSV — finance users expect it), primary action.
- **Empty / loading / error:** skeleton rows on load; meaningful empty state with guidance; error row with a retry — never a bare empty grid.
- **Pagination:** keep the footer pattern but align it to the new tokens; show range + total in `mono-sm`.
- **Virtualize** any list > ~50 rows.

---

## 6. Component specs (mapped to existing `src/components/ui`)

Migrate the 17 existing shadcn primitives. Before → after for the ones that move the needle:

| Component | Today | Redesign |
|---|---|---|
| **Button** ([button.tsx](src/components/ui/button.tsx)) | `rounded-lg`, default = navy, CTAs bypass it for `bg-indigo-600` | `radius 6px`. `default` = `--primary` (kill every raw `indigo-*`). Variants: `primary`, `secondary` (surface-2 + hairline), `ghost`, `destructive` (`--neg`), `link`. Sizes `sm 32 / md 36 / lg 40`. Press `scale .98`, loading spinner + disabled. Focus ring = `--primary` at 40%, 2px offset. |
| **Card** ([card.tsx](src/components/ui/card.tsx)) | `rounded-xl ring-1 ring-foreground/10`, no shadow | `radius 10px`, `--surface`, `1px --hairline`, `e1`. Title `h2`, optional `caption` overline. Remove the ring; use hairline + elevation. |
| **Input** ([input.tsx](src/components/ui/input.tsx)) | `h-10 rounded-lg`, indigo focus | `h 36px` (44 on mobile), `radius 6px`, `1px --hairline-strong`, focus → `--primary` border + 3px `--primary`/15 ring. Visible label (never placeholder-only), helper text slot, error below field in `--neg`. |
| **Badge** ([badge.tsx](src/components/ui/badge.tsx)) | pill `rounded-4xl` | Two modes: **status-dot** (dense tables) and **soft-pill** (`--x` text on `--x`/12% bg, detail views). Map to financial semantics. |
| **Table** ([table.tsx](src/components/ui/table.tsx)) | minimal, inherits | Full spec from §5. This is the biggest single upgrade. |
| **Dialog / Sheet** | `rounded-xl ring-1`, `shadow-lg` | `e3`, `radius 12px`, scrim `rgba(11,31,51,.45)` light / `rgba(0,0,0,.6)` dark, animate from trigger, confirm-on-dismiss when dirty. |
| **Tabs / Select / Dropdown / Alert / Progress / Separator / Tooltip** | functional, default | Re-token to the new color/radius/elevation; Select & Dropdown get `e2`; Alert uses semantic colors + icon. |
| **NEW: CommandPalette** | — | `⌘K`, `e3`, fuzzy over ledgers/batches/pages/actions. |
| **NEW: StatRow / KPI** | inline on dashboard | Reusable metric block: `caption` label, `mono-data` value, delta in `--pos`/`--neg` with arrow. |
| **NEW: DataTable wrapper** | per-page hand-rolled | Encapsulate sort/filter/density/select/empty/skeleton so every screen inherits the terminal treatment. |

All icons: **Lucide** (already in deps), single stroke width (1.5px), consistent sizing tokens (`16 / 20 / 24`). No emoji as icons anywhere.

---

## 7. Page-by-page notes

- **Dashboard** ([dashboard/page.tsx](src/app/(app)/dashboard/page.tsx)): Lead with the Stripe pattern — one "is everything OK?" answer (e.g. *Books reconciled through 12 Jun · 3 exceptions need review*) as a hero strip, then the 4 KPI `StatRow`s, then Recent Batches in the new DataTable, then the quick-start guide demoted to a dismissible card. Kill `bg-indigo-600`; primary CTA → `--primary`.
- **Ledger Masters** ([ledger-masters/page.tsx](src/app/(app)/ledger-masters/page.tsx)): Flagship of the data layer — compact density default, mono figures, sticky sortable header, bulk-approve action bar for mappings, filter chips, density/columns/export toolbar.
- **Exceptions:** the highest-stakes screen. Bulk review (checkbox → sticky approve/reject bar), `--warn` dot status, inline AI auto-suggestion surfaced à la Ramp ("suggested mapping" with one-tap accept), intentional friction on bulk-approve (count confirmation).
- **Upload:** multi-step with a real progress indicator + step labels, skeleton/processing states, drag-drop affordance (react-dropzone already present), clear success/error with recovery path.
- **Batches:** DataTable + status dots + drill-in to `dev/trace`. Mono timestamps and IDs.
- **Settings:** comfortable density, `1120px` width, grouped fieldsets, autosave drafts on long forms.
- **Marketing** (`(marketing)`): keep 16px body for readability; apply the same color/type tokens so brand is continuous from site → app. This is where the brand blue `--accent-cyan` and navy can be more expressive.

---

## 8. Drop-in token foundation (Tailwind v4 + shadcn)

Replace the `:root` / `.dark` blocks in [globals.css](src/app/globals.css) with this. Tailwind v4 `@theme inline` mappings mostly stay; the *values* change and the three-blues drift is removed. (Exact hexes are the spec from §3; tune in-browser against real screens.)

```css
:root {
  /* Brand */
  --brand:        #0B1F33;
  --primary:      #1F5AE0;  --primary-hover: #1A4DC2;  --primary-foreground: #FFFFFF;
  --accent-cyan:  #2D9CDB;  /* info / data-viz / links ONLY — never a button */

  /* Financial semantics */
  --pos:  #0B815A;  --neg:  #C8324B;  --warn: #B45309;  --info: #1F5AE0;

  /* Navy-tinted neutrals */
  --bg: #FBFCFE;  --surface: #FFFFFF;  --surface-2: #F4F6FA;
  --hairline: #E5E9F0;  --hairline-strong: #CBD3E0;
  --ink: #0B1F33;  --ink-2: #475569;  --ink-3: #7A8699;

  /* shadcn aliases (so existing components keep working) */
  --background: var(--bg);          --foreground: var(--ink);
  --card: var(--surface);           --card-foreground: var(--ink);
  --popover: var(--surface);        --popover-foreground: var(--ink);
  --primary-foreground: #FFFFFF;
  --secondary: var(--surface-2);    --secondary-foreground: var(--ink);
  --muted: var(--surface-2);        --muted-foreground: var(--ink-2);
  --accent: var(--surface-2);       --accent-foreground: var(--ink);
  --destructive: var(--neg);
  --border: var(--hairline);        --input: var(--hairline-strong);
  --ring: var(--primary);           /* ← was #1e4fd8; the fix */

  --radius: 0.5rem;                 /* 8px base; controls override to 6px */

  /* Elevation */
  --e1: 0 1px 2px rgba(11,31,51,.06), 0 1px 1px rgba(11,31,51,.04);
  --e2: 0 4px 12px rgba(11,31,51,.08), 0 2px 4px rgba(11,31,51,.05);
  --e3: 0 16px 40px rgba(11,31,51,.16), 0 4px 8px rgba(11,31,51,.06);
}

.dark {
  --brand: #0B1F33;
  --primary: #5B8DEF; --primary-hover: #74A1F2; --primary-foreground: #0A0E14;
  --accent-cyan: #39B0F0;
  --pos: #3DD68C; --neg: #FF6B81; --warn: #F0A742; --info: #5B8DEF;

  --bg: #0A0E14; --surface: #11161F; --surface-2: #161C27;
  --hairline: #222A38; --hairline-strong: #303A4C;
  --ink: #E7ECF4; --ink-2: #9AA6B8; --ink-3: #697587;

  --background: var(--bg);          --foreground: var(--ink);
  --card: var(--surface);           --card-foreground: var(--ink);
  --popover: var(--surface);        --popover-foreground: var(--ink);
  --secondary: var(--surface-2);    --secondary-foreground: var(--ink);
  --muted: var(--surface-2);        --muted-foreground: var(--ink-2);
  --accent: var(--surface-2);       --accent-foreground: var(--ink);
  --destructive: var(--neg);
  --border: var(--hairline);        --input: var(--hairline-strong);
  --ring: var(--primary);

  --e1: 0 1px 0 rgba(0,0,0,.4);
  --e2: 0 8px 24px rgba(0,0,0,.5);
  --e3: 0 24px 60px rgba(0,0,0,.6);
}
```

Then wire a **theme toggle** (the `.dark` class is already supported via `@custom-variant dark`) and a **density attribute** (`data-density="compact|comfortable"`) at the table-wrapper level. Add tabular figures globally:

```css
.tabular { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
.mono-data { font-family: var(--font-geist-mono); font-variant-numeric: tabular-nums; }
```

---

## 9. Implementation plan (phased — each phase shippable)

**Phase 1 — Foundations (highest ROI, ~½ day).** Swap the token blocks above; global find-and-replace `indigo-*` → `--primary`/Button; replace `gray-*` neutrals with the tinted ramp; apply `e1` to Card, fix Input focus. *Result: the "three blues" and gray-anonymity problems vanish app-wide with near-zero structural change.*

**Phase 2 — Numbers & the data layer.** Build the `DataTable` wrapper + density toggle; route every figure through `mono-data` + tabular; status dots; sticky sortable headers. Apply to ledger-masters first (flagship), then exceptions, batches. *Result: instantly "proprietary fintech."*

**Phase 3 — Shell.** Light sidebar refinement, new topbar with FY/company switcher, ⌘K command palette, theme + density toggles. *Result: the "elite tool" frame.*

**Phase 4 — Dark mode + motion + polish.** Audit dark contrast against real screens, add skeletons, motion tokens, reduced-motion, empty/error states. *Result: dark mode becomes a headline feature instead of a template default.*

**Phase 5 — Marketing alignment + typography upgrade.** Optionally adopt Geist Sans for display; carry tokens into `(marketing)`; final a11y pass (contrast, focus order, keyboard, `aria-sort`/`aria-live`).

> TDD note (per project standards): the `DataTable`, `StatRow`, and `CommandPalette` primitives each need behavior tests (sort state, density persistence, selection, empty/error rendering) written alongside, not after.

---

## 10. Guardrails — the anti-patterns that re-cheapen a UI

- ❌ Raw `indigo-*` / `bg-blue-600` / one-off hexes in components — **only tokens**.
- ❌ Pure `gray-*` neutrals — use the tinted ramp.
- ❌ `border` + `shadow-md` sprinkled by hand — use the 4-step elevation scale.
- ❌ Proportional figures in tables — every number is tabular/mono.
- ❌ Color-only status — always dot/icon + label.
- ❌ More than one primary CTA per screen.
- ❌ Spinners for >300ms loads — skeletons.
- ❌ Default grayscale dark mode — tinted near-blacks only.
- ❌ Emoji as icons — Lucide, one stroke width.

---

## Sources

- [Razorpay brand colors & Blade design system](https://designsystems.surf/design-systems/razorpay) · [brand palette](https://brandpalettes.com/razorpay-logo-colors/) · [organising design systems](https://medium.com/razorpay-design/organising-design-systems-3f191c4e00c0)
- [Mercury design system tokens](https://www.shadcn.io/design/mercury) · [Mercury: cinematic sophistication in banking](https://blakecrosley.com/guides/design/mercury)
- [Fintech design in 2026: why most apps look the same (and what works)](https://www.themasterly.com/blog/fintech-design-guide)
- [SaaS dashboard design patterns 2026](https://www.925studios.co/blog/saas-dashboard-design-examples-2026) · [Ramp/Stripe/Linear density patterns]
- TradeBooks current-state audit: [globals.css](src/app/globals.css), [layout.tsx](src/app/(app)/layout.tsx), [button.tsx](src/components/ui/button.tsx), [card.tsx](src/components/ui/card.tsx), [dashboard/page.tsx](src/app/(app)/dashboard/page.tsx), [ledger-masters/page.tsx](src/app/(app)/ledger-masters/page.tsx)
- UI/UX Pro Max `--design-system` (fintech/B2B/data-dense) recommendation
