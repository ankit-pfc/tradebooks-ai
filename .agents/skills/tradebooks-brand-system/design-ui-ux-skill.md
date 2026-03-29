# Design UI/UX Skill Companion — Tradebooks AI Brand System

Use this companion when the request requires **implementation-grade UI/UX direction** (layout, hierarchy, components, copy density, and interaction behavior), not just strategic brand framing.

## Core Intent

Translate Tradebooks AI's accuracy-first professional brand into usable product and marketing interfaces that feel:
- precise and trustworthy,
- data-dense but readable,
- professionally competent,
- modern fintech without startup excess.

## Decision Hierarchy

1. **Data clarity** over decorative design.
2. **Mechanism transparency** over feature-list hype.
3. **Single primary user action** over multiple competing asks.
4. **Professional pacing** over attention-grabbing animations.

## Interface Heuristics

### Layout
- Prefer clean section boundaries with clear visual hierarchy.
- Use strong fold-level structure: each section answers one user question.
- Data-dense displays (e.g., batch tables, exception lists) are appropriate in-app but not on landing pages — landing pages should stay clean and scannable.
- Generous whitespace for marketing surfaces; compact efficiency for app surfaces.

### Typography
- Display sans-serif (Inter, Outfit, or similar) for headlines — conveys precision over tradition.
- Same family lighter weight for body copy.
- Monospace for any file names, data snippets, or code references (e.g., `tradebook.csv`, `tally-output.xml`).
- No decorative or serif fonts — this is a professional tool, not a consumer lifestyle brand.

### Color & Surfaces
- Deep navy/slate base (`#0D1B2A` range) with teal/cyan primary action.
- Financial green (`#22c55e` range) for success states: successful upload, completed export, reconciled batch.
- Amber/orange for warnings: unmatched trades, exceptions needing review.
- Red for errors strictly: failed parse, invalid file format.
- Card surfaces: dark elevated panels with subtle borders, no heavy gradients.

### Motion
- Progress bars and upload state transitions: purposeful and informative.
- Hover: subtle lift on clickable cards.
- No decorative float/pulse animations on landing pages — they undermine the professional tone.
- Processing state: a simple spinner or progress indicator communicates reliability, not spectacle.

### Conversion UX
- Primary CTA is "Upload Tradebook" or "Start Free" — direct action, not vague.
- Secondary links are educational ("See how it works", "View sample output").
- Proof appears before hard signup asks.

## Anti-Patterns to Avoid

- "AI-powered" claims without mechanism explanation.
- Vague benefit statements that don't reference actual output (Tally XML, voucher entries, etc.).
- Multiple equally loud CTAs in one viewport.
- Overly animated landing pages that feel consumer-app rather than professional tool.
- Generic stock photos — use UI screenshots, sample outputs, or abstract data visualizations instead.

## Output Template (Implementation-Ready)

When asked for UI direction, return:

1. **Screen intent** (what this section/page must achieve)
2. **Hierarchy map** (headline, support, proof, action)
3. **Component stack** (ordered list)
4. **Token usage** (color/type/spacing/motion)
5. **Responsive notes** (mobile-first constraints)
6. **Accessibility checks** (contrast, focus, keyboard, semantics)

## Reference Dependencies

- `references/design-language.md`
- `references/landing-page-architecture.md`
- `references/component-patterns.md`
- `references/qa-scorecard.md`
