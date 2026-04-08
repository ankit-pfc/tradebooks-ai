/**
 * charge-allocator.ts
 * Distributes aggregate contract-note charges to individual trades on a given
 * trading date.  Brokerage uses the per-unit rate already present on each trade
 * row; all other charges are allocated proportionally by trade value.
 *
 * All arithmetic uses decimal.js to preserve precision.
 */

import Decimal from 'decimal.js';
import type {
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
} from '../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TradeChargeAllocation {
  trade_no: string;
  order_no: string;
  security_description: string;
  buy_sell: 'B' | 'S';
  quantity: string;
  gross_rate: string;
  /** |qty * gross_rate| — absolute trade value used for weighting */
  trade_value: string;
  /** trade_value / sum(trade_values) */
  allocation_weight: string;
  /** brokerage_per_unit * quantity (NOT proportional) */
  brokerage: string;
  stt: string;
  exchange_charges: string;
  clearing_charges: string;
  cgst: string;
  sgst: string;
  igst: string;
  sebi_fees: string;
  stamp_duty: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a numeric string that may be empty, comma-formatted, or prefixed with ₹. */
function dec(raw: string | undefined | null): Decimal {
  if (!raw || raw.trim() === '') return new Decimal(0);
  return new Decimal(raw.replace(/[₹,\s]/g, ''));
}

/**
 * Proportionally split `aggregate` across `weights`.  The last entry absorbs
 * any rounding remainder so the sum exactly equals the aggregate.
 */
function proportionalSplit(aggregate: Decimal, weights: Decimal[]): Decimal[] {
  const totalWeight = weights.reduce((s, w) => s.add(w), new Decimal(0));

  if (totalWeight.isZero() || aggregate.isZero()) {
    return weights.map(() => new Decimal(0));
  }

  const allocated: Decimal[] = [];
  let running = new Decimal(0);

  for (let i = 0; i < weights.length; i++) {
    if (i === weights.length - 1) {
      // Last trade absorbs remainder
      allocated.push(aggregate.sub(running));
    } else {
      const share = aggregate.mul(weights[i]).div(totalWeight).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      allocated.push(share);
      running = running.add(share);
    }
  }

  return allocated;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Given a set of trades and the aggregate charges for a single contract-note
 * date, compute per-trade charge breakdowns.
 *
 * - Brokerage: brokerage_per_unit * quantity (per-trade, not proportional).
 * - All other charges: proportional by |qty * gross_rate|.
 */
export function allocateCharges(
  trades: ZerodhaContractNoteTradeRow[],
  charges: ZerodhaContractNoteCharges,
): TradeChargeAllocation[] {
  if (trades.length === 0) return [];

  // 1. Compute trade values and weights
  const tradeValues = trades.map((t) => dec(t.quantity).mul(dec(t.gross_rate)).abs());
  const totalValue = tradeValues.reduce((s, v) => s.add(v), new Decimal(0));
  const weights = totalValue.isZero()
    ? tradeValues.map(() => new Decimal(0))
    : tradeValues.map((v) => v.div(totalValue));

  // 2. Split each proportional charge type
  const sttSplits = proportionalSplit(dec(charges.stt), tradeValues);
  const exchangeSplits = proportionalSplit(dec(charges.exchange_charges), tradeValues);
  const clearingSplits = proportionalSplit(dec(charges.clearing_charges), tradeValues);
  const cgstSplits = proportionalSplit(dec(charges.cgst), tradeValues);
  const sgstSplits = proportionalSplit(dec(charges.sgst), tradeValues);
  const igstSplits = proportionalSplit(dec(charges.igst), tradeValues);
  const sebiSplits = proportionalSplit(dec(charges.sebi_fees), tradeValues);
  // Stamp duty is levied on buy-side turnover per Indian law. In practice
  // the vast majority of contract notes with stamp duty have a buy side, so
  // we allocate proportionally against buy-side trade values. When a CN
  // reports stamp duty but has no buy side (rare: reversal-only CN, broker
  // batching quirk), we fall back to an all-trades proportional split so
  // the charge still posts and the pipeline stays unblocked. User can
  // reclassify in Tally if needed.
  const buySideTradeValues = trades.map((trade, index) =>
    trade.buy_sell === 'B' ? tradeValues[index] : new Decimal(0),
  );
  const stampAggregate = dec(charges.stamp_duty);
  const hasBuySideTurnover = buySideTradeValues.some((value) => value.gt(0));
  const stampAllocationBasis = hasBuySideTurnover ? buySideTradeValues : tradeValues;
  const stampSplits = proportionalSplit(stampAggregate, stampAllocationBasis);

  // Brokerage: prefer per-unit rates from the trade rows (XLSX contract notes carry
  // these). When all per-unit rates are zero but the aggregate brokerage is non-zero
  // (XML contract notes only have aggregate totals), fall back to proportional split
  // by trade value so the charge is still distributed correctly.
  const perUnitBrokerages = trades.map((t) =>
    dec(t.brokerage_per_unit).mul(dec(t.quantity)).abs(),
  );
  const totalPerUnit = perUnitBrokerages.reduce((s, b) => s.add(b), new Decimal(0));
  const brokerageSplits = !totalPerUnit.isZero()
    ? perUnitBrokerages
    : proportionalSplit(dec(charges.brokerage), tradeValues);

  // 3. Build allocations
  return trades.map((trade, i) => {
    const brokerage = brokerageSplits[i].toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      trade_no: trade.trade_no,
      order_no: trade.order_no,
      security_description: trade.security_description,
      buy_sell: trade.buy_sell,
      quantity: trade.quantity,
      gross_rate: trade.gross_rate,
      trade_value: tradeValues[i].toFixed(2),
      allocation_weight: weights[i].toFixed(6),
      brokerage: brokerage.toFixed(2),
      stt: sttSplits[i].toFixed(2),
      exchange_charges: exchangeSplits[i].toFixed(2),
      clearing_charges: clearingSplits[i].toFixed(2),
      cgst: cgstSplits[i].toFixed(2),
      sgst: sgstSplits[i].toFixed(2),
      igst: igstSplits[i].toFixed(2),
      sebi_fees: sebiSplits[i].toFixed(2),
      stamp_duty: stampSplits[i].toFixed(2),
    };
  });
}
