# MKT-01 — Product Marketing Context Foundation

## Mission
Define TradeBooks AI’s foundational market context so all downstream marketing/CRO work uses one shared truth.

## Depends on
- None

## In scope
- ICP definition (primary + secondary)
- JTBD
- positioning statement
- messaging pillars
- objections and responses
- anti-persona
- customer language bank

## Out of scope
- UI implementation in app routes
- pricing page code changes

## Read first
- `AGENTS.md`
- `docs/marketing/00-agent-execution-plan.md`
- `docs/marketing/TASK-LIST.md`
- `docs/execution/01-marketing-shell.md`
- `docs/execution/02-public-pages-seo.md`
- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/layout.tsx`
- `src/app/(app)/upload/page.tsx`

---

## 1) Product category and one-line description

**Category:** Zerodha-to-Tally accounting workflow software (broker-export reconciliation and Tally XML generation).

**One-line description:** TradeBooks AI helps Indian accountants convert Zerodha exports into reconciled, Tally-importable XML with exception visibility, reducing manual posting work.

---

## 2) ICP profiles (primary + secondary)

### Primary ICP — CA firms and practicing accountants (India)
- **Who they are:** Chartered accountants and accounting teams managing multiple client books with Zerodha activity.
- **Current workflow:** Pull tradebook/funds/holdings/contract files, normalize in spreadsheets, manually pass accounting entries in Tally, then re-check during closing/audit.
- **Pain intensity:** Very high during month-end, quarter-end, and return/audit season.
- **Buying motivation:** Save repetitive posting time, reduce reconciliation misses, improve audit confidence across many client files.
- **Success metric they care about:** Faster monthly close per client book with fewer corrections.

### Secondary ICP A — In-house accounting teams (SMEs/family offices)
- **Who they are:** Small finance/account teams maintaining internal books where founders/treasury use Zerodha.
- **Pain:** Limited bandwidth, heavy dependency on one accountant, high risk of month-end backlog.
- **Motivation:** Standardized process and predictable bookkeeping cycle.

### Secondary ICP B — Advanced self-filers / active traders
- **Who they are:** Individuals who maintain cleaner books before CA handoff.
- **Pain:** Year-end scramble, inconsistent records, uncertainty in postings.
- **Motivation:** Stay organized through the year and reduce CA cleanup effort.

---

## 3) Core JTBD + switching dynamics

### Core JTBD
When I need to reflect Zerodha trading/investment activity in Tally, help me convert broker exports into reconciled, import-ready accounting entries so I can close books faster with fewer manual errors.

### Switching dynamics (Push / Pull / Habit / Anxiety)

#### Push (why move away from current method)
- Manual entry takes too long across clients and periods.
- Spreadsheet-led reconciliation is fragile and person-dependent.
- Errors surface late (audit/filing time), creating rework pressure.

#### Pull (why move to TradeBooks AI)
- Zerodha-first input flow aligned to existing source files.
- Reconciliation + exception visibility before export.
- Tally-importable XML output for practical downstream usage.

#### Habit (what keeps users in old process)
- Existing spreadsheet templates and staff routines.
- “We already know this process” comfort despite inefficiency.
- Concern that new tools may break edge-case handling.

#### Anxiety (what may block adoption)
- Fear of incorrect accounting treatment in generated output.
- Fear of losing audit traceability.
- Concern about setup effort and team retraining.

---

## 4) Positioning statement

For Indian CAs and accountants who need to post Zerodha activity in Tally, TradeBooks AI is a Zerodha-first accounting workflow that parses broker exports, reconciles entries, and generates Tally-importable XML with traceable exceptions—so teams spend less time on manual posting and more time on review and closure.

---

## 5) Top 5 message pillars

1. **Zerodha-first workflow, built for real input files**  
   Start from the exports accountants already receive/use (tradebook-led, with optional funds/holdings/contract context).

2. **Reconcile before import**  
   Identify mismatches and exceptions before entries land in Tally.

3. **Tally-focused outputs**  
   Generate Tally-importable XML artifacts designed for practical accounting workflows.

4. **Traceable, review-friendly process**  
   Keep generated outputs tied to source context to support review and audit conversations.

5. **Reduce manual posting burden**  
   Shift accountants from repetitive data entry to exception review and control.

> Messaging guardrail: avoid claiming fully automated end-to-end production operations until backend wiring is fully live across upload/process/export in production.

---

## 6) Top 5 objections and handling responses

1. **Objection:** “We already do this in Excel; why change?”  
   **Response:** Keep your existing source exports, but replace repetitive posting/reconciliation steps with a structured Zerodha-to-Tally workflow that reduces manual effort and late-stage error discovery.

2. **Objection:** “Can I trust generated entries?”  
   **Response:** TradeBooks AI is designed around reconciliation and exception surfacing before export, so teams can review and validate rather than blindly import.

3. **Objection:** “Will this work for our exact accounting treatment?”  
   **Response:** The workflow supports investor vs trader accounting mode and Tally company-context setup, enabling controlled output aligned to common Indian accounting patterns.

4. **Objection:** “Will this handle all brokers?”  
   **Response:** V1 is intentionally Zerodha-first. This focus improves reliability for the highest-priority workflow instead of offering shallow multi-broker support.

5. **Objection:** “We don’t want a long implementation project.”  
   **Response:** The intended entry path is lightweight: configure, upload Zerodha exports, review exceptions, export XML. No heavy process overhaul is required to get value.

---

## 7) Anti-persona definition

### Not ideal for V1
- Teams needing immediate multi-broker ingestion on day one.
- Enterprises expecting deep ERP-wide integrations and custom workflows before initial value.
- Buyers who want zero review/zero exceptions and are unwilling to validate outputs.
- Casual users with very low trade volume where manual entry is not a material pain.

---

## 8) Customer language bank (use vs avoid)

### Phrases to use
- “Zerodha exports to Tally-importable XML”
- “Reconcile before import”
- “Review exceptions, then export”
- “Reduce manual posting”
- “Built for Indian CAs and accountants”
- “Investor and trader mode”
- “Audit-traceable workflow”

### Phrases to avoid
- “Fully autonomous accounting”
- “Zero review needed”
- “Guaranteed error-free books”
- “All brokers supported” (for V1 messaging)
- “One-click close for every scenario”
- “Production-proven at scale” (unless evidence is documented)

---

## Definition of done
- Positioning is clearly Zerodha-first and Tally-focused
- No claims exceed current V1 reality
- Document is usable by all other tasks without re-asking fundamentals
