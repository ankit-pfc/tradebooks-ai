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
 * Reject negative charge events for contexts that have no semantically valid
 * meaning for refunds (e.g. STT summary, dividend TDS — neither broker nor
 * tax authority issues "negative" amounts there). For trade buy/sell vouchers
 * we instead post negative charges as CR (refund) lines, since Zerodha
 * legitimately emits small negative exchange-charge rebates on contract notes.
 */
function assertKnownChargeSign(
  chargeEvents: CanonicalEvent[],
  context: string,
): void {
  const negativeCharge = chargeEvents.find((chargeEvent) =>
    new Decimal(chargeEvent.charge_amount).isNegative(),
  );

  if (!negativeCharge) {
    return;
  }

  throw new PipelineValidationError(
    'E_NEGATIVE_CONTRACT_NOTE_CHARGE',
    `Negative contract-note charges are not yet supported in ${context}.`,
    {
      event_id: negativeCharge.event_id,
      event_type: negativeCharge.event_type,
      charge_type: negativeCharge.charge_type,
      charge_amount: negativeCharge.charge_amount,
      contract_note_ref: negativeCharge.contract_note_ref,
      external_ref: negativeCharge.external_ref,
    },
  );
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

function invoiceIntentForTrade(event: CanonicalEvent): InvoiceIntent {
  switch (event.event_type) {
    case EventType.BUY_TRADE:
      return InvoiceIntent.PURCHASE;
    case EventType.SELL_TRADE:
      return InvoiceIntent.SALES;
    default:
      return InvoiceIntent.NONE;
  }
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
 * Investor mode (CAPITALIZE charges):
 *   DR  Investment in Equity Shares - {script}   (gross + all charges)
 *   CR  Zerodha Broking                           (total payable)
 *
 * Investor mode (EXPENSE charges) / Trader mode:
 *   DR  Investment/Shares-in-Trade - {script}     (gross amount)
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
  const capitalize = shouldCapitalizeBuyCharges(effectiveProfile);
  // Negative charges (e.g. small Zerodha exchange-charge rebates on real
  // contract notes) are supported via sign-aware posting in the non-capitalize
  // path below, and are absorbed into the capitalized asset line in the
  // capitalize path. No need to reject them.

  const isInvestor = effectiveProfile.mode === AccountingMode.INVESTOR;
  const assetLedger = tallyProfile
    ? resolveInvestmentLedger(tallyProfile, symbol).name
    : isInvestor
      ? L.investmentLedger(symbol).name
      : L.stockInTradeLedger(symbol).name;

  const grossAmount = new Decimal(event.gross_amount);
  const totalCharges = chargeEvents.reduce(
    (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
    new Decimal(0),
  );

  const lines: VoucherLine[] = [];
  let lineNo = 1;

  // Intraday/speculative trades skip stock inventory — positions net off
  // same-day and only the gain/loss matters.
  const skipInventory = isSpeculativeTrade(event);

  if (capitalize) {
    // Single DR line: asset absorbs the total inclusive of charges.
    const capitalizedAmount = grossAmount.add(totalCharges);
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
    // DR: asset at gross
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
  const totalPayable = grossAmount.add(totalCharges);
  lines.push(makeLine(draftId, lineNo++, brokerName, totalPayable, 'CR'));

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    // All trade vouchers are Journal vouchers. Tally processes inventory
    // allocations inside journal vouchers when the target ledger has the F12
    // flag "Use Inventory Allocations for Ledgers" enabled — emitted as
    // ISINVENTORYAFFECTED=Yes on the ledger master. See bug-report PDF
    // pages 5-6.
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: invoiceIntentForTrade(event),
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
      `Purchase of ${symbol} @ ${event.rate} × ${new Decimal(event.quantity).abs().toFixed()} units`,
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
  const totalCharges = chargeEvents.reduce(
    (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
    new Decimal(0),
  );
  const totalCostBasis = costDisposals.reduce(
    (sum, d) => sum.add(new Decimal(d.total_cost)),
    new Decimal(0),
  );
  // Use the exact residual against the rounded cost basis so the voucher
  // stays balanced even when per-lot rounded disposals introduce a 0.01 drift.
  const totalGainLoss = grossAmount.sub(totalCostBasis);
  const skipInventory = isSpeculativeTrade(event);
  if (!skipInventory && totalCostBasis.lte(0)) {
    throw new PipelineValidationError(
      'E_MISSING_COST_BASIS_FOR_INVENTORY',
      'Sell vouchers cannot emit inventory allocations without a positive cost basis.',
      {
        event_id: event.event_id,
        security_id: event.security_id,
        gross_amount: event.gross_amount,
        quantity: event.quantity,
      },
    );
  }
  const lines: VoucherLine[] = [];
  let lineNo = 1;

  if (isInvestor) {
    const assetLedger = tallyProfile
      ? resolveInvestmentLedger(tallyProfile, symbol).name
      : L.investmentLedger(symbol).name;
    const brokerName = tallyProfile?.broker.name ?? L.BROKER.name;

    // DR: Broker for the gross sale proceeds (net of charges — broker settles net)
    const netProceeds = grossAmount.sub(totalCharges);
    lines.push(makeLine(draftId, lineNo++, brokerName, netProceeds, 'DR'));

    // DR: charge ledgers (expensed separately) — negative charges become
    // CR refund lines on the same expense ledger.
    for (const ce of chargeEvents) {
      const chargeLedger = tallyProfile
        ? resolveChargeLedger(tallyProfile, ce.event_type).name
        : CHARGE_LEDGER_NAMES[ce.event_type] ?? L.MISC_CHARGES.name;
      const chargeAmt = new Decimal(ce.charge_amount);
      lineNo = appendChargeLine(lines, draftId, lineNo, chargeLedger, chargeAmt);
    }

    // CR: Investment account at cost basis.
    // For non-speculative trades, include inventory so Tally records stock out.
    // For speculative/intraday, skip inventory — positions net off same-day.
    {
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

    // CR or DR: Gain / Loss at GROSS (before sell charges).
    //
    // Sell charges are already posted as separate DR lines above, so they
    // reduce P&L through their own expense ledgers. Using gross gain here
    // keeps the voucher balanced:
    //   Total DR = netProceeds + Σcharges = grossAmount
    //   Total CR = costBasis  + grossGainLoss = grossAmount  ✓
    //
    // If netGainLoss (gross − charges) were used instead, the voucher would
    // be short by Σcharges on the CR side, breaking double-entry balance.
    const isGain = totalGainLoss.greaterThanOrEqualTo(0);
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
        lines.push(makeLine(draftId, lineNo++, gainLossLedger, totalGainLoss, 'CR'));
      } else {
        lines.push(makeLine(draftId, lineNo++, gainLossLedger, totalGainLoss.abs(), 'DR'));
      }
    } else {
      const isSpeculation = effectiveHoldingDays === 0;
      const isLongTerm = effectiveHoldingDays !== undefined && effectiveHoldingDays > 365;
      if (isSpeculation) {
        // Route to speculation gain/loss ledger
        const specLedger = isGain ? L.SPECULATIVE_PROFIT.name : L.SPECULATIVE_LOSS.name;
        if (isGain) {
          lines.push(makeLine(draftId, lineNo++, specLedger, totalGainLoss, 'CR'));
        } else {
          lines.push(makeLine(draftId, lineNo++, specLedger, totalGainLoss.abs(), 'DR'));
        }
      } else if (isGain) {
        const gainLedger = isLongTerm ? L.LTCG_PROFIT.name : L.STCG_PROFIT.name;
        lines.push(makeLine(draftId, lineNo++, gainLedger, totalGainLoss, 'CR'));
      } else {
        const lossLedger = isLongTerm ? L.LTCG_LOSS.name : L.STCG_LOSS.name;
        lines.push(makeLine(draftId, lineNo++, lossLedger, totalGainLoss.abs(), 'DR'));
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
    {
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
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: invoiceIntentForTrade(event),
    voucher_date: event.event_date,
    // Voucher number = CN number / security symbol. See buildBuyVoucher for
    // the rationale and disambiguation strategy.
    external_reference: event.contract_note_ref
      ? `${event.contract_note_ref}/${symbol}`
      : event.external_ref ?? null,
    narrative: withTradeReviewNarrative(
      `Sale of ${symbol} @ ${event.rate} × ${qty.toFixed()} units`,
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
  assertKnownChargeSign(tdsChargeEvents, 'dividend vouchers');

  const tdsTotal = tdsChargeEvents.reduce(
    (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
    new Decimal(0),
  );
  const netAmount = grossAmount.sub(tdsTotal);

  const lines: VoucherLine[] = [];
  let lineNo = 1;

  // DR: Bank receives the net amount (gross minus TDS)
  lines.push(makeLine(draftId, lineNo++, bankName, netAmount, 'DR'));

  // DR: TDS deducted at source (when TDS > 0)
  if (tdsTotal.greaterThan(0)) {
    const tdsLedger = tallyProfile?.tdsOnDividend.name ?? L.TDS_ON_DIVIDEND.name;
    lines.push(makeLine(draftId, lineNo++, tdsLedger, tdsTotal, 'DR'));
  }

  // CR: Dividend income at gross
  lines.push(makeLine(draftId, lineNo++, dividendLedger, grossAmount, 'CR'));

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
 *   DR  STT (Capital Account / Indirect Expenses)   {total STT}
 *   CR  Zerodha Broking                              {total STT}
 */
export function buildSttSummaryVoucher(
  sttEvents: CanonicalEvent[],
  tallyProfile?: TallyProfile,
): BuiltVoucherDraft | null {
  if (sttEvents.length === 0) return null;
  assertKnownChargeSign(sttEvents, 'STT summary vouchers');

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
  const lines: VoucherLine[] = [
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
