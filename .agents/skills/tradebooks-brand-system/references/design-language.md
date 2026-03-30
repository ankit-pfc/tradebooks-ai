# Design Language — Tradebooks AI

This document captures Tradebooks AI's practical UI token philosophy and implementation cues for both the marketing landing page and the app shell.

## Token Philosophy

Design should communicate:
- precision and reliability,
- professional trust (like financial software, not a consumer app),
- data clarity over decoration,
- modern fintech competence.

## Color System

### Foundation
- `--background: 215 35% 8%` (deep navy — professional, not black)
- `--foreground: 210 20% 95%` (crisp off-white)

### Surfaces
- `--card: 215 30% 12%` (slightly elevated dark panel)
- Borders: `1px solid` with low-opacity white (e.g., `rgba(255,255,255,0.08)`) — no heavy glow effects

### Actions
- `--primary: 185 75% 45%` (teal/cyan — precision and clarity)
- `--primary-hover: 185 80% 50%`

### Semantic States (critical — financial tool)
- `--success: 142 70% 45%` (financial green — reconciled, exported, complete)
- `--warning: 38 90% 55%` (amber — exceptions, unmatched trades, needs review)
- `--error: 0 80% 55%` (red — parse failure, invalid format, critical error)
- `--info: 210 80% 55%` (blue — processing, in-progress)

### Supporting Tokens
- `--accent: 220 60% 60%` (soft blue accent for secondary labels and chips)
- `--muted: 215 20% 35%` (muted text for metadata, timestamps)
- `--border: 215 20% 18%` (subtle panel borders)

## Typography

### Families
- Primary: `Inter` (headings + body) — precision, legibility
- Mono: `JetBrains Mono` or `Fira Code` (file names, data previews, code snippets)
- No serif fonts anywhere in the product or marketing

### Usage Rules
- Weight 700 for primary headlines.
- Weight 500–600 for section headings and UI labels.
- Weight 400 for body copy and supporting detail.
- Mono for: `tradebook.csv`, `tally-output.xml`, trade counts, and any raw data references.
- Never use decorative type or mixed font families.

### Scale
- Display: 48–64px (landing hero)
- H1: 36–40px
- H2: 24–28px
- Body: 16px / Line height 1.6
- Small/caption: 13–14px

## Shape, Spacing, and Surface

- Base radius: `--radius: 0.5rem` (sharper than lifestyle brands — conveys precision)
- Card radius: `0.75rem`
- Button radius: `0.375rem` (slightly squared — professional)
- Generous vertical section rhythm on landing pages.
- Compact but readable spacing in app tables and batch lists.
- No round "pill" buttons for primary CTAs — slightly rectangular reads as more professional.

## Motion & Effects

### Allowed motion
- Upload progress bar (functional animation),
- Processing state spinner,
- Subtle hover lift on cards (`transform: translateY(-2px)`),
- Fade-in on scroll for landing page sections (once only, not on repeat scroll).

### Do not use
- Float/pulse decorative animations,
- Heavy parallax effects,
- Gradient shimmer backgrounds,
- Confetti or celebration effects (a financial compliance tool is not a game).

## Imagery Direction

Preferred visuals:
- UI screenshots of the actual product (upload flow, batch dashboard, export preview),
- Abstract data visualization imagery (grids, tables, flow diagrams),
- Clean technical diagrams showing the pipeline: broker export → processing → Tally XML.

Avoid:
- Generic stock photos of people on laptops,
- Abstract "AI brain" imagery,
- Anything that looks like a consumer fintech app (e.g., colorful charts, coin icons).

## Accessibility Baselines

- Maintain WCAG AA contrast on all dark surfaces.
- Semantic state colors (success/warning/error) must never convey meaning through color alone — always pair with icon or label.
- Keyboard/focus visibility required for all interactive elements.
- Respect `prefers-reduced-motion` on all animated components.
- Tables and data grids must have proper ARIA roles and column headers.
