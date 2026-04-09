/**
 * voucher-merger.ts
 * Post-processing step that consolidates trade vouchers for partial fills.
 *
 * Zerodha often splits a single order into multiple trades when it is filled
 * in parts at the same price (e.g. 100 shares at 2500 executed as 33 + 33 + 34
 * line items on the contract note). These appear as separate vouchers in the
 * Tally import, cluttering the ledger. This module merges vouchers that share
 * the same (date, scrip, rate, side) into a single voucher entry.
 *
 * Both BUY and SELL sides are merged. `side` is part of the merge key so a
 * same-date same-rate buy and sell never collapse into one voucher — the two
 * are distinct events for cost-basis tracking even if the rate happens to
 * match.
 */

import Decimal from 'decimal.js';
import { VoucherType, VoucherStatus } from '@/lib/types/vouchers';
import type { VoucherLine } from '@/lib/types/vouchers';
import type { BuiltVoucherDraft } from '@/lib/engine/voucher-builder';

export type PurchaseMergeMode = 'same_rate' | 'daily_summary';

type TradeSide = 'buy' | 'sell';

// ---------------------------------------------------------------------------
// Trade-side detection
// ---------------------------------------------------------------------------

/**
 * Determine whether a voucher represents a buy trade, a sell trade, or is a
 * non-trade voucher (receipt, payment, contra, etc.) that must pass through
 * the merger unchanged.
 *
 * Detection logic:
 *   - VoucherType.PURCHASE  → buy  (trader mode)
 *   - VoucherType.SALES     → sell (trader mode)
 *   - VoucherType.JOURNAL   → check narrative: "Purchase of …" → buy,
 *                             "Sale of …" → sell, anything else → null
 *
 * Keeping this logic in one place means the grouping and line-inspection
 * passes below can share the same side classifier.
 */
function detectTradeSide(v: BuiltVoucherDraft): TradeSide | null {
  if (v.voucher_type === VoucherType.PURCHASE) return 'buy';
  if (v.voucher_type === VoucherType.SALES) return 'sell';
  if (v.voucher_type === VoucherType.JOURNAL) {
    const narrative = v.narrative ?? '';
    if (narrative.startsWith('Purchase of')) return 'buy';
    if (narrative.startsWith('Sale of')) return 'sell';
  }
  return null;
}

/**
 * Return the stock ledger line (the line carrying quantity + rate for the
 * traded security), regardless of which side of the voucher it sits on.
 *
 * Investor/trader BUY vouchers carry the stock line on DR (the asset being
 * acquired). Investor/trader SELL vouchers carry it on CR (the asset being
 * cleared from the books at cost basis). Knowing the side ahead of time is
 * what lets us support both registers in one merger.
 */
function findStockLine(
  v: BuiltVoucherDraft,
  side: TradeSide,
): VoucherLine | undefined {
  const expectedDrCr: 'DR' | 'CR' = side === 'buy' ? 'DR' : 'CR';
  return v.lines.find((l) => l.dr_cr === expectedDrCr && l.quantity !== null);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge trade vouchers that represent partial fills of the same order.
 *
 * Two vouchers are eligible for merging when they share:
 *   - `voucher_date`
 *   - stock ledger name (identifies the security)
 *   - per-unit `rate` on the stock line
 *   - trade side (BUY or SELL)
 *
 * All same-ledger-name + same-dr/cr-direction lines are summed across the
 * group; for the stock line, quantities are summed and the effective rate is
 * recomputed as amount/qty to absorb any rounding drift.
 *
 * RECEIPT, PAYMENT, and CONTRA vouchers pass through unchanged.
 */
export function mergeSameRateTradeVouchers(
  vouchers: BuiltVoucherDraft[],
): BuiltVoucherDraft[] {
  const trades: Array<{ voucher: BuiltVoucherDraft; side: TradeSide }> = [];
  const others: BuiltVoucherDraft[] = [];

  for (const v of vouchers) {
    const side = detectTradeSide(v);
    if (side !== null) {
      trades.push({ voucher: v, side });
    } else {
      others.push(v);
    }
  }

  // Group trades by merge key: date | stock-ledger-name | rate | side.
  // Including `side` prevents a same-date same-rate buy+sell from collapsing
  // into one voucher — those are distinct events for cost-basis tracking.
  const groups = new Map<string, Array<{ voucher: BuiltVoucherDraft; side: TradeSide }>>();
  const ungrouped: BuiltVoucherDraft[] = [];

  for (const entry of trades) {
    const stockLine = findStockLine(entry.voucher, entry.side);
    if (!stockLine) {
      // No stock line (shouldn't happen for real trades, but guard anyway)
      ungrouped.push(entry.voucher);
      continue;
    }
    const key = `${entry.voucher.voucher_date}|${stockLine.ledger_name}|${stockLine.rate ?? '0'}|${entry.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const mergedTrades: BuiltVoucherDraft[] = [...ungrouped];

  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedTrades.push(group[0].voucher);
      continue;
    }

    mergedTrades.push(mergeGroup(group.map((e) => e.voucher), group[0].side));
  }

  // Preserve chronological ordering across all voucher types
  return [...mergedTrades, ...others].sort((a, b) =>
    a.voucher_date.localeCompare(b.voucher_date),
  );
}

/** Backward-compat alias — older call sites may still import the old name. */
export const mergeSameRatePurchaseVouchers = mergeSameRateTradeVouchers;

export function mergeDailySummaryPurchaseVouchers(
  vouchers: BuiltVoucherDraft[],
): BuiltVoucherDraft[] {
  const trades: Array<{ voucher: BuiltVoucherDraft; side: TradeSide }> = [];
  const others: BuiltVoucherDraft[] = [];

  for (const v of vouchers) {
    const side = detectTradeSide(v);
    if (side !== null) {
      trades.push({ voucher: v, side });
    } else {
      others.push(v);
    }
  }

  const groups = new Map<string, Array<{ voucher: BuiltVoucherDraft; side: TradeSide }>>();
  const ungrouped: BuiltVoucherDraft[] = [];

  for (const entry of trades) {
    const stockLine = findStockLine(entry.voucher, entry.side);
    if (!stockLine) {
      ungrouped.push(entry.voucher);
      continue;
    }

    // Daily-summary mode ignores rate but still keys on side so buys and
    // sells don't get merged into a single weighted-average voucher.
    const key = `${entry.voucher.voucher_date}|${stockLine.ledger_name}|${entry.side}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const mergedTrades: BuiltVoucherDraft[] = [...ungrouped];

  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedTrades.push(group[0].voucher);
      continue;
    }

    mergedTrades.push(
      mergeGroup(group.map((e) => e.voucher), group[0].side, 'daily_summary'),
    );
  }

  return [...mergedTrades, ...others].sort((a, b) =>
    a.voucher_date.localeCompare(b.voucher_date),
  );
}

export function mergePurchaseVouchers(
  vouchers: BuiltVoucherDraft[],
  mode: PurchaseMergeMode = 'same_rate',
): BuiltVoucherDraft[] {
  if (mode === 'daily_summary') {
    return mergeDailySummaryPurchaseVouchers(vouchers);
  }

  return mergeSameRateTradeVouchers(vouchers);
}

/**
 * Append numeric suffixes to vouchers whose `external_reference` (= Tally
 * VOUCHERNUMBER) collides with another voucher in the list. Required because
 * a single contract note may legitimately produce multiple vouchers (multi-
 * security CN, or same-security multi-rate fills that don't merge), and Tally
 * rejects duplicate voucher numbers within a voucher type.
 *
 * Strategy: voucher numbers are grouped by (voucher_type, external_reference).
 * The first voucher in each group keeps the original number; subsequent ones
 * get "-2", "-3", … suffixes preserving deterministic order (input order is
 * stable, so re-imports of the same data produce the same suffix assignments
 * and Tally raises duplicate-voucher-number errors as intended).
 *
 * Vouchers without an external_reference are passed through unchanged.
 */
export function disambiguateVoucherNumbers(
  vouchers: BuiltVoucherDraft[],
): BuiltVoucherDraft[] {
  // Map<"voucherType|externalRef", count-so-far>
  const seen = new Map<string, number>();
  return vouchers.map((v) => {
    if (!v.external_reference) return v;
    const key = `${v.voucher_type}|${v.external_reference}`;
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    if (count === 1) return v;
    return { ...v, external_reference: `${v.external_reference}-${count}` };
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mergeGroup(
  group: BuiltVoucherDraft[],
  side: TradeSide,
  mode: PurchaseMergeMode = 'same_rate',
): BuiltVoucherDraft {
  const base = group[0];

  // Accumulate lines: key = "ledger_name|dr_cr"
  // For stock lines (buy: DR with qty, sell: CR with qty), also accumulate
  // quantity so the merged voucher reflects total fills.
  const lineMap = new Map<
    string,
    { line: VoucherLine; totalAmount: Decimal; totalQty: Decimal | null }
  >();

  for (const v of group) {
    for (const line of v.lines) {
      const key = `${line.ledger_name}|${line.dr_cr}`;
      if (!lineMap.has(key)) {
        lineMap.set(key, {
          line: { ...line },
          totalAmount: new Decimal(line.amount),
          totalQty: line.quantity !== null ? new Decimal(line.quantity) : null,
        });
      } else {
        const acc = lineMap.get(key)!;
        acc.totalAmount = acc.totalAmount.add(new Decimal(line.amount));
        if (acc.totalQty !== null && line.quantity !== null) {
          acc.totalQty = acc.totalQty.add(new Decimal(line.quantity));
        }
      }
    }
  }

  // Rebuild lines with merged amounts, reassigning line_no sequentially
  const mergedLines: VoucherLine[] = [];
  let lineNo = 1;
  for (const { line, totalAmount, totalQty } of lineMap.values()) {
    const isStockLine = line.quantity !== null;
    // Rate is unsigned (it represents price per unit). Use absolute values
    // so a sell stock line with negative canonical quantity produces a
    // positive merged rate rather than flipping sign.
    const nextRate =
      isStockLine && totalQty !== null && !totalQty.isZero()
        ? totalAmount.abs().div(totalQty.abs()).toFixed(2)
        : line.rate;

    mergedLines.push({
      ...line,
      voucher_draft_id: base.voucher_draft_id,
      line_no: lineNo++,
      amount: totalAmount.toFixed(2),
      quantity: totalQty !== null ? totalQty.toFixed() : null,
      rate: nextRate,
    });
  }

  // Recompute totals from merged lines
  const totalDebit = mergedLines
    .filter((l) => l.dr_cr === 'DR')
    .reduce((sum, l) => sum.add(new Decimal(l.amount)), new Decimal(0))
    .toFixed(2);
  const totalCredit = mergedLines
    .filter((l) => l.dr_cr === 'CR')
    .reduce((sum, l) => sum.add(new Decimal(l.amount)), new Decimal(0))
    .toFixed(2);

  const narrative = buildMergedTradeNarrative(mergedLines, side, group.length, mode);

  return {
    ...base,
    total_debit: totalDebit,
    total_credit: totalCredit,
    draft_status: VoucherStatus.DRAFT,
    narrative: narrative ?? base.narrative,
    // Preserve the base external reference so merged vouchers keep the contract note number
    external_reference: base.external_reference,
    source_event_ids: group.flatMap((v) => v.source_event_ids),
    lines: mergedLines,
  };
}

/**
 * Build a narrative for a merged trade voucher from the merged lines.
 *
 * Investor-mode trade vouchers (after voucher-builder Fix 1+2) no longer
 * carry individual brokerage / GST / stamp DR lines — those amounts are
 * absorbed into the asset line on a buy and into the net broker line on a
 * sell. So we cannot reconstruct the per-charge breakdown from the merged
 * lines. What we CAN reconstruct:
 *
 *   - total quantity and effective rate on the stock line
 *   - STT total (always posted as its own DR line when non-zero)
 *
 * That's enough for an auditable one-liner:
 *   "Purchase of RELIANCE @ 2502.04 × 20 units | STT 5.00 (non-deductible) [merged 2 fills]"
 *   "Sale of RELIANCE @ 2600.00 × 20 units | STT 5.20 (non-deductible) [merged 2 fills]"
 *
 * The user can drill into the voucher lines for the exact split.
 */
function buildMergedTradeNarrative(
  lines: VoucherLine[],
  side: TradeSide,
  mergedCount: number,
  mode: PurchaseMergeMode,
): string | null {
  const sideLabel = side === 'buy' ? 'Purchase of' : 'Sale of';
  const stockDrCr: 'DR' | 'CR' = side === 'buy' ? 'DR' : 'CR';
  const stockLine = lines.find((l) => l.dr_cr === stockDrCr && l.quantity !== null);
  if (!stockLine || stockLine.rate === null || stockLine.quantity === null) {
    return null;
  }

  // Extract the scrip symbol from the stock ledger name. Ledger names follow
  // the pattern "<prefix> - SYMBOL" (e.g. "Investment in Equity Shares - RELIANCE",
  // "Shares-in-Trade - TCS"). Fall back to the whole name if the split fails.
  const ledgerParts = stockLine.ledger_name.split(' - ');
  const symbol = ledgerParts.length > 1 ? ledgerParts[ledgerParts.length - 1] : stockLine.ledger_name;

  // STT is posted as its own DR line on both buy and sell vouchers in
  // investor mode. Detect it by ledger-name match so overridden Tally-profile
  // STT ledger names still resolve correctly.
  const sttLine = lines.find(
    (l) => l.dr_cr === 'DR' && /securities transaction tax|^stt\b/i.test(l.ledger_name),
  );

  const parts = [`${sideLabel} ${symbol} @ ${stockLine.rate} × ${stockLine.quantity} units`];
  if (sttLine) {
    const sttAmount = new Decimal(sttLine.amount);
    if (!sttAmount.isZero()) {
      parts.push(`STT ${sttAmount.toFixed(2)} (non-deductible)`);
    }
  }
  const fillsLabel = mode === 'daily_summary' ? 'trades' : 'fills';
  parts.push(`[merged ${mergedCount} ${fillsLabel}]`);
  return parts.join(' | ');
}
