/**
 * voucher-builder.ts
 * Build VoucherDraft objects from CanonicalEvents and an AccountingProfile.
 *
 * Rules:
 *  - Every voucher's total_debit MUST equal total_credit.  A hard validation
 *    is performed before returning; an Error is thrown on imbalance.
 *  - All arithmetic uses decimal.js — never native JS number for money.
 *  - Ledger names containing "{script}" are resolved to the actual security
 *    symbol before the voucher is returned.
 */

import Decimal from 'decimal.js';
import { EventType, type CanonicalEvent } from '../types/events';
import {
  AccountingMode,
  ChargeTreatment,
  type AccountingProfile,
  type TallyProfile,
} from '../types/accounting';
import {
  VoucherStatus,
  InvoiceIntent,
  VoucherType,
  type VoucherDraft,
  type VoucherLine,
} from '../types/vouchers';
import type { CostDisposal } from './cost-lots';
import type { CostLotTracker } from './cost-lots';
import * as L from '../constants/ledger-names';
import {
  resolveInvestmentLedger,
  resolveCapitalGainLedger,
  resolveChargeLedger,
  resolveDividendLedger,
} from './ledger-resolver';
import { TradeClassification } from './trade-classifier';
import { PipelineValidationError } from '../errors/pipeline-validation';

export type BuiltVoucherDraft = VoucherDraft & { lines: VoucherLine[] };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract the human-readable trading symbol from an event.
 *  Prefers event.security_symbol (always the broker symbol like "RELIANCE"),
 *  falls back to parsing security_id ("EQ:RELIANCE" → "RELIANCE").
 *  Avoids using ISIN codes as display names.
 */
function symbolFromEvent(event: { security_id: string | null; security_symbol?: string | null }): string {
  if (event.security_symbol) return event.security_symbol;
  if (!event.security_id) return 'UNKNOWN';
  const parts = event.security_id.split(':');
  return parts.length > 1 ? parts[1] : event.security_id;
}

/** Extract the security symbol from a composite security_id ("EXCHANGE:SYMBOL").
 *  For ISIN-prefixed IDs, returns the ISIN code (use symbolFromEvent when an event is available).
 */
function symbolFromSecurityId(securityId: string | null): string {
  if (!securityId) return 'UNKNOWN';
  const parts = securityId.split(':');
  return parts.length > 1 ? parts[1] : securityId;
}

/** Build the Tally stock item name for a security (symbol + "-SH" suffix). */
function stockItemNameForEvent(event: { security_id: string | null; security_symbol?: string | null }): string {
  return `${symbolFromEvent(event)}-SH`;
}

/** Build a VoucherLine with an auto-generated ID. */
function makeLine(
  draftId: string,
  lineNo: number,
  ledgerName: string,
  amount: Decimal,
  drCr: 'DR' | 'CR',
  opts?: {
    security_id?: string | null;
    quantity?: string | null;
    rate?: string | null;
    stock_item_name?: string | null;
  },
): VoucherLine {
  return {
    voucher_line_id: crypto.randomUUID(),
    voucher_draft_id: draftId,
    line_no: lineNo,
    ledger_name: ledgerName,
    amount: amount.toFixed(2),
    dr_cr: drCr,
    security_id: opts?.security_id ?? null,
    quantity: opts?.quantity ?? null,
    rate: opts?.rate ?? null,
    stock_item_name: opts?.stock_item_name ?? null,
    cost_center: null,
    bill_ref: null,
  };
}

/** Record actual DR/CR totals. Never throws — imbalances are surfaced as
 *  warnings in the reconciliation check on the Results screen so the user
 *  can proceed and correct in Tally if needed. */
function assertBalanced(draft: BuiltVoucherDraft): void {
  const totalDr = draft.lines
    .filter((l) => l.dr_cr === 'DR')
    .reduce((s, l) => s.add(new Decimal(l.amount)), new Decimal(0));
  const totalCr = draft.lines
    .filter((l) => l.dr_cr === 'CR')
    .reduce((s, l) => s.add(new Decimal(l.amount)), new Decimal(0));

  draft.total_debit = totalDr.toFixed(2);
  draft.total_credit = totalCr.toFixed(2);
}

/** Determine whether buy charges should be capitalised under the profile. */
function shouldCapitalizeBuyCharges(profile: AccountingProfile): boolean {
  return (
    profile.charge_treatment === ChargeTreatment.CAPITALIZE ||
    (profile.charge_treatment === ChargeTreatment.HYBRID &&
      profile.mode === AccountingMode.INVESTOR)
  );
}

/** Intraday/speculative trades should NOT record stock inventory — positions
 *  net off same-day and nothing carries forward. Only a plain Journal entry
 *  with the gain/loss is needed.
 */
function isSpeculativeTrade(event: CanonicalEvent): boolean {
  return event.trade_classification === TradeClassification.SPECULATIVE_BUSINESS;
}

/**
 * Append a charge expense line to a voucher draft, choosing DR for normal
 * charges and CR for negative refunds (e.g. exchange-charge rebates that
 * Zerodha occasionally emits on real contract notes). Zero-amount charges
 * are skipped.
 *
 * Returns the next free line number so callers can keep numbering monotonic.
 */
function appendChargeLine(
  lines: VoucherLine[],
  draftId: string,
  startLineNo: number,
  ledgerName: string,
  chargeAmount: Decimal,
): number {
  if (chargeAmount.isZero()) {
    return startLineNo;
  }
  if (chargeAmount.isPositive()) {
    lines.push(makeLine(draftId, startLineNo, ledgerName, chargeAmount, 'DR'));
  } else {
    // Negative charge → refund/rebate → credit the expense ledger with the
    // absolute amount. The signed totalCharges aggregator already accounts
    // for this on the broker line, so the voucher stays in balance.
    lines.push(makeLine(draftId, startLineNo, ledgerName, chargeAmount.abs(), 'CR'));
  }
  return startLineNo + 1;
}

/**
 * Split the charge events on a trade into two buckets:
 *   - `disallowed`: STT — Indian income-tax treats STT on investor trades
 *     as a non-deductible, non-capitalizable expense under Sec 48, so it
 *     must be posted as its own ledger line (not rolled into cost basis /
 *     sale consideration).
 *   - `capitalizable`: everything else — brokerage, exchange & clearing,
 *     SEBI turnover fees, stamp duty, GST on brokerage, IPFT. These get
 *     baked into the asset ledger on a buy and deducted from the sale
 *     consideration on a sell, matching the ITR-2 "full value of
 *     consideration net of expenditure wholly and exclusively incurred
 *     in connection with transfer" definition.
 */
interface SplitCharges {
  capitalizable: CanonicalEvent[];
  disallowed: CanonicalEvent[];
  capitalizableTotal: Decimal;
  disallowedTotal: Decimal;
  totalCharges: Decimal;
}

function splitInvestorCharges(chargeEvents: CanonicalEvent[]): SplitCharges {
  const capitalizable: CanonicalEvent[] = [];
  const disallowed: CanonicalEvent[] = [];
  let capitalizableTotal = new Decimal(0);
  let disallowedTotal = new Decimal(0);

  for (const ce of chargeEvents) {
    const amt = new Decimal(ce.charge_amount);
    if (ce.event_type === EventType.STT) {
      disallowed.push(ce);
      disallowedTotal = disallowedTotal.add(amt);
    } else {
      capitalizable.push(ce);
      capitalizableTotal = capitalizableTotal.add(amt);
    }
  }

  return {
    capitalizable,
    disallowed,
    capitalizableTotal,
    disallowedTotal,
    totalCharges: capitalizableTotal.add(disallowedTotal),
  };
}

/** Human-readable label for a charge event, used in trade narrations. */
const CHARGE_NARRATION_LABELS: Partial<Record<EventType, string>> = {
  [EventType.BROKERAGE]: 'brokerage',
  [EventType.STT]: 'STT',
  [EventType.EXCHANGE_CHARGE]: 'exchange',
  [EventType.SEBI_CHARGE]: 'SEBI',
  [EventType.GST_ON_CHARGES]: 'GST',
  [EventType.STAMP_DUTY]: 'stamp',
  [EventType.DP_CHARGE]: 'DP',
};

/**
 * Build a compact one-line charge breakdown for a trade narration.
 *
 * Format:
 *   "Purchase of RELIANCE @ 2500 × 10 units | brokerage 20.00, GST 3.60, stamp 0.40, exch 0.10 | STT 2.50 (non-deductible)"
 *
 * The "Purchase of" / "Sale of" prefix is preserved from the previous
 * narrative format so downstream consumers that match on narrative
 * prefix (voucher-merger, tests) keep working.
 *
 * Only non-zero charges are listed. If the trade has no charges at all,
 * only the prefix is returned. STT is always separated by a ` | STT …
 * (non-deductible)` suffix — this mirrors the voucher-line split and
 * gives the user a clear audit trail of what was capitalized vs what
 * was posted as a standalone disallowed expense.
 *
 * Negative charges (exchange-charge rebates, STT refunds) are rendered
 * with their sign so the narration reflects what actually happened.
 */
export function buildTradeNarrative(
  side: 'buy' | 'sell',
  symbol: string,
  quantity: Decimal,
  rate: string,
  chargeEvents: CanonicalEvent[],
): string {
  const sideLabel = side === 'buy' ? 'Purchase of' : 'Sale of';
  const prefix = `${sideLabel} ${symbol} @ ${rate} × ${quantity.toFixed()} units`;
  if (chargeEvents.length === 0) {
    return prefix;
  }

  const capitalizableParts: string[] = [];
  let sttAmount: Decimal | null = null;

  for (const ce of chargeEvents) {
    const amt = new Decimal(ce.charge_amount);
    if (amt.isZero()) continue;
    if (ce.event_type === EventType.STT) {
      sttAmount = (sttAmount ?? new Decimal(0)).add(amt);
      continue;
    }
    const label = CHARGE_NARRATION_LABELS[ce.event_type] ?? ce.charge_type ?? 'other';
    capitalizableParts.push(`${label} ${amt.toFixed(2)}`);
  }

  const parts = [prefix];
  if (capitalizableParts.length > 0) {
    parts.push(capitalizableParts.join(', '));
  }
  if (sttAmount !== null && !sttAmount.isZero()) {
    parts.push(`STT ${sttAmount.toFixed(2)} (non-deductible)`);
  }
  return parts.join(' | ');
}

export function deriveEffectiveProfile(
  profile: AccountingProfile,
  event: CanonicalEvent,
): AccountingProfile {
  switch (event.trade_classification) {
    case TradeClassification.INVESTMENT:
      return {
        ...profile,
        mode: AccountingMode.INVESTOR,
        charge_treatment: ChargeTreatment.HYBRID,
      };
    case TradeClassification.SPECULATIVE_BUSINESS:
      // Intraday/speculative trades use INVESTOR mode to produce Journal
      // vouchers with inventory allocation and gain/loss routing to the
      // Speculative Business Income group, per CA convention.
      return {
        ...profile,
        mode: AccountingMode.INVESTOR,
        charge_treatment: ChargeTreatment.EXPENSE,
      };
    case TradeClassification.NON_SPECULATIVE_BUSINESS:
      return {
        ...profile,
        mode: AccountingMode.TRADER,
        charge_treatment: ChargeTreatment.EXPENSE,
      };
    case TradeClassification.PROFILE_DRIVEN:
    default:
      return profile;
  }
}

function withTradeReviewNarrative(narrative: string, event: CanonicalEvent): string {
  if (event.trade_product === 'MTF') {
    return `${narrative} [Review: MTF financing treatment]`;
  }

  return narrative;
}

function invoiceIntentForTrade(
  event: CanonicalEvent,
  profile: AccountingProfile,
): InvoiceIntent {
  // Investor mode always emits Journal vouchers in Tally. We intentionally
  // leave invoice_intent as NONE so the XML serializer does not flip the
  // voucher to VCHTYPE="Sales"/"Purchase". Stock movement is carried by
  // the F12 ISINVENTORYAFFECTED flag on the investment ledger master.
  if (profile.mode === AccountingMode.INVESTOR) {
    return InvoiceIntent.NONE;
  }
  switch (event.event_type) {
    case EventType.BUY_TRADE:
      return InvoiceIntent.PURCHASE;
    case EventType.SELL_TRADE:
      return InvoiceIntent.SALES;
    default:
      return InvoiceIntent.NONE;
  }
}

/**
 * HARD RULE — INVESTOR TRADE VOUCHERS MUST LAND IN THE JOURNAL REGISTER.
 *
 * This is the single choke-point contract for investor-mode buy/sell trades.
 * It is a tripwire: if a future refactor ever produces an investor-mode trade
 * voucher whose voucher_type is anything other than JOURNAL, or whose
 * invoice_intent is anything other than NONE, this throws loudly at build
 * time — breaking the pipeline long before any bad XML reaches a user.
 *
 * Why this rule exists (do not weaken without re-reading all three):
 *   1. Investors file ITR-2 and report trades under Capital Gains. Sales /
 *      Purchase registers in Tally feed the Profit & Loss statement, which
 *      maps to ITR-3 business income. Posting investor trades there flips
 *      the entire tax treatment from capital gains → business income and
 *      corrupts the books.
 *   2. The published Capital-Account / per-scrip ledger methodology that
 *      this product is built on requires all investor trades to be Journal
 *      vouchers with inventory flowing via the F12 "Use Inventory
 *      Allocations for Ledgers" flag on the investment ledger master
 *      (ISINVENTORYAFFECTED=Yes). See the bug report PDF pages 5–6.
 *   3. The Tally XML serializer flips VCHTYPE from "Journal" to
 *      "Sales"/"Purchase" when a voucher carries a non-NONE invoice_intent
 *      alongside inventory lines. That flip is ONLY valid for TRADER mode.
 *      Leaving invoice_intent=NONE for investor trades is what keeps them
 *      in the Journal register.
 *
 * If you are a future change-author and need to add a new investor-trade
 * code path: the contract is enforced here. You MUST set voucher_type to
 * JOURNAL and invoice_intent to NONE. Do not disable or catch this error —
 * fix the code path that produced the invalid draft.
 */
export function assertInvestorTradeVoucherContract(
  draft: BuiltVoucherDraft,
  effectiveProfile: AccountingProfile,
  event: CanonicalEvent,
): void {
  if (effectiveProfile.mode !== AccountingMode.INVESTOR) {
    return;
  }

  const voucherTypeOk = draft.voucher_type === VoucherType.JOURNAL;
  const invoiceIntentOk =
    draft.invoice_intent === InvoiceIntent.NONE ||
    draft.invoice_intent === undefined;

  if (voucherTypeOk && invoiceIntentOk) {
    return;
  }

  throw new PipelineValidationError(
    'E_INVESTOR_TRADE_MUST_BE_JOURNAL',
    `Investor-mode trade voucher must be a Journal with invoice_intent=NONE, ` +
      `but got voucher_type=${draft.voucher_type}, invoice_intent=${draft.invoice_intent}. ` +
      `Investor trades land in the Tally Journal register; posting to the ` +
      `Sales/Purchase register would flip the tax treatment from capital ` +
      `gains (ITR-2) to business income (ITR-3) and corrupt the books. ` +
      `See assertInvestorTradeVoucherContract in voucher-builder.ts for the ` +
      `rationale. If you are adding a new investor-trade code path, set ` +
      `voucher_type=JOURNAL and invoice_intent=NONE — do not disable this check.`,
    {
      event_id: event.event_id,
      event_type: event.event_type,
      security_id: event.security_id,
      voucher_draft_id: draft.voucher_draft_id,
      voucher_type: draft.voucher_type,
      invoice_intent: draft.invoice_intent,
    },
  );
}

function calculateHoldingPeriodDays(
  sellDate: string,
  costDisposals: CostDisposal[],
): number | undefined {
  const sellAt = Date.parse(`${sellDate}T00:00:00Z`);
  if (Number.isNaN(sellAt)) {
    return undefined;
  }

  const holdingPeriods = costDisposals
    .map((disposal) => {
      const acquisitionDate = disposal.acquisition_date?.trim();
      if (!acquisitionDate) {
        return undefined;
      }

      const acquisitionAt = Date.parse(`${acquisitionDate}T00:00:00Z`);
      if (Number.isNaN(acquisitionAt)) {
        return undefined;
      }

      return Math.max(0, Math.floor((sellAt - acquisitionAt) / (1000 * 60 * 60 * 24)));
    })
    .filter((days): days is number => days !== undefined);

  if (holdingPeriods.length === 0) {
    return undefined;
  }

  return Math.min(...holdingPeriods);
}

// ---------------------------------------------------------------------------
// Charge event helpers
// ---------------------------------------------------------------------------

/** Map a charge EventType to its canonical ledger name. */
const CHARGE_LEDGER_NAMES: Partial<Record<EventType, string>> = {
  [EventType.BROKERAGE]: L.BROKERAGE.name,
  [EventType.STT]: L.STT.name,
  [EventType.EXCHANGE_CHARGE]: L.EXCHANGE_CHARGES.name,
  [EventType.SEBI_CHARGE]: L.SEBI_CHARGES.name,
  [EventType.GST_ON_CHARGES]: L.GST_ON_CHARGES.name,
  [EventType.STAMP_DUTY]: L.STAMP_DUTY.name,
  [EventType.DP_CHARGE]: L.DP_CHARGES.name,
  [EventType.TDS_ON_DIVIDEND]: L.TDS_ON_DIVIDEND.name,
};

const CHARGE_EVENT_TYPES = new Set<EventType>([
  EventType.BROKERAGE,
  EventType.STT,
  EventType.EXCHANGE_CHARGE,
  EventType.SEBI_CHARGE,
  EventType.GST_ON_CHARGES,
  EventType.STAMP_DUTY,
  EventType.DP_CHARGE,
  EventType.TDS_ON_DIVIDEND,
]);

function isChargeEvent(e: CanonicalEvent): boolean {
  return CHARGE_EVENT_TYPES.has(e.event_type);
}

// ---------------------------------------------------------------------------
// buildBuyVoucher
// ---------------------------------------------------------------------------

/**
 * Build a purchase voucher for a BUY_TRADE event.
 *
 * Investor mode (Capital Account / ITR-2 methodology):
 *   DR  Investment in Equity Shares - {script}   (gross + capitalizable charges)
 *   DR  Securities Transaction Tax                (only if STT > 0 — STT is a
 *                                                  non-deductible, non-
 *                                                  capitalizable expense per
 *                                                  Sec 48, so it is posted on
 *                                                  its own ledger line rather
 *                                                  than rolled into cost basis)
 *   CR  Zerodha Broking                           (total out-of-pocket =
 *                                                  gross + ALL charges)
 *   Narration lists each charge.
 *
 * Trader mode (EXPENSE charges):
 *   DR  Shares-in-Trade - {script}                (gross amount)
 *   DR  Brokerage / STT / …                       (each charge separately)
 *   CR  Zerodha Broking                           (gross + all charges)
 */
export function buildBuyVoucher(
  event: CanonicalEvent,
  profile: AccountingProfile,
  chargeEvents: CanonicalEvent[],
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft {
  const effectiveProfile = deriveEffectiveProfile(profile, event);
  const draftId = crypto.randomUUID();
  const symbol = symbolFromEvent(event);
  // Investor mode always consolidates non-STT charges into the asset ledger
  // (user directive: single transaction entry with charges in narration).
  // Trader mode retains the expense-breakdown path — per-charge ledgers are
  // still needed for P&L analysis on business-income trades.
  const isInvestor = effectiveProfile.mode === AccountingMode.INVESTOR;
  const useCapitalizeBuy =
    isInvestor || shouldCapitalizeBuyCharges(effectiveProfile);
  // Negative charges (e.g. small Zerodha exchange-charge rebates on real
  // contract notes) are supported via sign-aware posting in the trader
  // EXPENSE path below, and are absorbed into the capitalized asset line
  // in the investor path. No need to reject them.

  const assetLedger = tallyProfile
    ? resolveInvestmentLedger(tallyProfile, symbol).name
    : isInvestor
      ? L.investmentLedger(symbol).name
      : L.stockInTradeLedger(symbol).name;

  const grossAmount = new Decimal(event.gross_amount);
  const split = splitInvestorCharges(chargeEvents);

  const lines: VoucherLine[] = [];
  let lineNo = 1;

  // Intraday/speculative trades skip stock inventory — positions net off
  // same-day and only the gain/loss matters.
  const skipInventory = isSpeculativeTrade(event);

  if (useCapitalizeBuy && isInvestor) {
    // Investor path: single DR on the investment ledger absorbing
    // every non-STT charge. STT is posted as its own DR line so it
    // remains visible as a non-deductible expense in Tally.
    const capitalizedAmount = grossAmount.add(split.capitalizableTotal);
    const capitalizedQty = new Decimal(event.quantity).abs();
    const effectiveRate = capitalizedAmount.div(capitalizedQty).toDecimalPlaces(2).toFixed(2);
    lines.push(
      makeLine(draftId, lineNo++, assetLedger, capitalizedAmount, 'DR', skipInventory ? {} : {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: effectiveRate,
        stock_item_name: stockItemNameForEvent(event),
      }),
    );

    if (!split.disallowedTotal.isZero()) {
      const sttLedger = tallyProfile
        ? resolveChargeLedger(tallyProfile, EventType.STT).name
        : CHARGE_LEDGER_NAMES[EventType.STT] ?? L.STT.name;
      lineNo = appendChargeLine(lines, draftId, lineNo, sttLedger, split.disallowedTotal);
    }
  } else if (useCapitalizeBuy) {
    // Legacy CAPITALIZE path for non-investor profiles (kept for tests and
    // trader configurations that explicitly opt in via charge_treatment).
    // Folds ALL charges including STT into the asset ledger.
    const capitalizedAmount = grossAmount.add(split.totalCharges);
    const capitalizedQty = new Decimal(event.quantity).abs();
    const effectiveRate = capitalizedAmount.div(capitalizedQty).toDecimalPlaces(2).toFixed(2);
    lines.push(
      makeLine(draftId, lineNo++, assetLedger, capitalizedAmount, 'DR', skipInventory ? {} : {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: effectiveRate,
        stock_item_name: stockItemNameForEvent(event),
      }),
    );
  } else {
    // Trader EXPENSE path: asset at gross, each charge as its own DR.
    lines.push(
      makeLine(draftId, lineNo++, assetLedger, grossAmount, 'DR', skipInventory ? {} : {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: event.rate,
        stock_item_name: stockItemNameForEvent(event),
      }),
    );
    // DR: each positive charge to its expense ledger
    // CR: each negative charge (rebate / refund) to the same expense ledger
    for (const ce of chargeEvents) {
      const chargeLedger = tallyProfile
        ? resolveChargeLedger(tallyProfile, ce.event_type).name
        : CHARGE_LEDGER_NAMES[ce.event_type] ?? L.MISC_CHARGES.name;
      const chargeAmt = new Decimal(ce.charge_amount);
      lineNo = appendChargeLine(lines, draftId, lineNo, chargeLedger, chargeAmt);
    }
  }

  // CR: Broker — total payable (gross + signed charges).
  // When totalCharges contains a negative component (e.g. exchange-charge
  // rebate), the broker payable is correctly reduced; the signed math keeps
  // the voucher balanced against the per-charge DR/CR lines above.
  const brokerName = tallyProfile?.broker.name ?? L.BROKER.name;
  const totalPayable = grossAmount.add(split.totalCharges);
  lines.push(makeLine(draftId, lineNo++, brokerName, totalPayable, 'CR'));

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    // All trade vouchers are Journal vouchers. Tally processes inventory
    // allocations inside journal vouchers when the target ledger has the F12
    // flag "Use Inventory Allocations for Ledgers" enabled — emitted as
    // ISINVENTORYAFFECTED=Yes on the ledger master. See bug-report PDF
    // pages 5-6.
    //
    // Investor mode deliberately leaves invoice_intent as NONE so the Tally
    // XML serializer does not flip VCHTYPE to "Purchase"/"Sales". Investor
    // trades must land in the Journal register, not Sales/Purchase register,
    // to match the Capital Account / ITR-2 methodology.
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: invoiceIntentForTrade(event, effectiveProfile),
    voucher_date: event.event_date,
    // Voucher number = CN number / security symbol. Unique per (CN, security)
    // so multi-script CNs don't collide on Tally import while still carrying
    // the CN number for re-import duplicate detection. Same-symbol multi-rate
    // fills within one CN get a numeric suffix applied later by
    // disambiguateVoucherNumbers (post-merge step).
    external_reference: event.contract_note_ref
      ? `${event.contract_note_ref}/${symbol}`
      : event.external_ref ?? null,
    narrative: withTradeReviewNarrative(
      buildTradeNarrative(
        'buy',
        symbol,
        new Decimal(event.quantity).abs(),
        event.rate,
        chargeEvents,
      ),
      event,
    ),
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [event.event_id, ...chargeEvents.map((ce) => ce.event_id)],
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  assertInvestorTradeVoucherContract(draft, effectiveProfile, event);
  return draft;
}

// ---------------------------------------------------------------------------
// buildSellVoucher
// ---------------------------------------------------------------------------

/**
 * Build a sales voucher for a SELL_TRADE event.
 *
 * Investor mode:
 *   DR  Zerodha Broking                     (sale proceeds received)
 *   CR  Investment in Equity Shares - {script}  (cost basis cleared)
 *   CR  Profit on Sale of Investments       (if gain)
 *  OR
 *   DR  Loss on Sale of Investments         (if loss)
 *   DR  charge ledgers                      (sell charges expensed)
 *   CR  Zerodha Broking (net)               (already credited above — adjust)
 *
 * Simplified approach: debit broker for proceeds, credit asset at cost,
 * book net gain/loss.  Charges reduce the net gain / increase net loss.
 *
 * Trader mode:
 *   DR  Zerodha Broking                     (sale proceeds)
 *   CR  Trading Sales                       (gross sell value)
 *   DR  Cost of Shares Sold                 (total cost basis)
 *   CR  Shares-in-Trade - {script}          (clear cost from asset)
 *   DR  charge ledgers                      (expensed)
 *   CR  Zerodha Broking (net charge credit)
 */
export function buildSellVoucher(
  event: CanonicalEvent,
  profile: AccountingProfile,
  chargeEvents: CanonicalEvent[],
  costDisposals: CostDisposal[],
  holdingPeriodDays?: number,
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft {
  const effectiveProfile = deriveEffectiveProfile(profile, event);
  const draftId = crypto.randomUUID();
  const symbol = symbolFromEvent(event);
  const isInvestor = effectiveProfile.mode === AccountingMode.INVESTOR;
  // Negative charges on sell vouchers (e.g. exchange-charge rebates) are
  // posted as CR refund lines in both investor and trader paths below.

  const grossAmount = new Decimal(event.gross_amount);
  const split = splitInvestorCharges(chargeEvents);
  const totalCharges = split.totalCharges;
  const totalCostBasis = costDisposals.reduce(
    (sum, d) => sum.add(new Decimal(d.total_cost)),
    new Decimal(0),
  );
  // Under ITR-2, the "full value of consideration" is the gross sale value
  // MINUS expenditure wholly and exclusively incurred in connection with the
  // transfer (brokerage, exchange, stamp duty, GST on those, SEBI fees).
  // STT is explicitly excluded from Sec 48 deductions — it is neither
  // deductible from consideration nor capitalizable into cost basis. So the
  // sale consideration that flows to STCG/LTCG is (gross − non-STT charges),
  // and STT is posted as its own DR line on the voucher.
  const saleConsideration = grossAmount.sub(split.capitalizableTotal);
  // Investor capital gain/loss is computed from saleConsideration (post-
  // charge-deduction view) so the ledger amount matches what the taxpayer
  // will actually report on ITR-2 Schedule CG. Trader mode doesn't post a
  // direct gain/loss line — P&L is derived from TradingSales − CostOfShares.
  const investorGainLoss = saleConsideration.sub(totalCostBasis);
  const skipInventory = isSpeculativeTrade(event);
  // Uncovered disposal: cost-lots engine emits a zero-cost disposal when
  // sell quantity exceeds the open lots (see cost-lots.ts _disposeFifo /
  // _disposeWeightedAverage). In that case there is no inventory to clear,
  // so we skip the asset CR line entirely and route the full proceeds to
  // the gain ledger. Tally handles the stock-register reconciliation.
  const hasZeroCostBasis = totalCostBasis.isZero();
  const lines: VoucherLine[] = [];
  let lineNo = 1;

  if (isInvestor) {
    const assetLedger = tallyProfile
      ? resolveInvestmentLedger(tallyProfile, symbol).name
      : L.investmentLedger(symbol).name;
    const brokerName = tallyProfile?.broker.name ?? L.BROKER.name;

    // DR: Broker for the NET cash receivable (gross − every charge,
    // including STT). This is what actually hits the trading account on
    // settlement — Zerodha credits the user net of all charges.
    const netProceeds = grossAmount.sub(totalCharges);
    lines.push(makeLine(draftId, lineNo++, brokerName, netProceeds, 'DR'));

    // DR: STT posted as its own non-deductible expense line. All other
    // charges (brokerage, exchange, SEBI, stamp, GST) are absorbed into
    // saleConsideration — they do NOT get their own DR lines on the
    // investor-mode sell voucher. This is the user-visible "single
    // transaction entry with charges in narration" requirement, with the
    // sole exception of STT (kept separate because Sec 48 disallows it).
    if (!split.disallowedTotal.isZero()) {
      const sttLedger = tallyProfile
        ? resolveChargeLedger(tallyProfile, EventType.STT).name
        : CHARGE_LEDGER_NAMES[EventType.STT] ?? L.STT.name;
      lineNo = appendChargeLine(lines, draftId, lineNo, sttLedger, split.disallowedTotal);
    }

    // CR: Investment account at cost basis.
    // For non-speculative trades, include inventory so Tally records stock out.
    // For speculative/intraday, skip inventory — positions net off same-day.
    // For uncovered (zero cost basis) disposals, skip the asset line entirely:
    // there's nothing to clear, and a 0-amount line would be both meaningless
    // and a Tally inventory-rate error.
    if (!hasZeroCostBasis) {
      const absQty = new Decimal(event.quantity).abs();
      const costPerUnit = absQty.greaterThan(0)
        ? totalCostBasis.dividedBy(absQty).toDecimalPlaces(6).toString()
        : '0';
      lines.push(
        makeLine(draftId, lineNo++, assetLedger, totalCostBasis, 'CR', skipInventory ? {} : {
          security_id: event.security_id,
          quantity: event.quantity,
          rate: costPerUnit,
          stock_item_name: stockItemNameForEvent(event),
        }),
      );
    }

    // CR or DR: Capital gain / loss.
    //
    // Computed from saleConsideration (gross − non-STT charges) so the
    // ledger amount matches ITR-2's Schedule CG reporting. STT is a
    // disallowed expense and is excluded from the consideration figure
    // by construction (it lives on its own DR line above).
    //
    // Balance check:
    //   DR broker (gross − all) + DR STT (stt) = gross − non-STT = saleConsideration
    //   CR investment (costBasis) + CR gain (saleConsideration − costBasis) = saleConsideration ✓
    const investorIsGain = investorGainLoss.greaterThanOrEqualTo(0);
    const isGain = investorIsGain;
    // Investment-classified trades (CNC) must never route to the speculation
    // ledger even when holding period is 0 (same-day buy+sell).  Treat as
    // short-term capital gain/loss instead. classifyGain treats 0 as
    // SPECULATION, so bump to 1 day to stay on the STCG/STCL path.
    // Only apply when trade_classification explicitly says INVESTMENT —
    // profile-driven/unclassified events preserve the existing speculation routing.
    const effectiveHoldingDays =
      holdingPeriodDays === 0 &&
        event.trade_classification === TradeClassification.INVESTMENT
        ? 1
        : holdingPeriodDays;
    if (tallyProfile) {
      const gainLossLedger = resolveCapitalGainLedger(
        tallyProfile, symbol, effectiveHoldingDays, isGain,
      ).name;
      if (isGain) {
        lines.push(makeLine(draftId, lineNo++, gainLossLedger, investorGainLoss, 'CR'));
      } else {
        lines.push(makeLine(draftId, lineNo++, gainLossLedger, investorGainLoss.abs(), 'DR'));
      }
    } else {
      const isSpeculation = effectiveHoldingDays === 0;
      const isLongTerm = effectiveHoldingDays !== undefined && effectiveHoldingDays > 365;
      if (isSpeculation) {
        // Route to speculation gain/loss ledger
        const specLedger = isGain ? L.SPECULATIVE_PROFIT.name : L.SPECULATIVE_LOSS.name;
        if (isGain) {
          lines.push(makeLine(draftId, lineNo++, specLedger, investorGainLoss, 'CR'));
        } else {
          lines.push(makeLine(draftId, lineNo++, specLedger, investorGainLoss.abs(), 'DR'));
        }
      } else if (isGain) {
        const gainLedger = isLongTerm ? L.LTCG_PROFIT.name : L.STCG_PROFIT.name;
        lines.push(makeLine(draftId, lineNo++, gainLedger, investorGainLoss, 'CR'));
      } else {
        const lossLedger = isLongTerm ? L.LTCG_LOSS.name : L.STCG_LOSS.name;
        lines.push(makeLine(draftId, lineNo++, lossLedger, investorGainLoss.abs(), 'DR'));
      }
    }
  } else {
    // Trader mode
    const stockLedger = tallyProfile
      ? resolveInvestmentLedger(tallyProfile, symbol).name
      : L.stockInTradeLedger(symbol).name;
    const brokerName = tallyProfile?.broker.name ?? L.BROKER.name;

    // DR: Broker for net sale proceeds
    const netProceeds = grossAmount.sub(totalCharges);
    lines.push(makeLine(draftId, lineNo++, brokerName, netProceeds, 'DR'));

    // DR: charge ledgers — negative charges become CR refund lines on the
    // same expense ledger.
    for (const ce of chargeEvents) {
      const chargeLedger = tallyProfile
        ? resolveChargeLedger(tallyProfile, ce.event_type).name
        : CHARGE_LEDGER_NAMES[ce.event_type] ?? L.MISC_CHARGES.name;
      const chargeAmt = new Decimal(ce.charge_amount);
      lineNo = appendChargeLine(lines, draftId, lineNo, chargeLedger, chargeAmt);
    }

    // DR: Cost of Shares Sold (omit when cost = 0 — partial-data disposal)
    if (totalCostBasis.greaterThan(0)) {
      lines.push(
        makeLine(draftId, lineNo++, L.COST_OF_SHARES_SOLD.name, totalCostBasis, 'DR'),
      );
    }

    // CR: Trading Sales at gross
    lines.push(makeLine(draftId, lineNo++, L.TRADING_SALES.name, grossAmount, 'CR'));

    // CR: Shares-in-Trade at cost basis.
    // Uncovered disposals have zero cost basis — skip the line entirely so
    // we don't emit a 0-amount/0-rate stock-out entry (see investor path).
    if (!hasZeroCostBasis) {
      const absQty = new Decimal(event.quantity).abs();
      const costPerUnit = absQty.greaterThan(0)
        ? totalCostBasis.dividedBy(absQty).toDecimalPlaces(6).toString()
        : '0';
      lines.push(
        makeLine(draftId, lineNo++, stockLedger, totalCostBasis, 'CR', skipInventory ? {} : {
          security_id: event.security_id,
          quantity: event.quantity,
          rate: costPerUnit,
          stock_item_name: stockItemNameForEvent(event),
        }),
      );
    }
  }

  const qty = new Decimal(event.quantity).abs();
  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    // All trade vouchers are Journal vouchers. Inventory flows through via
    // the F12 "Use Inventory Allocations for Ledgers" flag on the investment
    // ledger master (ISINVENTORYAFFECTED=Yes). See bug-report PDF pages 5-6.
    //
    // Investor mode deliberately leaves invoice_intent as NONE so the Tally
    // XML serializer does not flip VCHTYPE to "Purchase"/"Sales". Investor
    // trades must land in the Journal register, not Sales/Purchase register,
    // to match the Capital Account / ITR-2 methodology.
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: invoiceIntentForTrade(event, effectiveProfile),
    voucher_date: event.event_date,
    // Voucher number = CN number / security symbol. See buildBuyVoucher for
    // the rationale and disambiguation strategy.
    external_reference: event.contract_note_ref
      ? `${event.contract_note_ref}/${symbol}`
      : event.external_ref ?? null,
    narrative: withTradeReviewNarrative(
      buildTradeNarrative('sell', symbol, qty, event.rate, chargeEvents),
      event,
    ),
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [event.event_id, ...chargeEvents.map((ce) => ce.event_id)],
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  assertInvestorTradeVoucherContract(draft, effectiveProfile, event);
  return draft;
}

// ---------------------------------------------------------------------------
// buildSettlementVoucher
// ---------------------------------------------------------------------------

/**
 * Build a Receipt or Payment voucher for a BANK_RECEIPT / BANK_PAYMENT event.
 *
 * BANK_RECEIPT (funds received from Zerodha — typically sale proceeds payout):
 *   DR  Bank Account
 *   CR  Zerodha Broking
 *
 * BANK_PAYMENT (funds sent to Zerodha — typically purchase pay-in):
 *   DR  Zerodha Broking
 *   CR  Bank Account
 */
export function buildSettlementVoucher(
  event: CanonicalEvent,
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const amount = new Decimal(event.gross_amount);
  const lines: VoucherLine[] = [];
  const bankName = tallyProfile?.bank.name ?? L.BANK.name;
  const brokerName = tallyProfile?.broker.name ?? L.BROKER.name;

  if (event.event_type === EventType.BANK_RECEIPT) {
    lines.push(makeLine(draftId, 1, bankName, amount, 'DR'));
    lines.push(makeLine(draftId, 2, brokerName, amount, 'CR'));
  } else {
    // BANK_PAYMENT
    lines.push(makeLine(draftId, 1, brokerName, amount, 'DR'));
    lines.push(makeLine(draftId, 2, bankName, amount, 'CR'));
  }

  const isReceipt = event.event_type === EventType.BANK_RECEIPT;
  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: isReceipt ? VoucherType.RECEIPT : VoucherType.PAYMENT,
    invoice_intent: InvoiceIntent.NONE,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? null,
    narrative: event.external_ref ?? (isReceipt ? 'Funds received' : 'Funds paid'),
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [event.event_id],
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  return draft;
}

// ---------------------------------------------------------------------------
// buildDividendVoucher
// ---------------------------------------------------------------------------

export function buildDividendVoucher(
  event: CanonicalEvent,
  tdsChargeEvents: CanonicalEvent[] = [],
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const symbol = symbolFromEvent(event);
  const grossAmount = new Decimal(event.gross_amount);
  const bankName = tallyProfile?.bank.name ?? L.BANK.name;
  const dividendLedger = tallyProfile
    ? resolveDividendLedger(tallyProfile, symbol).name
    : L.DIVIDEND_INCOME.name;

  // Sum TDS algebraically. Individual TDS events can be negative on real
  // data (rare: post-facto TDS refunds bundled with the dividend posting).
  // We no longer reject — instead we emit a CR TDS line to represent the
  // refund so the voucher balances.
  const tdsTotal = tdsChargeEvents.reduce(
    (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
    new Decimal(0),
  );
  const netAmount = grossAmount.sub(tdsTotal);

  const lines: VoucherLine[] = [];
  let lineNo = 1;
  const tdsLedger = tallyProfile?.tdsOnDividend.name ?? L.TDS_ON_DIVIDEND.name;

  // DR: Bank receives the net amount (gross minus TDS). If TDS is negative
  // (refund case), netAmount > grossAmount — the bank still debits the
  // actual amount received.
  lines.push(makeLine(draftId, lineNo++, bankName, netAmount, 'DR'));

  // DR: TDS deducted at source (normal case, tdsTotal > 0).
  if (tdsTotal.greaterThan(0)) {
    lines.push(makeLine(draftId, lineNo++, tdsLedger, tdsTotal, 'DR'));
  }

  // CR: Dividend income at gross
  lines.push(makeLine(draftId, lineNo++, dividendLedger, grossAmount, 'CR'));

  // CR: TDS refund (negative-TDS case). Balances the voucher when the
  // broker/issuer refunds previously-deducted TDS alongside the dividend.
  if (tdsTotal.isNegative()) {
    lines.push(makeLine(draftId, lineNo++, tdsLedger, tdsTotal.abs(), 'CR'));
  }

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: VoucherType.RECEIPT,
    invoice_intent: InvoiceIntent.NONE,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? null,
    narrative: `Dividend received - ${symbol}`,
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [event.event_id, ...tdsChargeEvents.map((ce) => ce.event_id)],
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  return draft;
}

// ---------------------------------------------------------------------------
// buildCorporateActionVoucher
// ---------------------------------------------------------------------------

/**
 * Build a voucher for a corporate action event.
 *
 * - BONUS_SHARES / STOCK_SPLIT: No journal entry needed (lot adjustment only).
 *   Returns null — the lot adjustment happens in buildVouchers before this call.
 * - MERGER_DEMERGER: Journal entry transferring cost basis from old to new security.
 * - RIGHTS_ISSUE: Purchase voucher — DR investment at issue price, CR Bank.
 */
export function buildCorporateActionVoucher(
  event: CanonicalEvent,
  costBasis: Decimal,
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft | null {
  const symbol = symbolFromEvent(event);

  // BONUS / SPLIT: No accounting entry — lot adjustment is the effect
  if (
    event.event_type === EventType.BONUS_SHARES ||
    event.event_type === EventType.STOCK_SPLIT
  ) {
    return null;
  }

  const draftId = crypto.randomUUID();

  if (event.event_type === EventType.MERGER_DEMERGER) {
    // Journal: DR new security at cost, CR old security at cost
    const newSecurityId = event.external_ref;
    const newSymbol = newSecurityId
      ? symbolFromSecurityId(newSecurityId)
      : 'NEW_SECURITY';

    const oldInvestmentLedger = tallyProfile
      ? resolveInvestmentLedger(tallyProfile, symbol).name
      : L.investmentLedger(symbol).name;
    const newInvestmentLedger = tallyProfile
      ? resolveInvestmentLedger(tallyProfile, newSymbol).name
      : L.investmentLedger(newSymbol).name;

    const lines: VoucherLine[] = [
      makeLine(draftId, 1, newInvestmentLedger, costBasis, 'DR', {
        security_id: newSecurityId,
      }),
      makeLine(draftId, 2, oldInvestmentLedger, costBasis, 'CR', {
        security_id: event.security_id,
      }),
    ];

    const draft: BuiltVoucherDraft = {
      voucher_draft_id: draftId,
      import_batch_id: event.import_batch_id,
      voucher_type: VoucherType.JOURNAL,
      invoice_intent: InvoiceIntent.NONE,
      voucher_date: event.event_date,
      external_reference: event.external_ref ?? null,
      narrative: `Merger/Demerger: ${symbol} → ${newSymbol}`,
      total_debit: '0',
      total_credit: '0',
      draft_status: VoucherStatus.DRAFT,
      source_event_ids: [event.event_id],
      created_at: new Date().toISOString(),
      lines,
    };

    assertBalanced(draft);
    return draft;
  }

  if (event.event_type === EventType.RIGHTS_ISSUE) {
    // Purchase: DR investment at issue price, CR bank
    const issuePrice = new Decimal(event.gross_amount);
    const investmentLedger = tallyProfile
      ? resolveInvestmentLedger(tallyProfile, symbol).name
      : L.investmentLedger(symbol).name;
    const bankName = tallyProfile?.bank.name ?? L.BANK.name;

    const lines: VoucherLine[] = [
      makeLine(draftId, 1, investmentLedger, issuePrice, 'DR', {
        security_id: event.security_id,
      }),
      makeLine(draftId, 2, bankName, issuePrice, 'CR'),
    ];

    const draft: BuiltVoucherDraft = {
      voucher_draft_id: draftId,
      import_batch_id: event.import_batch_id,
      voucher_type: VoucherType.JOURNAL,
      invoice_intent: InvoiceIntent.NONE,
      voucher_date: event.event_date,
      external_reference: event.external_ref ?? null,
      narrative: `Rights issue subscription - ${symbol} @ ${event.rate}`,
      total_debit: '0',
      total_credit: '0',
      draft_status: VoucherStatus.DRAFT,
      source_event_ids: [event.event_id],
      created_at: new Date().toISOString(),
      lines,
    };

    assertBalanced(draft);
    return draft;
  }

  return null;
}

// ---------------------------------------------------------------------------
// buildOffMarketTransferVoucher
// ---------------------------------------------------------------------------

/**
 * Build a DRAFT template voucher for an off-market transfer.
 *
 * Off-market transfers cannot be fully automated — the consideration (price,
 * counterparty, tax treatment) is unknown from broker data alone. The voucher
 * is created as DRAFT with a suspense account for manual review.
 */
export function buildOffMarketTransferVoucher(
  event: CanonicalEvent,
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const symbol = symbolFromEvent(event);
  const amount = new Decimal(event.gross_amount || '0');
  const effectiveAmount = amount.isZero() ? new Decimal('1') : amount;

  const investmentLedger = tallyProfile
    ? resolveInvestmentLedger(tallyProfile, symbol).name
    : L.investmentLedger(symbol).name;

  const lines: VoucherLine[] = [
    makeLine(draftId, 1, L.OFF_MARKET_SUSPENSE.name, effectiveAmount, 'DR'),
    makeLine(draftId, 2, investmentLedger, effectiveAmount, 'CR', {
      security_id: event.security_id,
    }),
  ];

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: InvoiceIntent.NONE,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? null,
    narrative: `Off-market transfer of ${symbol} - REQUIRES MANUAL REVIEW`,
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [event.event_id],
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  return draft;
}

// ---------------------------------------------------------------------------
// buildAuctionAdjustmentVoucher
// ---------------------------------------------------------------------------

/**
 * Build a voucher for an auction settlement.
 *
 * Accounting: DR Broker (proceeds), CR Investment (cost basis),
 * DR/CR Capital Gain/Loss (difference).
 */
export function buildAuctionAdjustmentVoucher(
  event: CanonicalEvent,
  costDisposals: CostDisposal[],
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const symbol = symbolFromEvent(event);
  const proceeds = new Decimal(event.gross_amount);

  const totalCostBasis = costDisposals.reduce(
    (sum, d) => sum.add(new Decimal(d.total_cost)),
    new Decimal(0),
  );
  const gainOrLoss = proceeds.sub(totalCostBasis);

  const brokerName = tallyProfile?.broker.name ?? L.BROKER.name;
  const investmentLedger = tallyProfile
    ? resolveInvestmentLedger(tallyProfile, symbol).name
    : L.investmentLedger(symbol).name;

  const lines: VoucherLine[] = [];
  let lineNo = 1;

  // DR: Broker for auction proceeds
  lines.push(makeLine(draftId, lineNo++, brokerName, proceeds, 'DR'));

  // CR: Investment at cost basis
  lines.push(makeLine(draftId, lineNo++, investmentLedger, totalCostBasis, 'CR', {
    security_id: event.security_id,
  }));

  // DR/CR: Capital gain/loss
  const isGain = gainOrLoss.greaterThanOrEqualTo(0);
  if (isGain) {
    const gainLedger = tallyProfile
      ? resolveCapitalGainLedger(tallyProfile, symbol, undefined, true).name
      : L.STCG_PROFIT.name;
    lines.push(makeLine(draftId, lineNo++, gainLedger, gainOrLoss, 'CR'));
  } else {
    const lossLedger = tallyProfile
      ? resolveCapitalGainLedger(tallyProfile, symbol, undefined, false).name
      : L.STCG_LOSS.name;
    lines.push(makeLine(draftId, lineNo++, lossLedger, gainOrLoss.abs(), 'DR'));
  }

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: InvoiceIntent.NONE,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? null,
    narrative: `Auction settlement of ${symbol}`,
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [event.event_id],
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  return draft;
}

// ---------------------------------------------------------------------------
// buildSttSummaryVoucher — lump-sum STT journal
// ---------------------------------------------------------------------------

/**
 * Build a single JOURNAL voucher that posts the total STT for the batch.
 *
 * STT is non-deductible under the Income Tax Act — it cannot be part of cost
 * basis (investment) or claimed as a business expense (trader).  Individual
 * trade vouchers exclude STT entirely to keep entries clean.  This lump-sum
 * journal records the cash outflow so the Zerodha Ledger reconciles with the
 * broker statement.
 *
 * Normal case (net STT > 0):
 *   DR  STT                                  {total STT}
 *   CR  Zerodha Broking                      {total STT}
 *
 * Negative-sign case (net STT < 0 — e.g. broker reversed/refunded STT on a
 * cancelled or corrected trade): flip DR/CR so the voucher stays balanced
 * and the broker cash flow mirrors the refund.
 *
 *   DR  Zerodha Broking                      {|total STT|}
 *   CR  STT                                  {|total STT|}
 *
 * Individual STT events can legitimately be negative on real Zerodha data
 * (trade corrections, post-close adjustments). We sum algebraically rather
 * than reject — matching the same "absorb and let Tally reconcile" philosophy
 * used for sell-side charge rebates and uncovered FIFO disposals.
 */
export function buildSttSummaryVoucher(
  sttEvents: CanonicalEvent[],
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft | null {
  if (sttEvents.length === 0) return null;

  const totalStt = sttEvents.reduce(
    (sum, e) => sum.add(new Decimal(e.charge_amount)),
    new Decimal(0),
  );
  if (totalStt.isZero()) return null;

  const dates = sttEvents.map((e) => e.event_date).sort();
  const earliest = dates[0];
  const latest = dates[dates.length - 1];
  const tradeCount = sttEvents.length;

  const sttLedger = tallyProfile
    ? resolveChargeLedger(tallyProfile, EventType.STT).name
    : L.STT.name;
  const brokerLedger = tallyProfile?.broker.name ?? L.BROKER.name;

  const draftId = crypto.randomUUID();
  const isRefund = totalStt.isNegative();
  const absAmount = totalStt.abs();
  const lines: VoucherLine[] = isRefund
    ? [
        makeLine(draftId, 1, brokerLedger, absAmount, 'DR'),
        makeLine(draftId, 2, sttLedger, absAmount, 'CR'),
      ]
    : [
        makeLine(draftId, 1, sttLedger, totalStt, 'DR'),
        makeLine(draftId, 2, brokerLedger, totalStt, 'CR'),
      ];

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: sttEvents[0].import_batch_id,
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: InvoiceIntent.NONE,
    voucher_date: latest,
    external_reference: null,
    narrative: `STT for period ${earliest} to ${latest} — ${tradeCount} trade(s)`,
    total_debit: '0',
    total_credit: '0',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: sttEvents.map((e) => e.event_id),
    created_at: new Date().toISOString(),
    lines,
  };

  assertBalanced(draft);
  return draft;
}

// ---------------------------------------------------------------------------
// buildVouchers — main orchestrator
// ---------------------------------------------------------------------------

/**
 * Process a list of CanonicalEvents in chronological order and produce
 * VoucherDraft objects.
 *
 * Processing logic:
 * 1. Sort events by event_date ascending so lots are added/consumed in order.
 * 2. Separate trade events from charge events.
 * 3. Group charge events with their parent trade event by matching date + security.
 * 4. For each BUY_TRADE: add lot to tracker, then build buy voucher.
 * 5. For each SELL_TRADE: dispose lots, build sell voucher with disposals.
 * 6. For each BANK_RECEIPT / BANK_PAYMENT: build settlement voucher.
 * 7. For each DIVIDEND: build dividend voucher.
 *
 * Charge events that cannot be matched to a trade event are skipped (they
 * would require a contract note to associate them correctly).
 */
export function buildVouchers(
  events: CanonicalEvent[],
  profile: AccountingProfile,
  costTracker: CostLotTracker,
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft[] {
  const ambiguousTrade = events.find(
    (event) =>
      (event.event_type === EventType.BUY_TRADE || event.event_type === EventType.SELL_TRADE) &&
      event.trade_classification === TradeClassification.PROFILE_DRIVEN,
  );
  if (ambiguousTrade) {
    throw new PipelineValidationError(
      'E_CLASSIFICATION_AMBIGUOUS',
      'Ambiguous trade classification must be resolved before voucher generation.',
      {
        event_id: ambiguousTrade.event_id,
        security_id: ambiguousTrade.security_id,
        event_date: ambiguousTrade.event_date,
        source_row_ids: ambiguousTrade.source_row_ids,
      },
    );
  }

  // Sort by date ascending, then by event type (BUY before SELL on same day)
  const sorted = [...events].sort((a, b) => {
    const dateCmp = a.event_date.localeCompare(b.event_date);
    if (dateCmp !== 0) return dateCmp;
    // BUY_TRADE < SELL_TRADE < other
    const typeOrder = (t: EventType) =>
      t === EventType.BUY_TRADE ? 0 : t === EventType.SELL_TRADE ? 1 : 2;
    return typeOrder(a.event_type) - typeOrder(b.event_type);
  });

  const vouchers: BuiltVoucherDraft[] = [];

  // Build an index of charge events.
  // When external_ref (trade_no) is present, key by "date|security|trade_no"
  // for trade-level precision (contract-note flow). Otherwise fall back to
  // "date|security" (tradebook-only flow).
  const chargeIndex = new Map<string, CanonicalEvent[]>();
  for (const e of sorted) {
    if (isChargeEvent(e)) {
      const key = e.external_ref
        ? `${e.event_date}|${e.security_id ?? 'NONE'}|${e.external_ref}`
        : `${e.event_date}|${e.security_id ?? 'NONE'}`;
      if (!chargeIndex.has(key)) chargeIndex.set(key, []);
      chargeIndex.get(key)!.push(e);
    }
  }

  const handledChargeIds = new Set<string>();

  // Collect STT events filtered from trade vouchers for the lump-sum journal
  const filteredSttEvents: CanonicalEvent[] = [];

  const filterVoucherChargeEvents = (
    chargeEvents: CanonicalEvent[],
    tradeEventType: EventType.BUY_TRADE | EventType.SELL_TRADE,
  ): CanonicalEvent[] =>
    chargeEvents.filter((chargeEvent) => {
      if (chargeEvent.event_type === EventType.STT) {
        filteredSttEvents.push(chargeEvent);
        return false;
      }

      if (
        tradeEventType === EventType.SELL_TRADE &&
        chargeEvent.event_type === EventType.STAMP_DUTY
      ) {
        return false;
      }

      return true;
    });

  for (const event of sorted) {
    if (isChargeEvent(event)) continue; // handled inline with trade events

    switch (event.event_type) {
      case EventType.BUY_TRADE: {
        const chargeKey = event.external_ref
          ? `${event.event_date}|${event.security_id ?? 'NONE'}|${event.external_ref}`
          : `${event.event_date}|${event.security_id ?? 'NONE'}`;
        const chargeEvents = filterVoucherChargeEvents(
          chargeIndex.get(chargeKey) ?? [],
          EventType.BUY_TRADE,
        );
        chargeEvents.forEach((ce) => handledChargeIds.add(ce.event_id));

        // Compute total capitalised cost if applicable
        let additionalCost: string | undefined;
        const effectiveProfile = deriveEffectiveProfile(profile, event);
        if (shouldCapitalizeBuyCharges(effectiveProfile) && chargeEvents.length > 0) {
          const totalCharges = chargeEvents
            .reduce(
              (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
              new Decimal(0),
            )
            .toFixed(2);
          additionalCost = totalCharges;
        }

        // Add lot to the tracker before building the voucher
        costTracker.addLot(event, additionalCost);

        vouchers.push(buildBuyVoucher(event, profile, chargeEvents, tallyProfile));
        break;
      }

      case EventType.SELL_TRADE: {
        const chargeKey = event.external_ref
          ? `${event.event_date}|${event.security_id ?? 'NONE'}|${event.external_ref}`
          : `${event.event_date}|${event.security_id ?? 'NONE'}`;
        const chargeEvents = filterVoucherChargeEvents(
          chargeIndex.get(chargeKey) ?? [],
          EventType.SELL_TRADE,
        );
        chargeEvents.forEach((ce) => handledChargeIds.add(ce.event_id));

        const disposals = costTracker.disposeLots(
          event,
          profile.cost_basis_method as 'FIFO' | 'WEIGHTED_AVERAGE',
        );

        const holdingPeriodDays = calculateHoldingPeriodDays(event.event_date, disposals);
        vouchers.push(
          buildSellVoucher(
            event,
            profile,
            chargeEvents,
            disposals,
            holdingPeriodDays,
            tallyProfile,
          ),
        );
        break;
      }

      case EventType.BANK_RECEIPT:
      case EventType.BANK_PAYMENT:
        vouchers.push(buildSettlementVoucher(event, tallyProfile));
        break;

      case EventType.DIVIDEND: {
        // Look up TDS charge events using date|security key
        const tdsKey = `${event.event_date}|${event.security_id ?? 'NONE'}`;
        const allDivCharges = chargeIndex.get(tdsKey) ?? [];
        const tdsCharges = allDivCharges.filter(
          (ce) => ce.event_type === EventType.TDS_ON_DIVIDEND,
        );
        tdsCharges.forEach((ce) => handledChargeIds.add(ce.event_id));
        vouchers.push(buildDividendVoucher(event, tdsCharges, tallyProfile));
        break;
      }

      case EventType.BONUS_SHARES:
      case EventType.STOCK_SPLIT: {
        // Lot adjustment only — no journal entry.
        // Both bonus and split preserve total cost: qty multiplied, unit cost divided
        // by the same factor. costDivisor defaults to quantityMultiplier.
        //
        // When the corporate action changes the ISIN (e.g. IRCTC's 1:5 split
        // migrated INE335Y01012 → INE335Y01020 on face-value change), the
        // CorporateActionInput stores the new security_id in `external_ref`.
        // We forward it as `newSecurityId` so lots are migrated to the new
        // key and post-split sells find their matching opening position.
        // When external_ref is absent (typical split with no ISIN change),
        // adjustLots leaves lots on the existing security_id.
        const ratio = new Decimal(event.rate);
        if (event.security_id) {
          const newSecurityId =
            event.external_ref && event.external_ref !== event.security_id
              ? event.external_ref
              : undefined;
          costTracker.adjustLots({
            securityId: event.security_id,
            quantityMultiplier: ratio,
            // costDivisor defaults to ratio → total cost preserved
            newSecurityId,
            preserveAcquisitionDate: true,
          });
        }
        break;
      }

      case EventType.MERGER_DEMERGER: {
        // Compute total cost basis of old lots before adjustment
        const oldLots = event.security_id ? costTracker.getOpenLots(event.security_id) : [];
        const costBasis = oldLots.reduce(
          (sum, lot) => sum.add(new Decimal(lot.open_quantity).mul(new Decimal(lot.effective_unit_cost))),
          new Decimal(0),
        );
        // Adjust lots (transfer to new security)
        const ratio = new Decimal(event.rate);
        if (event.security_id) {
          costTracker.adjustLots({
            securityId: event.security_id,
            quantityMultiplier: ratio,
            newSecurityId: event.external_ref ?? undefined,
            preserveAcquisitionDate: false,
            actionDate: event.event_date,
          });
        }
        const v = buildCorporateActionVoucher(event, costBasis, tallyProfile);
        if (v) vouchers.push(v);
        break;
      }

      case EventType.RIGHTS_ISSUE: {
        const v = buildCorporateActionVoucher(event, new Decimal(0), tallyProfile);
        if (v) vouchers.push(v);
        break;
      }

      case EventType.OFF_MARKET_TRANSFER:
        vouchers.push(buildOffMarketTransferVoucher(event, tallyProfile));
        break;

      case EventType.AUCTION_ADJUSTMENT: {
        let auctionDisposals: CostDisposal[] = [];
        try {
          auctionDisposals = costTracker.disposeLots(
            { ...event, event_type: EventType.SELL_TRADE } as CanonicalEvent,
            profile.cost_basis_method as 'FIFO' | 'WEIGHTED_AVERAGE',
          );
        } catch {
          const qty = new Decimal(event.quantity).abs();
          auctionDisposals = [{
            lot_id: 'UNKNOWN',
            acquisition_date: event.event_date,
            quantity_sold: qty.isZero() ? '1' : qty.toFixed(),
            unit_cost: '0',
            total_cost: '0',
            gain_or_loss: new Decimal(event.gross_amount).toFixed(2),
          }];
        }
        vouchers.push(buildAuctionAdjustmentVoucher(event, auctionDisposals, tallyProfile));
        break;
      }

      default:
        break;
    }
  }

  // Lump-sum STT journal: one entry for all STT filtered from trade vouchers.
  // STT is non-deductible (not part of cost basis or expense) but the money
  // flows through the broker account, so recording it keeps the Zerodha
  // Ledger reconcilable with the broker statement.
  const sttVoucher = buildSttSummaryVoucher(filteredSttEvents, tallyProfile);
  if (sttVoucher) vouchers.push(sttVoucher);

  return vouchers;
}
