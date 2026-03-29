# Landing Page Architecture — Tradebooks AI

Tradebooks AI's canonical conversion-first fold logic for the marketing homepage.

## Canonical Fold Sequence

1. **Hero** — Problem + Solution + Primary CTA
2. **Immediate Trust Chips** — CA endorsements, file format badges, accuracy claim
3. **Problem Reframing** — The pain of manual reconciliation
4. **How It Works** — Upload → Process → Export pipeline (3 steps)
5. **Feature Pillars** — What makes the output reliable
6. **Social Proof** — CA testimonials + volume signals
7. **Pricing / Plan Fit**
8. **FAQ / Objection Handling**
9. **Final Conversion Section**

## Section Purpose Rules

### 1) Hero
Goal:
- immediately address the pain (Zerodha data doesn't go into Tally without manual work),
- present Tradebooks AI as the automated solution,
- one clear primary CTA ("Upload Tradebook" or "Start Free").

Must include:
- headline that names the before/after clearly,
- subhead that specifies the output (Tally XML, vouchers, ledger entries),
- primary CTA + secondary CTA ("See sample output"),
- trust micro-chips (e.g., "Zerodha-native", "100% Tally-compatible", "Used by CAs").

Must avoid:
- vague AI claims in the hero,
- feature lists before pain acknowledgment.

### 2) Immediate Trust Chips
Goal:
- neutralize first-scroll skepticism fast.

Components:
- file format badges (`.csv`, `.xlsx` accepted),
- Tally compatibility badge (TallyPrime / Tally ERP 9),
- CA trust signal ("Recommended by Chartered Accountants"),
- data security note (no data stored / encrypted in transit).

### 3) Problem Reframing
Goal:
- make the visitor feel seen; articulate the exact cost of the current manual process.

Key messages:
- "Every tax season, traders spend days cross-referencing tradebooks, calculating P&L, and manually entering vouchers into Tally."
- "One Error in 500 rows means re-checking everything."
- Tradebooks AI eliminates this entirely.

### 4) How It Works (Pipeline)
Goal:
- lower effort anxiety by showing the exact 3-step process.

Steps:
1. **Upload** — Drop your Zerodha tradebook CSV / funds statement / holdings export.
2. **Process** — The engine applies FIFO cost basis, classifies STCG/LTCG, handles corporate actions.
3. **Export** — Download Tally XML, ready to import directly into your company ledger.

Visual: horizontal step flow or vertical numbered list with icons.

### 5) Feature Pillars
Goal:
- explain *why* the output is reliable, not just that it works.

Pillar examples:
- **FIFO Cost Basis Engine** — deterministic, auditable, per-share tracking.
- **STCG / LTCG Classification** — automatic holding period calculation per trade.
- **Corporate Actions Support** — splits, bonuses, rights issues handled correctly.
- **Exception Handling** — unmatched trades surfaced clearly, not silently dropped.
- **Tally Format Fidelity** — voucher type, ledger names, and narrations match Tally's import schema.

### 6) Social Proof
Goal:
- transfer trust through real professional endorsements and volume signals.

Components:
- 2–3 CA or experienced trader testimonials (outcome-specific, not generic praise),
- quantified signals: "X batches processed", "Y trades reconciled",
- CA logo row if applicable.

Rule: proof claims must be verifiable and specific. No "game-changing" or "revolutionary" language.

### 7) Pricing / Plan Fit
Goal:
- align the product to the visitor's context (individual trader vs CA firm).

Structure:
- clear plan cards with per-batch or subscription framing,
- what each plan includes (file limits, support, batch history),
- highlight the most suitable plan for primary audience.

### 8) FAQ / Objection Handling
Goal:
- neutralize the highest-friction questions before the final CTA.

Key FAQ topics:
- "Will this work with my Zerodha account?" (Yes, uses Console CSV format)
- "Is my data stored on your servers?" (Privacy / security answer)
- "What if I have corporate actions or rights issues?" (Handled — here's how)
- "What Tally version does the XML work with?" (TallyPrime and ERP 9)
- "What if some trades don't match?" (Exception report — you resolve before export)
- "Do you support other brokers?" (Zerodha first; roadmap for others)

### 9) Final Conversion Section
Goal:
- summarize value, re-ask with clarity after trust is established.

Components:
- concise value recap (one sentence),
- single primary CTA ("Upload Your Tradebook"),
- lightweight reassurance: "No credit card required. Data deleted after export."

## CTA Hierarchy

- One primary CTA repeated consistently: header, hero, final conversion block, mobile sticky.
- Primary: "Upload Tradebook" or "Start Free" (direct action).
- Secondary CTAs route to: "See sample output", "View pricing", "How it works" (anchor link).

## Navigation Logic

Top-level nav should reflect the professional buyer's mental model:
- How It Works
- Pricing
- Sample Output (link to a demo/example XML)
- For CAs (landing page variant)

## Structural Guardrails

- Don't introduce pricing before the mechanism is understood.
- Don't place FAQ above social proof.
- Don't use vague AI language in the hero — specificity builds trust for financial tools.
- Don't overcrowd the hero with more than two CTAs.
