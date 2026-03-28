# Session 6 Handoff — Phase 3 Complete, Phase 4–5 Ready

**Date:** 2026-03-28
**Branch:** `feat/design-evolution`
**Tests:** 347 passing (40 new in this session) | Build: clean | Lint: 0 new warnings
**State:** Phase 3 fully delivered (3a + 3b + 3c). All functional code complete.

---

## What Phase 3 Delivered

### 3a — TDS on Dividends (18 tests)

| File | Change |
|------|--------|
| `src/lib/engine/canonical-events.ts` | +`dividendRowToEvents()` — computes gross from `qty × dps`, TDS from `gross − net`. Produces 1 DIVIDEND event (gross_amount = gross) + 1 TDS_ON_DIVIDEND charge event when tds > 0. Wired into `BuildCanonicalEventsOpts` via `dividendRows` field. Funds-statement dividends skipped when dedicated dividend file present. |
| `src/lib/engine/voucher-builder.ts` | `TDS_ON_DIVIDEND` added to `CHARGE_EVENT_TYPES` set + `CHARGE_LEDGER_NAMES`. `buildDividendVoucher()` signature changed to accept `tdsChargeEvents[]` — produces 3-legged journal: DR Bank (net), DR TDS on Dividend (tds), CR Dividend Income (gross). DIVIDEND switch case now looks up TDS from `chargeIndex` by `date|security_id` key. |
| `src/app/api/process/route.ts` | `'dividends'` case added to file-type switch. Calls `parseDividends()`, stores in `parsedFileSet.dividends`, passes to `buildCanonicalEvents()`. Validation relaxed: dividends-only batches now accepted. |
| `src/lib/reconciliation/checks.ts` | +`checkDividendTdsReconciliation()` — verifies DIVIDEND gross + TDS_ON_DIVIDEND totals match raw `qty × dps` and `gross − net` from parser rows. Wired into `runFullReconciliation()` via optional `rawDividendRows` param. |
| `src/lib/types/domain.ts` | Added `'dividends'` to `BatchFileType` union. |

### 3b — Corporate Actions (13 tests)

| File | Change |
|------|--------|
| `src/lib/engine/cost-lots.ts` | +`adjustLots()` on CostLotTracker — accepts `quantityMultiplier`, `costDivisor` (defaults to multiplier), `newSecurityId` (merger), `preserveAcquisitionDate`. Mutates lots in-place. For merger: transfers lots from old to new security key in the Map. |
| `src/lib/parsers/zerodha/types.ts` | +`CorporateActionInput` interface — `action_type`, `security_id`, `action_date`, `ratio_numerator/denominator`, optional `new_security_id`, `cost_per_share`, `notes`. |
| `src/lib/engine/canonical-events.ts` | +`corporateActionToEvents()` — maps BONUS/SPLIT/RIGHTS/MERGER to CanonicalEvents. Wired into `BuildCanonicalEventsOpts` via `corporateActions` field. |
| `src/lib/engine/voucher-builder.ts` | +`buildCorporateActionVoucher()` — returns `null` for BONUS/SPLIT (lot-only), journal for MERGER (DR new investment, CR old at cost basis), purchase for RIGHTS (DR investment, CR bank). Switch cases for all 4 EventTypes: BONUS/SPLIT call `costTracker.adjustLots()`, MERGER computes cost basis then adjusts+builds journal, RIGHTS builds purchase voucher. |

### 3c — Off-Market Transfers & Auctions (9 tests)

| File | Change |
|------|--------|
| `src/lib/engine/voucher-builder.ts` | +`buildOffMarketTransferVoucher()` — DRAFT template with suspense account, "REQUIRES MANUAL REVIEW" narrative. +`buildAuctionAdjustmentVoucher()` — DR Broker (proceeds), CR Investment (cost basis), DR/CR Capital Gain/Loss. Switch cases for both: OFF_MARKET_TRANSFER produces draft, AUCTION_ADJUSTMENT disposes lots (graceful fallback when no lots). |
| `src/lib/constants/ledger-names.ts` | +`OFF_MARKET_SUSPENSE` LedgerDef (`'Off-Market Transfer Suspense'`, group `'Suspense A/c'`). |

### Test Files Created

| File | Tests |
|------|-------|
| `src/lib/engine/__tests__/dividend-tds.test.ts` | 18 — dividendRowToEvents, buildDividendVoucher with TDS, buildVouchers integration, funds-statement dedup, reconciliation |
| `src/lib/engine/__tests__/corporate-actions.test.ts` | 13 — adjustLots (bonus/split/merger/empty), corporateActionToEvents, buildCorporateActionVoucher, buy→bonus→sell integration, buy→split→sell integration |
| `src/lib/engine/__tests__/off-market-auction.test.ts` | 9 — DRAFT status, balanced vouchers, narratives, auction gain/loss, mixed event integration |

### Other Modifications

| File | Change |
|------|--------|
| `src/tests/engine/voucher-builder-profile.test.ts` | Updated `buildDividendVoucher()` call sites: added `[]` as 2nd arg for new `tdsChargeEvents` parameter. |

---

## What's Next: Phase 4 & 5

### Phase 4 — Test Coverage Catchup (HIGHEST PRIORITY)

Current: 347 tests, but many modules have minimal or no dedicated test coverage. The engine works end-to-end but individual module contracts are under-tested.

**Modules needing dedicated tests (priority order):**

| Module | Has Tests? | What's Needed |
|--------|-----------|---------------|
| `src/lib/engine/canonical-events.ts` | Only via integration + dividend-tds.test.ts | Unit tests for `tradebookRowToEvents`, `fundsStatementRowToEvents`, `contractNoteToEvents`, `pairContractNoteData`, `buildCanonicalEvents` orchestrator |
| `src/lib/engine/voucher-builder.ts` | Only profile test + dividend/CA tests | Unit tests for `buildBuyVoucher`, `buildSellVoucher`, `buildSettlementVoucher`, charge-index logic in `buildVouchers` |
| `src/lib/engine/cost-lots.ts` | Only via corporate-actions.test.ts | Dedicated tests for `addLot`, `disposeLots` (FIFO), `disposeLots` (WEIGHTED_AVERAGE), edge cases (sell > open, zero qty) |
| `src/lib/engine/accounting-policy.ts` | NO | Test `INVESTOR_DEFAULT`, `TRADER_DEFAULT`, `getDefaultTallyProfile()`, `INVESTOR_TALLY_DEFAULT`, `TRADER_TALLY_DEFAULT` field correctness |
| `src/lib/reconciliation/checks.ts` | Only CN-specific tests + dividend TDS | Test `checkTradeTotals`, `checkVoucherBalance`, `checkHoldingsReconciliation`, `checkDuplicateEvents`, `checkChargeCompleteness`, `runFullReconciliation` |
| `src/lib/reconciliation/exceptions.ts` | NO | Test exception detection (keyword matching for bonus/split/off-market/auction) |
| `src/lib/parsers/zerodha/taxpnl.ts` | NO | Test exits, charges, dividends, equity_summary sheet parsing |
| `src/lib/parsers/zerodha/funds-statement.ts` | NO | Test row parsing, zero-row skip, instrument field |
| `src/lib/parsers/zerodha/detect.ts` | NO | Test file type detection for all known types |
| `src/lib/export/tally-xml.ts` | Partial (groups only) | Test `generateFullExport`, XML envelope structure, voucher/ledger serialization |
| `src/lib/export/ledger-masters.ts` | Partial (profile only) | Test `collectRequiredLedgers` with various event sets |

**Approach:** Two parallel agents:
- **Agent A:** Engine + reconciliation tests (`canonical-events`, `voucher-builder`, `cost-lots`, `accounting-policy`, `checks`, `exceptions`)
- **Agent B:** Parser + export tests (`taxpnl`, `funds-statement`, `detect`, `tally-xml`, `ledger-masters`)

**Target:** ~85% module coverage, ~150+ additional tests.

### Phase 5 — Settings Persistence + Multi-FY Support

**5a — Settings Persistence:**
- TallyProfile is currently hardcoded per `getDefaultTallyProfile()` in `accounting-policy.ts`
- Need: Settings page (`/settings`) → saves TallyProfile to Supabase per user → `/api/process` loads user's profile
- UI already exists at `src/app/(app)/settings/page.tsx` (needs wiring)
- Supabase schema: `user_settings` table with `user_id`, `tally_profile_json`, `updated_at`

**5b — Multi-FY Support:**
- Current pipeline processes one batch = one FY
- Need: batch metadata carries `period_from`/`period_to` (already in API, already stored)
- Need: CostLotTracker state persistence across FYs (opening balances from prior FY's closing lots)
- Approach: serialize `CostLotTracker.getOpenLots()` at batch end → reload at next FY's batch start
- Holdings reconciliation should compare against FY-end holdings

**Approach:** Two parallel agents:
- **Agent A:** Settings persistence (Supabase table, API endpoint, settings page wiring)
- **Agent B:** Multi-FY support (lot serialization, opening balance loading, FY-aware reconciliation)

---

## Current App Status (for context)

| Area | Status |
|------|--------|
| Auth (Supabase) | Fully wired — login, signup, middleware redirect, session refresh |
| Upload UI → `/api/process` | Fully wired end-to-end |
| Dashboard (`/dashboard`) | Wired — fetches `GET /api/dashboard` |
| Batches page (`/batches`) | Wired — fetches `GET /api/batches` |
| Exceptions page (`/exceptions`) | Wired — fetches `GET /api/exceptions` |
| Settings page (`/settings`) | Exists but not wired to persist TallyProfile |
| Engine pipeline | Complete through Phase 3 — tradebook, CN, funds, dividends, corporate actions, off-market, auction |
| Tally XML export | Working — masters + transactions XML |

## Pre-existing Lint Errors (not from this session)

6 errors in repo from before Phase 3:
- `scripts/parse-tally-export.js` — `@typescript-eslint/no-require-imports` (2)
- `src/app/(app)/batches/page.tsx:85` — `react-hooks/set-state-in-effect`
- `src/app/(app)/exceptions/page.tsx:63` — `react-hooks/set-state-in-effect`
- `tradebooks-ai/` dir — `@typescript-eslint/no-empty-object-type` (2)

## Quick Start for Next Agent

```bash
cd /Users/ankitmishra/Developer/TradebooksAI
git branch   # should be on feat/design-evolution
npm run test:run   # 347 passing
npm run build      # clean

# Start with Phase 4 (test coverage) — follow the module table above
# Or Phase 5 (settings/multi-FY) if test coverage is deferred
```
