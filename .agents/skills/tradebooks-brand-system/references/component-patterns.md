# Component Patterns — Tradebooks AI

This reference defines reusable section and component behavior for Tradebooks AI's landing page and app shell.

## 1) Hero Pattern

### Role
Establish the pain → solution → action hierarchy in the first viewport.

### Required elements
- category/context badge (e.g., "Zerodha → Tally Reconciliation"),
- high-clarity headline (names the before/after explicitly),
- supporting paragraph (specifies the output: Tally XML, voucher entries),
- one primary CTA ("Upload Tradebook" / "Start Free"),
- one secondary CTA ("See sample output"),
- 2–3 trust micro-chips (e.g., "FIFO compliant", "Tally-ready XML", "Used by CAs").

### Notes
- Hero must name the exact problem: manual data entry between Zerodha and Tally.
- Do not lead with AI claims — lead with the output and its precision.

## 2) Trust Chips / Proof Rail Pattern

### Role
Kill first-scroll skepticism immediately after the hero.

### Structure
- 4–6 compact chips in a horizontal rail,
- each chip: icon + short claim.

### Example chips
- ✓ Zerodha-native (reads Console CSV format)
- ✓ TallyPrime & ERP 9 compatible
- ✓ FIFO cost basis — auditable rules
- ✓ CA-recommended
- ✓ No data stored after export
- ✓ STCG/LTCG auto-classified

## 3) Problem Reframing Pattern

### Role
Make the visitor feel seen; dramatize the cost of the current manual process.

### Structure
- before/after framing: "Currently: 3 days / With Tradebooks AI: 10 minutes",
- or pain points in a short 3-item list (manual entry error risk, time loss, CA revision cost),
- subtle emotional hook — frustration of tax season data work.

### Notes
- Keep it factual and empathetic, not dramatic or fear-mongering.

## 4) How It Works (Pipeline Steps) Pattern

### Role
Show the exact process so users understand the effort required of them is minimal.

### Structure
- 3 numbered steps with short headline + one-sentence explanation + icon:
  1. **Upload** — Drop your Zerodha tradebook CSV.
  2. **Process** — Engine applies FIFO, classifies STCG/LTCG, flags exceptions.
  3. **Export** — Download Tally XML, import directly.
- Optional: animated step-by-step reveal on scroll.

### Notes
- Keep step explanations user-effort–focused (what *they* do), not engine-focused.

## 5) Feature Pillars Pattern

### Role
Establish that the output is trustworthy by explaining the rules that govern it.

### Structure
- 4–6 pillar cards,
- each: title + 2–3 sentence explanation,
- no bullet overload — paragraph format reads more authoritative.

### Pillar titles (examples)
- FIFO Cost Basis Engine
- STCG / LTCG Auto-Classification
- Corporate Actions Handling
- Exception Surface & Resolution
- Tally XML Format Fidelity
- Funds Statement & Holdings Ingestion

## 6) Social Proof Pattern

### Role
Demonstrate trust through professional outcomes — CA recommendations and volume signals.

### Structure
- 2–3 testimonial cards with: name, role (CA / Senior Trader / Finance Lead), specific outcome quote,
- quantified trust row: "X batches processed", "Y trades reconciled" (when real numbers available),
- CA/firm logo row (if applicable).

### Notes
- Quote must reference a specific outcome, not generic praise.
- "Saved me 3 days every quarter" > "Amazing tool, very useful."

## 7) Pricing Pattern

### Role
Align the product to buyer context without creating confusion.

### Structure
- 2–3 plan cards (e.g., Individual Trader / CA / Firm),
- clear per-batch or subscription pricing,
- feature list per plan,
- most relevant plan visually highlighted.
- "Start Free" on the entry plan with clear limits stated.

## 8) FAQ Pattern

### Role
Remove the highest-friction conversion blockers with direct, specific answers.

### Key FAQ clusters to address
- **Compatibility**: Which Zerodha export formats? Which Tally versions?
- **Accuracy**: How is FIFO applied? What about corporate actions?
- **Data privacy**: Is my trading data stored? For how long?
- **Edge cases**: What if trades don't match? What about F&O / intraday?
- **Broker expansion**: Do you support Groww / Upstox / ICICI Direct?

### Notes
- Answers must be direct and specific — not hedged or corporate-speak.
- "We currently support Zerodha Console CSV. Groww and Upstox are on the roadmap (Q3 2025)." — this builds confidence.

## 9) Final Conversion Section Pattern

### Role
Re-ask with clarity after full trust has been established.

### Rules
- one dominant CTA ("Upload Your Tradebook"),
- concise value recap ("Your Zerodha tradebook, ready for Tally in minutes"),
- lightweight reassurance: "No credit card required. File deleted after export."

## 10) Global Component Patterns

### Header / Navigation
- Wordmark left, nav links center/right, primary CTA button (persistent).
- Nav items: How It Works / Pricing / Sample Output / For CAs.
- Avoid mega-menu complexity on V1.

### App Shell — Batch Dashboard
- Table-centric layout: batch name, date, trade count, status, export action.
- Status column uses semantic color chips: Processing (blue), Complete (green), Exceptions (amber), Failed (red).
- Row-level action: download XML, view exceptions, retry.

### App Shell — Upload Flow
- Drag-and-drop upload zone, prominent.
- File type validation visible: "Accepts Zerodha Console CSV (.csv)".
- After upload: processing progress indicator (not spinner — show step: Parsing → Computing → Building XML).
- Exception count surfaced clearly before export is unlocked.

### Mobile Sticky CTA
- Appears after initial scroll depth on landing page.
- Mirrors primary CTA: "Upload Tradebook".
- Dismissible. Does not obstruct content on small screens.
