# Replication Framework — Tradebooks AI

Use this framework when extending the Tradebooks AI brand system to new surfaces, product phases, or audience segments — without losing the core professional positioning.

## Step 1: Define Invariants vs Variables

### Invariants (Preserve Always)
- accuracy-first narrative (prove reliability before asking for action),
- domain-native language (FIFO, STCG/LTCG, voucher, ledger, tradebook, Tally XML),
- professional, direct tone — no startup hype, no vague AI claims,
- single-primary-CTA hierarchy per section,
- proof-before-hard-ask conversion logic,
- semantic state colors: green = success, amber = exception, red = error,
- accessibility and responsive discipline.

### Variables (Adapt per surface/audience)
- audience segment (individual trader vs CA vs prop desk),
- CTA wording (Upload Tradebook / Start Free / Request a Demo),
- proof type (trader testimonials vs CA firm case study),
- pricing plan emphasis (individual vs firm tier),
- feature emphasis (FIFO engine vs exception handling vs bulk batch processing),
- supported broker set (expands as product grows),
- file format mentions (CSV-only → more formats over time).

## Step 2: Create Brand Direction Brief

For any new surface or campaign, specify:
1. Target audience segment and their specific pain point
2. Primary conversion action for this surface
3. Key objections this surface must resolve
4. Which invariants apply and which variables are being adapted
5. Proof types available for this audience

## Step 3: Build IA Blueprint

Map page/screen sections using Tradebooks AI's sequence logic:
- **problem acknowledgment** (makes the visitor feel seen),
- **mechanism clarity** (how the pipeline works),
- **reliability proof** (why the output is trustworthy),
- **professional endorsement** (CA or trader social proof),
- **offer alignment** (right plan for this visitor),
- **conversion** (one clear action),
- **objection resolution** (FAQ — specific not generic).

## Step 4: Assign Component Patterns

For each section, choose:
- component type (from `component-patterns.md`),
- copy depth (headline-only vs explanatory paragraph vs step list),
- data/visual style (pipeline diagram, feature card, testimonial, table),
- CTA priority (primary, secondary, or none).

## Step 5: Token Translation

Keep design intent stable while adapting for context:
- landing page: clean sections, generous spacing, clear visual hierarchy,
- app shell: compact, data-dense, efficient — same color system, tighter spacing,
- email / PDF exports: adapt palette for light-mode readability, maintain mono font for data.

Rule:
- preserve the navy/teal/semantic-state color system (financial credibility),
- never introduce decorative palette elements that soften the professional tone.

## Step 6: Conversion Logic Check

Verify:
- one clear primary action per section,
- mechanism explained before conversion ask,
- proof integrated before closing CTA,
- FAQ addresses the top objections for this specific audience.

## Step 7: QA Against Scorecard

Run `qa-scorecard.md` before launch or before handing off to engineering.

## Common Failure Modes

- Using vague AI language when the engine is deterministic and rule-based.
- Pushing signup/upload CTA before explaining how the FIFO/export pipeline works.
- Introducing pricing before the mechanism is understood.
- Using consumer-app visual language (colorful icons, round buttons, emojis) on a professional tool.
- Writing proof that is too generic ("saves time") vs too specific and useful ("saved 3 days of data entry per quarter").
- Ignoring the CA audience segment — they are high-leverage buyers who evaluate tools on behalf of multiple clients.
