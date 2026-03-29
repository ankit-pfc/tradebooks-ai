# Session 5 Handoff — Phase 2 Complete, Phase 3 Ready for Next Agent

**Date:** 2026-03-28
**Branch:** `feat/design-evolution`
**Tests:** 307 passing (47 new in this session) | Build: clean | Lint: 0 new warnings
**State:** Phase 2 fully delivered. Phase 3 EventType enum additions done, no functional code yet.

---

## What Phase 2 Delivered

### New Files
| File | Purpose |
|------|---------|
| `src/lib/engine/charge-allocator.ts` | Proportional per-trade charge allocation from aggregate CN charges. Brokerage uses per-unit from CN row; all others proportional by `|qty × gross_rate|`. Remainder correction on last trade. |
| `src/lib/engine/trade-matcher.ts` | 3-pass tradebook↔CN matching: EXACT (trade_no==trade_id), HIGH (order_no+qty+date), APPROXIMATE (date+security+direction+qty+price±0.05). Returns `TradeMatchResult` with confidence levels. |
| `src/lib/engine/__tests__/charge-allocator.test.ts` | 9 tests |
| `src/lib/engine/__tests__/trade-matcher.test.ts` | 9 tests |
| `src/lib/engine/__tests__/canonical-events-cn.test.ts` | 15 tests |
| `src/lib/engine/__tests__/pipeline-multifile.integration.test.ts` | 7 tests |
| `src/lib/reconciliation/__tests__/checks-cn.test.ts` | 7 tests |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/engine/canonical-events.ts` | Added `contractNoteToEvents()`, `pairContractNoteData()`, `buildSecurityIdFromDescription()`. Refactored `buildCanonicalEvents()` from positional args to `BuildCanonicalEventsOpts` object. Dedup: CN trade events preferred over tradebook (matched by trade_no==trade_id). |
| `src/lib/engine/voucher-builder.ts` | Charge index now keys by `date|security|trade_no` when `external_ref` present (trade-level precision for CN flow); falls back to `date|security` for tradebook-only. |
| `src/lib/reconciliation/checks.ts` | New `checkContractNoteChargeReconciliation()` and `checkTradeMatch()`. `runFullReconciliation()` accepts optional `contractNoteCharges` and `tradeMatchResult`. |
| `src/app/api/process/route.ts` | Full rewrite: accepts multiple files via `form.getAll('files')` (backward-compat with `form.get('file')`). Detects/parses tradebook, contract_notes, funds_statement. Response includes `filesSummary`, `chargeSource`, `matchResult`. |
| `src/lib/parsers/zerodha/types.ts` | Added `tradesPerSheet: number[]` to `ContractNoteParseResult`. |
| `src/lib/parsers/zerodha/contract-notes.ts` | Populates `tradesPerSheet` during parsing. |

### Key Architecture Decisions
- **CN events preferred over tradebook:** When both files cover the same trade, CN events win (richer data: trade_no, per-unit brokerage, contract_note_ref). Dedup by `trade_no==trade_id`.
- **Charge allocation:** Brokerage is per-unit (`brokerage_per_unit × qty`). All other charges proportional by trade value. Remainder correction ensures exact sum.
- **Sheet pairing:** CN parser now returns `tradesPerSheet[]` so the engine can pair flat trade arrays with their charge date via `pairContractNoteData()`.
- **GST consolidation:** CGST + SGST + IGST → single `GST_ON_CHARGES` event per trade.
- **`buildCanonicalEvents()` signature:** Now accepts `BuildCanonicalEventsOpts` object — all callers updated.

---

## Phase 3 Work-in-Progress (for next agent)

### Already Done
- `EventType` enum expanded with 6 new values (`events.ts:25-31`):
  - `TDS_ON_DIVIDEND`, `TDS_ON_SECURITIES` (for 3a)
  - `BONUS_SHARES`, `STOCK_SPLIT`, `RIGHTS_ISSUE`, `MERGER_DEMERGER` (for 3b)
- No functional code for these yet — just the enum definitions. Tests pass, build clean.

### NOT Done (all functional Phase 3 work)

---

## Phase 3 Spec: What the Next Agent Must Build

### Remaining Phases Overview

| Phase | Scope | Est. Effort |
|-------|-------|-------------|
| **3a** | TDS on dividends | 3-4 days |
| **3b** | Corporate actions (bonus, split, rights, merger) | 4-5 days |
| **3c** | Off-market transfers & auction adjustments | 2-3 days |
| **4** | Test coverage catchup (~30% → ~85%) | 2 parallel agents |
| **5** | Settings persistence + multi-FY support | 2 parallel agents |

---

### 3a — TDS on Dividends (start here — highest ROI)

**What already exists (DO NOT rebuild):**
- `TDS_ON_DIVIDEND` and `TDS_ON_SECURITIES` in `EventType` enum ✅ (done this session)
- TDS ledger constants: `L.TDS_ON_DIVIDEND`, `L.TDS_ON_SECURITIES` in `ledger-names.ts:328-345`
- TallyProfile fields: `tdsOnDividend`, `tdsOnSecurities` in `accounting.ts:184-186`
- Both profiles map TDS: `accounting-policy.ts:441-442, 500-501`
- `buildDividendVoucher()` in `voucher-builder.ts:458-491` — currently DR Bank → CR Dividend Income (no TDS)
- `ledger-resolver.ts:226-228` already collects TDS ledgers into masters
- Zerodha dividends parser at `parsers/zerodha/dividends.ts` extracts `ZerodhaDividendRow` with `dividend_per_share`, `quantity`, `net_dividend_amount`
- Zerodha Tax P&L parser at `parsers/zerodha/taxpnl.ts` also extracts `ZerodhaTaxPnlDividendRow` with same fields

**What to build:**

1. **`dividendRowToEvents()` in `canonical-events.ts`:**
   - Input: `ZerodhaDividendRow` (from dividends parser or tax P&L parser)
   - Compute: `gross = dividend_per_share × quantity`, `tds = gross − net_dividend_amount`
   - Output: 1 `DIVIDEND` event (`gross_amount = gross`) + 1 `TDS_ON_DIVIDEND` event (`charge_amount = tds`) if tds > 0
   - Wire into `BuildCanonicalEventsOpts` via new `dividendRows?: ZerodhaDividendRow[]` field
   - Hash: `SHA256(symbol|ex_date|quantity|dividend_per_share)`

2. **Enhance `buildDividendVoucher()` in `voucher-builder.ts:458-491`:**
   - Accept TDS charge events (same charge-index pattern as buy/sell)
   - Add `TDS_ON_DIVIDEND` to `CHARGE_EVENT_TYPES` set at line 121 so they get indexed
   - Lookup: `chargeIndex.get(date|security_id)` for TDS events
   - New journal: DR Bank (net) + DR TDS on Dividend (tds) = CR Dividend Income (gross)
   - TDS ledger name from `tallyProfile.tdsOnDividend.name`
   - When tds=0, current behavior unchanged (DR Bank = CR Div Income)

3. **Update `/api/process/route.ts`:**
   - Add `'dividends'` to the file type switch case (parsers/zerodha/dividends.ts already exports `parseDividends()`)
   - Pass parsed dividend rows to `buildCanonicalEvents()` opts

4. **Add `checkTdsReconciliation()` in `reconciliation/checks.ts`:**
   - Sum TDS_ON_DIVIDEND events
   - Compare against sum of `(dividend_per_share × quantity − net_dividend_amount)` from raw rows
   - WARNING if mismatch >1%

5. **Tests (~15-20 new):**
   - `dividendRowToEvents()`: single row, TDS=0 (no TDS event), multiple rows
   - `buildDividendVoucher()` with TDS: voucher balances, TDS line present, TDS=0 case
   - Integration: dividend file → events → vouchers → XML with TDS ledger
   - Reconciliation: TDS sum matches

---

### 3b — Corporate Actions

**What already exists:**
- `BONUS_SHARES`, `STOCK_SPLIT`, `RIGHTS_ISSUE`, `MERGER_DEMERGER` in `EventType` ✅ (done this session)
- `CORPORATE_ACTION` also in EventType (legacy, keep for backward compat)
- Exception detection in `reconciliation/exceptions.ts:62-80` — keywords like "bonus", "split"
- `CostLotTracker` at `cost-lots.ts` with `addLot()`, `disposeLots()`, `getOpenLots()`

**What to build:**

1. **Extend `CostLotTracker` with `adjustLots()`:**
   ```typescript
   adjustLots(securityId: string, opts: {
     quantityMultiplier: Decimal;   // e.g. 2 for 1:1 bonus, 5 for 1:5 split
     costDivisor?: Decimal;         // defaults to quantityMultiplier
     newSecurityId?: string;        // for merger/demerger (old → new)
     preserveAcquisitionDate: boolean;  // true for bonus/split per Indian tax law
   }): void;
   ```
   - Bonus 1:1: qty×2, cost unchanged → effective_unit_cost halves automatically
   - Split 5:1: qty×5, cost/5
   - Merger: transfer lots from old security_id to new, optionally reset date

2. **Create `buildCorporateActionVoucher()` in `voucher-builder.ts`:**
   - BONUS/SPLIT: memo voucher (Tally `MEMORANDUM` type) recording qty change
   - MERGER: journal entry — DR new security at FMV, CR old security at cost
   - RIGHTS: purchase voucher — DR investment at subscription price, CR bank
   - Add cases to the `switch` statement (currently `default: break`)

3. **Parser support (optional for MVP):**
   - Corporate actions aren't in standard Zerodha exports
   - Can detect from Tax P&L (holding period discontinuities) or user manual entry
   - At minimum: accept corporate action events via manual JSON input or a CSV template

4. **Tests:**
   - `adjustLots()`: bonus doubles qty, split adjusts cost, merger transfers
   - `buildCorporateActionVoucher()`: memo voucher for bonus, journal for merger
   - Holdings reconciliation passes after corporate action adjustment

---

### 3c — Off-Market Transfers & Auctions

**What already exists:**
- `OFF_MARKET_TRANSFER`, `AUCTION_ADJUSTMENT` in EventType
- Exception detection + handlers in `reconciliation/exceptions.ts:287-337`

**What to build:**

1. **`buildOffMarketTransferVoucher()`:**
   - Template journal with placeholders for user-supplied consideration
   - Flag voucher as `VoucherStatus.DRAFT` with narrative explaining manual entry needed
   - Emit WARNING exception for user review

2. **`buildAuctionAdjustmentVoucher()`:**
   - DR Broker (settlement proceeds at auction rate)
   - CR Investment/Stock at cost basis (from CostLotTracker disposals)
   - DR/CR Capital Gain/Loss (difference)
   - May be speculative income even if long holding period

3. **Wire into `voucher-builder.ts` switch statement**

4. **Tests:** Template generation, auction P&L, exception emission

---

## Critical File Reference

| File | Lines | What's There | What Phase 3 Needs |
|------|-------|-------------|-------------------|
| `src/lib/types/events.ts:12-34` | EventType enum | All Phase 3 types added ✅ | No change needed |
| `src/lib/engine/canonical-events.ts` | ~490 lines | Tradebook, funds, CN converters | Add `dividendRowToEvents()`, wire into opts |
| `src/lib/engine/voucher-builder.ts:121-129` | `CHARGE_EVENT_TYPES` set | 7 charge types | Add `TDS_ON_DIVIDEND` |
| `src/lib/engine/voucher-builder.ts:458-491` | `buildDividendVoucher()` | DR Bank, CR Div Income | Accept TDS events, add DR TDS line |
| `src/lib/engine/voucher-builder.ts:611-618` | main switch `default: break` | Drops CA/OMT/AA | Add handlers |
| `src/lib/engine/cost-lots.ts` | CostLotTracker class | addLot, disposeLots | Add adjustLots() |
| `src/lib/reconciliation/checks.ts` | Reconciliation checks | 7 checks + 2 CN checks | Add TDS check |
| `src/app/api/process/route.ts:95-120` | File type switch | tradebook, contract_note, funds_statement | Add dividends |
| `src/lib/constants/ledger-names.ts:328-345` | TDS ledger defs | `TDS_ON_DIVIDEND`, `TDS_ON_SECURITIES` | Already complete ✅ |
| `src/lib/engine/accounting-policy.ts:441-442,500-501` | TDS in profiles | Both profiles map TDS | Already complete ✅ |
| `src/lib/engine/ledger-resolver.ts:226-228` | TDS in ledger collection | Collects TDS ledgers | Already complete ✅ |
| `src/lib/parsers/zerodha/dividends.ts` | Standalone dividends parser | Extracts `ZerodhaDividendRow` | No change needed |
| `src/lib/parsers/zerodha/detect.ts` | File type detection | Returns `'dividends'` for dividend files | Already complete ✅ |

## Test Data

Zerodha fixtures in `src/tests/fixtures/`:
- Tradebook CSV (2 trades — buy INFY, sell INFY)
- Tax P&L XLSX (exits, dividends, charges across 4 FYs)
- Contract notes XLSX (28 sheets, multi-segment trades)
- Holdings XLSX (equity + MF)
- Dividends XLSX (standalone)
- Ledger XLSX

## Pre-existing Lint Errors (not from Phase 2, not blocking)

4 errors in repo from before Phase 2:
- `scripts/parse-tally-export.js` — `@typescript-eslint/no-require-imports` (2)
- `src/app/(app)/batches/page.tsx:85` — `react-hooks/set-state-in-effect`
- `src/app/(app)/exceptions/page.tsx:63` — `react-hooks/set-state-in-effect`

## Quick Start for Next Agent

```bash
cd /Users/ankitmishra/Developer/TradebooksAI
git branch   # should be on feat/design-evolution
npm run test:run   # 307 passing
npm run build      # clean

# Key files to read first:
# 1. This handoff note
# 2. src/lib/engine/canonical-events.ts (understand buildCanonicalEvents opts pattern)
# 3. src/lib/engine/voucher-builder.ts (understand charge-index + builder pattern)
# 4. src/lib/parsers/zerodha/dividends.ts (input data for TDS)
# 5. src/lib/constants/ledger-names.ts (TDS ledger names)

# Start with Phase 3a (TDS on Dividends) — follow the 5-step plan above
```
