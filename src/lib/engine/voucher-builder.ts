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
} from '../types/accounting';
import {
  VoucherStatus,
  VoucherType,
  type VoucherDraft,
  type VoucherLine,
} from '../types/vouchers';
import type { CostDisposal } from './cost-lots';
import type { CostLotTracker } from './cost-lots';

type BuiltVoucherDraft = VoucherDraft & { lines: VoucherLine[] };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract the security symbol from a composite security_id ("EXCHANGE:SYMBOL"). */
function symbolFromSecurityId(securityId: string | null): string {
  if (!securityId) return 'UNKNOWN';
  const parts = securityId.split(':');
  return parts.length > 1 ? parts[1] : securityId;
}

/** Interpolate {script} placeholder in a ledger name template. */
function resolveLedger(template: string, symbol: string): string {
  return template.replace('{script}', symbol);
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
    cost_center: null,
    bill_ref: null,
  };
}

/** Validate and throw if the voucher is imbalanced. */
function assertBalanced(draft: BuiltVoucherDraft): void {
  const totalDr = draft.lines
    .filter((l) => l.dr_cr === 'DR')
    .reduce((s, l) => s.add(new Decimal(l.amount)), new Decimal(0));
  const totalCr = draft.lines
    .filter((l) => l.dr_cr === 'CR')
    .reduce((s, l) => s.add(new Decimal(l.amount)), new Decimal(0));

  if (!totalDr.equals(totalCr)) {
    throw new Error(
      `Voucher ${draft.voucher_draft_id} is imbalanced: DR=${totalDr.toFixed(2)} CR=${totalCr.toFixed(2)}`,
    );
  }

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

// ---------------------------------------------------------------------------
// Charge event helpers
// ---------------------------------------------------------------------------

/** Map a charge EventType to its canonical ledger name. */
const CHARGE_LEDGER_NAMES: Partial<Record<EventType, string>> = {
  [EventType.BROKERAGE]: 'Brokerage',
  [EventType.STT]: 'STT',
  [EventType.EXCHANGE_CHARGE]: 'Exchange Transaction Charges',
  [EventType.SEBI_CHARGE]: 'SEBI Charges',
  [EventType.GST_ON_CHARGES]: 'GST on Brokerage/Charges',
  [EventType.STAMP_DUTY]: 'Stamp Duty',
  [EventType.DP_CHARGE]: 'DP Charges',
};

const CHARGE_EVENT_TYPES = new Set<EventType>([
  EventType.BROKERAGE,
  EventType.STT,
  EventType.EXCHANGE_CHARGE,
  EventType.SEBI_CHARGE,
  EventType.GST_ON_CHARGES,
  EventType.STAMP_DUTY,
  EventType.DP_CHARGE,
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
): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const symbol = symbolFromSecurityId(event.security_id);
  const capitalize = shouldCapitalizeBuyCharges(profile);

  const isInvestor = profile.mode === AccountingMode.INVESTOR;
  const assetLedger = resolveLedger(
    isInvestor
      ? 'Investment in Equity Shares - {script}'
      : 'Shares-in-Trade - {script}',
    symbol,
  );

  const grossAmount = new Decimal(event.gross_amount);
  const totalCharges = chargeEvents.reduce(
    (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
    new Decimal(0),
  );

  const lines: VoucherLine[] = [];
  let lineNo = 1;

  if (capitalize) {
    // Single DR line: asset absorbs the total inclusive of charges
    lines.push(
      makeLine(draftId, lineNo++, assetLedger, grossAmount.add(totalCharges), 'DR', {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: event.rate,
      }),
    );
  } else {
    // DR: asset at gross
    lines.push(
      makeLine(draftId, lineNo++, assetLedger, grossAmount, 'DR', {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: event.rate,
      }),
    );
    // DR: each charge to its expense ledger
    for (const ce of chargeEvents) {
      const chargeLedger = CHARGE_LEDGER_NAMES[ce.event_type] ?? 'Miscellaneous Charges';
      const chargeAmt = new Decimal(ce.charge_amount);
      if (chargeAmt.greaterThan(0)) {
        lines.push(makeLine(draftId, lineNo++, chargeLedger, chargeAmt, 'DR'));
      }
    }
  }

  // CR: Zerodha Broking — total payable (gross + charges always)
  const totalPayable = grossAmount.add(totalCharges);
  lines.push(makeLine(draftId, lineNo++, 'Zerodha Broking', totalPayable, 'CR'));

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: VoucherType.PURCHASE,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? event.contract_note_ref ?? null,
    narrative: `Purchase of ${symbol} @ ${event.rate} × ${new Decimal(event.quantity).abs().toFixed()} units`,
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
): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const symbol = symbolFromSecurityId(event.security_id);
  const isInvestor = profile.mode === AccountingMode.INVESTOR;

  const grossAmount = new Decimal(event.gross_amount);
  const totalCharges = chargeEvents.reduce(
    (sum, ce) => sum.add(new Decimal(ce.charge_amount)),
    new Decimal(0),
  );
  const totalCostBasis = costDisposals.reduce(
    (sum, d) => sum.add(new Decimal(d.total_cost)),
    new Decimal(0),
  );
  const totalGainLoss = costDisposals.reduce(
    (sum, d) => sum.add(new Decimal(d.gain_or_loss)),
    new Decimal(0),
  );
  // Net gain after sell charges (sell charges reduce gain for investors)
  const netGainLoss = totalGainLoss.sub(totalCharges);

  const lines: VoucherLine[] = [];
  let lineNo = 1;

  if (isInvestor) {
    const assetLedger = resolveLedger(
      'Investment in Equity Shares - {script}',
      symbol,
    );

    // DR: Zerodha Broking for the gross sale proceeds (net of charges — broker settles net)
    const netProceeds = grossAmount.sub(totalCharges);
    lines.push(makeLine(draftId, lineNo++, 'Zerodha Broking', netProceeds, 'DR'));

    // DR: charge ledgers (expensed)
    for (const ce of chargeEvents) {
      const chargeLedger =
        CHARGE_LEDGER_NAMES[ce.event_type] ?? 'Miscellaneous Charges';
      const chargeAmt = new Decimal(ce.charge_amount);
      if (chargeAmt.greaterThan(0)) {
        lines.push(makeLine(draftId, lineNo++, chargeLedger, chargeAmt, 'DR'));
      }
    }

    // CR: Investment account at cost basis
    lines.push(
      makeLine(draftId, lineNo++, assetLedger, totalCostBasis, 'CR', {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: event.rate,
      }),
    );

    // CR or DR: Gain / Loss
    if (netGainLoss.greaterThanOrEqualTo(0)) {
      lines.push(
        makeLine(draftId, lineNo++, 'Profit on Sale of Investments', netGainLoss, 'CR'),
      );
    } else {
      lines.push(
        makeLine(draftId, lineNo++, 'Loss on Sale of Investments', netGainLoss.abs(), 'DR'),
      );
    }
  } else {
    // Trader mode
    const stockLedger = resolveLedger('Shares-in-Trade - {script}', symbol);

    // DR: Zerodha Broking for net sale proceeds
    const netProceeds = grossAmount.sub(totalCharges);
    lines.push(makeLine(draftId, lineNo++, 'Zerodha Broking', netProceeds, 'DR'));

    // DR: charge ledgers
    for (const ce of chargeEvents) {
      const chargeLedger =
        CHARGE_LEDGER_NAMES[ce.event_type] ?? 'Miscellaneous Charges';
      const chargeAmt = new Decimal(ce.charge_amount);
      if (chargeAmt.greaterThan(0)) {
        lines.push(makeLine(draftId, lineNo++, chargeLedger, chargeAmt, 'DR'));
      }
    }

    // DR: Cost of Shares Sold
    lines.push(
      makeLine(draftId, lineNo++, 'Cost of Shares Sold', totalCostBasis, 'DR'),
    );

    // CR: Trading Sales at gross
    lines.push(makeLine(draftId, lineNo++, 'Trading Sales', grossAmount, 'CR'));

    // CR: Shares-in-Trade at cost basis
    lines.push(
      makeLine(draftId, lineNo++, stockLedger, totalCostBasis, 'CR', {
        security_id: event.security_id,
        quantity: event.quantity,
        rate: event.rate,
      }),
    );
  }

  const qty = new Decimal(event.quantity).abs();
  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: VoucherType.SALES,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? event.contract_note_ref ?? null,
    narrative: `Sale of ${symbol} @ ${event.rate} × ${qty.toFixed()} units`,
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
export function buildSettlementVoucher(event: CanonicalEvent): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const amount = new Decimal(event.gross_amount);
  const lines: VoucherLine[] = [];

  if (event.event_type === EventType.BANK_RECEIPT) {
    lines.push(makeLine(draftId, 1, 'Bank Account', amount, 'DR'));
    lines.push(makeLine(draftId, 2, 'Zerodha Broking', amount, 'CR'));
  } else {
    // BANK_PAYMENT
    lines.push(makeLine(draftId, 1, 'Zerodha Broking', amount, 'DR'));
    lines.push(makeLine(draftId, 2, 'Bank Account', amount, 'CR'));
  }

  const isReceipt = event.event_type === EventType.BANK_RECEIPT;
  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: isReceipt ? VoucherType.RECEIPT : VoucherType.PAYMENT,
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

function buildDividendVoucher(event: CanonicalEvent): BuiltVoucherDraft {
  const draftId = crypto.randomUUID();
  const amount = new Decimal(event.gross_amount);
  const lines: VoucherLine[] = [
    makeLine(draftId, 1, 'Bank Account', amount, 'DR'),
    makeLine(draftId, 2, 'Dividend Income', amount, 'CR'),
  ];

  const draft: BuiltVoucherDraft = {
    voucher_draft_id: draftId,
    import_batch_id: event.import_batch_id,
    voucher_type: VoucherType.RECEIPT,
    voucher_date: event.event_date,
    external_reference: event.external_ref ?? null,
    narrative: event.external_ref ?? 'Dividend received',
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
): BuiltVoucherDraft[] {
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

  // Build an index of charge events keyed by "date|security_id"
  const chargeIndex = new Map<string, CanonicalEvent[]>();
  for (const e of sorted) {
    if (isChargeEvent(e)) {
      const key = `${e.event_date}|${e.security_id ?? 'NONE'}`;
      if (!chargeIndex.has(key)) chargeIndex.set(key, []);
      chargeIndex.get(key)!.push(e);
    }
  }

  const handledChargeIds = new Set<string>();

  for (const event of sorted) {
    if (isChargeEvent(event)) continue; // handled inline with trade events

    switch (event.event_type) {
      case EventType.BUY_TRADE: {
        const chargeKey = `${event.event_date}|${event.security_id ?? 'NONE'}`;
        const chargeEvents = chargeIndex.get(chargeKey) ?? [];
        chargeEvents.forEach((ce) => handledChargeIds.add(ce.event_id));

        // Compute total capitalised cost if applicable
        let additionalCost: string | undefined;
        if (shouldCapitalizeBuyCharges(profile) && chargeEvents.length > 0) {
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

        vouchers.push(buildBuyVoucher(event, profile, chargeEvents));
        break;
      }

      case EventType.SELL_TRADE: {
        const chargeKey = `${event.event_date}|${event.security_id ?? 'NONE'}`;
        const chargeEvents = chargeIndex.get(chargeKey) ?? [];
        chargeEvents.forEach((ce) => handledChargeIds.add(ce.event_id));

        let disposals: CostDisposal[] = [];
        try {
          disposals = costTracker.disposeLots(
            event,
            profile.cost_basis_method as 'FIFO' | 'WEIGHTED_AVERAGE',
          );
        } catch {
          // If no lots exist (e.g. partial data), create a zero-cost disposal
          // so the voucher can still be built in DRAFT status.
          const qty = new Decimal(event.quantity).abs();
          disposals = [
            {
              lot_id: 'UNKNOWN',
              quantity_sold: qty.toFixed(),
              unit_cost: '0',
              total_cost: '0',
              gain_or_loss: new Decimal(event.gross_amount).toFixed(2),
            },
          ];
        }

        vouchers.push(buildSellVoucher(event, profile, chargeEvents, disposals));
        break;
      }

      case EventType.BANK_RECEIPT:
      case EventType.BANK_PAYMENT:
        vouchers.push(buildSettlementVoucher(event));
        break;

      case EventType.DIVIDEND:
        vouchers.push(buildDividendVoucher(event));
        break;

      // All other event types (CORPORATE_ACTION, OFF_MARKET_TRANSFER, etc.)
      // are passed through as unhandled; a future builder can be added here.
      default:
        break;
    }
  }

  return vouchers;
}
