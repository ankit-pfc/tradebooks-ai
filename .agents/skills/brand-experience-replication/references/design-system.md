# Design System Profile (Canonical Reference: Tradebooks AI)

## Purpose

Translate Tradebooks AI's brand intent into implementable visual and interaction rules for all product and marketing surfaces.

## Design principles

1. Precision over decoration — every visual decision should reinforce trust in the data
2. High readability in dark-theme dominant surfaces (app shell and landing page)
3. Semantic clarity — color conveys meaning (success/warning/error/processing), not just style
4. Consistent spacing rhythm and professional geometry (sharp-to-minimal radius)
5. Purposeful motion only — interaction feedback, not spectacle

## Token categories to extract or define

### Color roles (semantic)
- `bg.base` — deep navy primary page background (`hsl(215, 35%, 8%)`)
- `bg.elevated` — cards, panels (`hsl(215, 30%, 12%)`)
- `surface.border` — subtle panel borders (`rgba(255,255,255,0.08)`)
- `text.primary` — crisp off-white (`hsl(210, 20%, 95%)`)
- `text.secondary` — muted for metadata, timestamps (`hsl(215, 15%, 55%)`)
- `brand.primary` — teal/cyan CTA color (`hsl(185, 75%, 45%)`)
- `brand.accent` — soft blue for chips and accents (`hsl(220, 60%, 60%)`)
- `state.success` — financial green for completed/reconciled (`hsl(142, 70%, 45%)`)
- `state.warning` — amber for exceptions/unmatched (`hsl(38, 90%, 55%)`)
- `state.error` — red for failures (`hsl(0, 80%, 55%)`)
- `state.info` — blue for processing/in-progress (`hsl(210, 80%, 55%)`)

### Typography
- Display/heading: Inter 700 for hero + major headings
- Body: Inter 400 for readable explanation
- Microcopy/labels: Inter 500, 13–14px
- Monospace: JetBrains Mono or equivalent for file names, data field names, format references (`tradebook.csv`, `tally-output.xml`)

### Spatial system
- Section vertical rhythm (landing): 80–120px top/bottom
- Section vertical rhythm (app): 24–40px
- Component internal spacing: 16px (sm), 24px (md), 40px (lg)
- Grid: 12-column, max-width 1200px, 16px gutters on mobile, 24px on desktop

### Shape and depth
- Button radius: `0.375rem` (professional, not pill-shaped)
- Card radius: `0.75rem`
- Badge/chip radius: `0.375rem`
- Shadow: single-level soft shadow for elevated cards; no stacked glow effects
- No blur/glass effects on primary surfaces (undermines data density readability)

### Motion and interaction
- Hover: subtle lift (`translateY(-2px)`) on clickable cards
- Press: slight scale-down (`scale(0.98)`) on buttons
- Focus: visible ring in brand.primary color
- Scroll reveal: simple fade-up, once per viewport entry (not replay on scroll)
- Upload progress: step-labeled progress bar (not just a spinner)
- Processing state: "Parsing → Computing → Building XML" step indicators

## Component behavior patterns

### Hero (landing page)
- Clear pain → solution → action structure
- One primary CTA + one secondary ("see sample output")
- Trust chips within hero viewport distance

### Header/navigation (landing)
- Wordmark + nav items + sticky primary CTA button
- Nav: How It Works / Pricing / Sample Output / For CAs
- No mega-menu in V1

### Batch dashboard (app)
- Table with: Batch Name, Date, Status chip, Trade Count, Actions
- Status chips use semantic colors (green/amber/red/blue)
- Row action: Download XML / View Exceptions / Retry
- Empty state: clear upload prompt, not a blank grid

### Status chips / badges
- Semantic color required
- Always icon + label (never color-only)
- Processing (blue) / Complete (green) / Exceptions (amber) / Failed (red)

### Trust chips (landing)
- Icon + concise specific claim
- Horizontal scrollable rail on mobile

### Educational / mechanism blocks
- Explain the rule or process step, not just the feature name
- "FIFO cost basis: each holding lot is tracked individually with its purchase date and price." — this builds trust through transparency

### Social proof module
- Testimonial: name + role + specific outcome quote
- Quantified signals: batch/trade counts (when real)
- Logos: CA firm logos or enterprise client logos (when available)

### Conversion section (landing)
- Single CTA, outcome-oriented value recap, lightweight reassurance
- "No credit card required. Your file is deleted after export."

## Art direction

- Product UI screenshots preferred over abstract imagery
- Pipeline diagrams (simple: CSV → engine → XML) for mechanism clarity
- Avoid stock photos of people; use data visualizations or clean process illustrations
- Keep visual language consistent with the dark professional palette

## Accessibility and quality floor

- WCAG AA contrast on all dark surfaces
- Never convey state through color alone (always icon + label + color)
- Readable line-length (60–80ch) and minimum 16px body font
- Visible keyboard focus states throughout
- `prefers-reduced-motion` respected — no motion on upload states for users with this preference
- Data tables: proper `<th scope>`, `aria-label`, and keyboard navigation
