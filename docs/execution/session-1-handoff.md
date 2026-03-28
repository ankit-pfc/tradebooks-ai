# Session 1 Handoff: Phases 1 + 2 Complete

## What Was Done

### Phase 1: Unified Ledger Constants
- **Created** `src/lib/constants/ledger-names.ts` — single source of truth for all Tally ledger names and groups
  - All charge ledgers (Brokerage, STT, Exchange Charges, SEBI, GST, Stamp Duty, DP Charges, IPFT, Clearing Charges)
  - P&L ledgers split into STCG/LTCG (profit and loss) + Speculative
  - Investment and Stock-in-Trade ledger builders (per-symbol and pooled)
  - Trader mode ledgers (Trading Sales, Cost of Shares Sold)
  - Dividend Income, AMC Charges, Misc Charges

- **Updated** `src/lib/engine/voucher-builder.ts`:
  - All 4 voucher builders now import from `constants/ledger-names.ts` (was using hardcoded strings)
  - `buildBuyVoucher` → uses `L.investmentLedger(symbol)`, `L.BROKER.name`
  - `buildSellVoucher` → added `holdingPeriodDays?: number` param, posts to STCG or LTCG ledgers based on `> 365` days
  - `buildSettlementVoucher` → uses `L.BANK.name`, `L.BROKER.name`
  - `buildDividendVoucher` → uses `L.BANK.name`, `L.DIVIDEND_INCOME.name`
  - Removed unused `resolveLedger()` helper

- **Rewrote** `src/lib/export/ledger-masters.ts`:
  - All ledger names/groups now imported from `constants/ledger-names.ts`
  - Added STCG/LTCG (profit + loss), Speculative (profit + loss) P&L ledgers for Investor mode
  - Added AMC Charges, Misc Charges to always-include set
  - Removed dead commented-out code

### Phase 2: Fix Parsers
- **Rewrote** `src/lib/parsers/zerodha/holdings.ts`:
  - Now matches actual XLSX format: Symbol, ISIN, Sector, Quantity Available, Quantity Discrepant, Quantity Long Term, Quantity Pledged (Margin/Loan), Average Price, Previous Closing Price, Unrealized P&L
  - Multi-sheet: parses Equity + Mutual Funds sheets
  - Extracts statement date from title row
  - Returns `HoldingsParseResult` with `equity` and `mutual_funds` arrays

- **Fixed** `src/lib/parsers/zerodha/taxpnl.ts`:
  - Dividend parser handles both "Date" and "Ex-Date" header variants
  - Equity summary parser handles "Equity and Non Equity" sheet name (FY2122)

- **Updated** `src/lib/parsers/zerodha/types.ts`:
  - Fixed `ZerodhaHoldingsRow` to match real XLSX columns
  - Added `ZerodhaMFHoldingsRow`, `HoldingsParseResult`
  - Added `ZerodhaLedgerRow`, `LedgerParseResult`
  - Added `ZerodhaContractNoteTradeRow`, `ZerodhaContractNoteCharges`, `ContractNoteParseResult`
  - Added `ZerodhaDividendRow`, `DividendsParseResult`

- **Created** `src/lib/parsers/zerodha/ledger.ts`:
  - Parses Zerodha ledger XLSX (Particulars, Posting Date, Cost Center, Voucher Type, Debit, Credit, Net Balance)
  - Extracts opening balance from the special first row
  - Skips closing balance rows

- **Created** `src/lib/parsers/zerodha/contract-notes.ts`:
  - Parses multi-sheet contract note XLSX (each sheet = one trading day)
  - Extracts trades (order/trade numbers, security, B/S, quantity, rates)
  - Extracts per-CN charges (brokerage, exchange charges, clearing, CGST/SGST/IGST, STT, SEBI fees, stamp duty)
  - Detects segment markers (Equity, F&O, etc.)

- **Created** `src/lib/parsers/zerodha/dividends.ts`:
  - Standalone dividends file parser (separate from Tax PNL)
  - Handles "Ex-Date" header format
  - Skips total rows and disclaimer text

- **Updated** `src/lib/parsers/zerodha/detect.ts`:
  - Added `ledger` and `dividends` file types
  - Fixed holdings fingerprint to match actual XLSX headers

- **Updated** `src/lib/parsers/zerodha/index.ts`:
  - Exports all new parsers and types
  - `parseZerodhaFile()` now handles contract notes and ledger files

## Tests (34 passing)
- `ledger-names.test.ts` — 7 tests (constants integrity, format, no duplicates)
- `holdings.test.ts` — 5 tests (parses FY2425, correct fields, GEMENVIRO-MT exists)
- `ledger.test.ts` — 7 tests (parses FY2425, opening balance, DP charges, settlements)
- `contract-notes.test.ts` — 6 tests (parses FY2425, 28 sheets, STT/SEBI extracted)
- `dividends.test.ts` — 6 tests (parses FY2425, total=9510, Ex-Date format)
- Pre-existing: `tradebook.test.ts` (2), `pipeline.e2e.test.ts` (1)

## Verification
- `npx tsc --noEmit` — passes (zero errors)
- `npx vitest run` — 34/34 tests pass

---

## What Session 2 Should Do: Phases 3 + 4

### Phase 3: Canonical Event Converters
**File**: `src/lib/engine/canonical-events.ts`

Currently only handles tradebook + funds-statement. Add converters for:

1. `taxPnlExitToEvents()` — convert Tax PNL exit rows to events carrying `holdingPeriodDays` metadata. This is needed for STCG/LTCG classification in sell vouchers.

2. `taxPnlDividendToEvents()` — convert dividend rows to `DIVIDEND` events.

3. `taxPnlChargeToEvents()` — convert Other Debits/Credits rows to `DP_CHARGE` events.

4. `ledgerRowToEvents()` — convert ledger rows to `BANK_RECEIPT`/`BANK_PAYMENT` events. Key: "Net settlement" rows with credit = BANK_RECEIPT (funds received), debit = BANK_PAYMENT (funds sent).

5. `contractNoteChargesToEvents()` — convert per-contract-note charges to individual charge events (BROKERAGE, STT, EXCHANGE_CHARGE, etc.) linked to a specific trade date.

**Strategy for charge allocation**:
- Contract notes are the primary source (exact per-trade charges)
- Tax PNL/AGTS charges are fallback (aggregated)
- When using aggregates, allocate proportionally across trades by value

### Phase 4: STCG/LTCG Integration in buildVouchers()

The sell voucher builder already accepts `holdingPeriodDays` and splits into STCG/LTCG ledgers. What's needed:

1. **Holding period flow**: Tax PNL exits have `period_of_holding`. This needs to be available when `buildVouchers()` processes a sell event. Options:
   - Enrich `CanonicalEvent` with a `holding_period_days` field (added during Tax PNL exit conversion)
   - Or compute from the cost lot tracker (entry_date vs exit_date)

2. **Speculative income handling**: Intraday trades (buy+sell on same day) should be classified as speculative income, not STCG. Check if entry_date == exit_date.

3. **Pass holding period through `buildVouchers()`**: Currently `buildSellVoucher()` is called without `holdingPeriodDays`. The orchestrator needs to look up or compute it.

### Key Files
- `src/lib/engine/canonical-events.ts` — add all 5 converters
- `src/lib/engine/voucher-builder.ts` — update `buildVouchers()` to pass `holdingPeriodDays`
- `src/lib/types/events.ts` — may need to add `holding_period_days` to `CanonicalEvent`

### Key Data Points for Validation
- FY 2425 known values from Tax PNL:
  - Total dividends = 9510 (4 entries)
  - Check against `dividends-FC9134-2024_2025.xlsx` which also shows 9510
- Contract notes: 28 sheets for FY2425
- Ledger: DP Charges entries should match Tax PNL "Other Debits and Credits"

### Constants File
All ledger names are in `src/lib/constants/ledger-names.ts`. Use `import * as L from '../constants/ledger-names'` everywhere. DO NOT hardcode ledger name strings.

### Running Tests
```bash
npx vitest run          # all tests
npx tsc --noEmit        # type check
```
