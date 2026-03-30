# Landing Page Playbook — Tradebooks AI

## Objective

Provide a canonical section sequence and conversion logic for the Tradebooks AI marketing homepage that can be replicated across audience variants without losing accuracy-first positioning.

## Canonical section order

1. **Hero**
2. **Immediate trust chips**
3. **Problem reframing / stakes**
4. **How it works (pipeline)**
5. **Feature pillars (mechanism proof)**
6. **Social proof and professional credibility**
7. **Pricing / plan fit**
8. **FAQ / objection handling**
9. **Final conversion section**

## Section intent and implementation notes

### 1) Hero
- Goal: name the exact problem (Zerodha data doesn't go into Tally without manual work) and position Tradebooks AI as the automated solution.
- Components: headline, subhead specifying the output (Tally XML, voucher entries), primary CTA ("Upload Tradebook" / "Start Free"), secondary CTA ("See sample output"), trust chips.
- Rule: primary CTA must be a direct action, not a vague invitation. "Upload Tradebook" is better than "Get Started".

### 2) Immediate trust chips
- Goal: kill first-scroll skepticism with specific, verifiable claims.
- Components: file format badges (Zerodha Console CSV), Tally version compatibility (TallyPrime / ERP 9), CA endorsement signal, data privacy note.

### 3) Problem reframing / stakes
- Goal: make the visitor feel seen by naming their exact pain — not generic "finance problems" but the specific hell of copying rows from a CSV into Tally vouchers.
- Components:
  - before/after comparison: "Today: 3 days / With Tradebooks AI: 10 minutes"
  - specific failure modes of manual entry: miscalculated cost basis, wrong P&L, ITR complications
- Tone: factual and empathetic — not exaggerated fear, not underselling the problem.

### 4) How it works (pipeline)
- Goal: reduce effort anxiety by showing the exact three-step process — and how minimal the user's effort is.
- Components: numbered 3-step flow with headline + one-sentence note each.
  1. **Upload** — Drag and drop your Zerodha Console CSV (tradebook, funds statement, or holdings).
  2. **Process** — The deterministic engine applies FIFO cost basis, classifies STCG/LTCG, handles corporate actions, flags exceptions.
  3. **Export** — Download Tally XML. Import directly into TallyPrime or ERP 9.
- Rule: frame each step around *user* effort, not engine complexity.

### 5) Feature pillars (mechanism proof)
- Goal: show *why* the output is reliable, not just that it exists.
- Components: 4–6 pillar cards with title + short explanatory copy (not bullet lists; short paragraphs convey more authority).
- Key pillars: FIFO Cost Basis Engine / STCG & LTCG Classification / Corporate Actions Handling / Exception Surface & Resolution / Tally Format Fidelity / Funds Statement Ingestion.

### 6) Social proof and professional credibility
- Goal: transfer trust through professional peer endorsements and volume signals.
- Components:
  - 2–3 testimonials: CA or experienced trader, name + role + specific outcome quote
  - quantified trust row: "X batches processed / Y trades reconciled" (when available)
  - logo row of CA firms or enterprises (when available)
- Rule: no generic praise. Every quote must reference a specific outcome: time saved, error eliminated, process improved.

### 7) Pricing / plan fit
- Goal: align the offer to the visitor's context so the buy decision is easy.
- Components: 2–3 plan cards (Individual / CA / Firm), per-batch or subscription pricing, feature list per plan, highlighted recommended plan, free entry tier with clear limits.

### 8) FAQ / objection handling
- Goal: remove the highest-friction conversion blockers with direct, specific answers.
- Key objections to address:
  1. **Fit**: "Does this work with my Zerodha account type? (equity / F&O / intraday?)"
  2. **Accuracy**: "How does FIFO work? What if I have bonus shares or splits?"
  3. **Compatibility**: "Which Tally version does the XML work with?"
  4. **Privacy**: "Is my trading data stored on your servers?"
  5. **Edge cases**: "What if I have unmatched trades or missing data?"
  6. **Expansion**: "Do you support Groww / Upstox / other brokers?"
- Rule: answers must be direct, specific, and honest — including current limitations.

### 9) Final conversion section
- Goal: summarize the value and drive action after trust is fully established.
- Components: one concise value recap sentence + single primary CTA + lightweight reassurance ("No credit card required. File deleted after export.").

## CTA logic

- Exactly one primary CTA intent per major section.
- Primary CTA: "Upload Tradebook" or "Start Free" (direct action verb + specific object).
- Secondary CTA: "See how it works" (anchor), "View sample output" (PDF/page), "Talk to Sales" (for CA/Firm tier).
- Don't switch CTA destination unpredictably across sections.

## Objection handling framework

Address in this sequence:
1. Fit ("Does this work for my specific Zerodha setup?")
2. Accuracy ("Can I trust the FIFO / STCG calculation?")
3. Compatibility ("Will the XML actually import into my version of Tally?")
4. Effort ("How much do I have to set up or configure?")
5. Risk / Privacy ("What happens to my data?")
6. Timing ("Is this ready now or still in beta?")

## Quality checks

- Can a trader who has never heard of this product explain what it outputs after reading the hero?
- Is the pipeline mechanism explained before any conversion ask?
- Does every proof claim reference a specific outcome, not a general benefit?
- Are there any conflicting or competing CTAs in the same viewport?
- Is every FAQ answer direct and specific — including honest current limitations?
