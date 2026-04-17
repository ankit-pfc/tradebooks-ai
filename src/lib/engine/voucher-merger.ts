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

  // Preserve chronological ordering across all voucher types.
  // Pre-merge source vouchers share identical dates so this sort is stable
  // regardless of whether a group was collapsed or not.
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

  const sourceNarratives = group
    .map((v) => v.narrative)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);
  const narrative = buildMergedTradeNarrative(
    mergedLines,
    side,
    group.length,
    mode,
    sourceNarratives,
  );

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
 * Build a narrative for a merged trade voucher.
 *
 * The investor-mode buy voucher capitalizes brokerage/exchange/SEBI/stamp/GST
 * into the asset line, so the merged lines alone cannot tell us what each
 * charge was worth. But every source voucher's narrative DOES carry the
 * per-fill breakdown that buildTradeNarrative emits, e.g.:
 *
 *   "Purchase of RELIANCE @ 2500 × 10 units |
 *    brokerage 20.00, GST 3.60, stamp 0.40, exch 0.10 |
 *    STT 2.50 (non-deductible)"
 *
 * We sum every recognised charge label across the group's source narratives
 * and produce:
 *
 *   "Purchase of RELIANCE @ 2502.04 × 20 units |
 *    brokerage 40.00, GST 7.20, stamp 0.80, exch 0.20 |
 *    STT 5.00 (non-deductible) [merged 2 fills]"
 *
 * The FY21-22 reviewer explicitly asked for this: "the narration for merged
 * is not mentioning charges total as in other transaction, while it's adding
 * up the charges. So need to charges total details in narration."
 *
 * Falls back to the previous lines-only behaviour when source narratives are
 * missing or unparseable (e.g. intraday consolidated vouchers with their own
 * narration format).
 */
function buildMergedTradeNarrative(
  lines: VoucherLine[],
  side: TradeSide,
  mergedCount: number,
  mode: PurchaseMergeMode,
  sourceNarratives: readonly string[] = [],
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

  // Aggregate charges across source narratives.
  //   capitalizable: {label → Decimal} preserving first-seen label order.
  //   sttTotal: Decimal | null
  const capitalizable = new Map<string, Decimal>();
  let sttTotal: Decimal | null = null;
  for (const narrative of sourceNarratives) {
    const parsed = parseTradeNarrativeCharges(narrative);
    if (!parsed) continue;
    for (const { label, amount } of parsed.capitalizable) {
      const existing = capitalizable.get(label) ?? new Decimal(0);
      capitalizable.set(label, existing.add(amount));
    }
    if (parsed.stt) {
      sttTotal = (sttTotal ?? new Decimal(0)).add(parsed.stt);
    }
  }

  // STT fallback: when narrative parsing yielded nothing (e.g. old intraday
  // narrations), look at the STT voucher line directly.
  if (sttTotal === null) {
    const sttLine = lines.find(
      (l) => l.dr_cr === 'DR' && /securities transaction tax|^stt\b/i.test(l.ledger_name),
    );
    if (sttLine) {
      const amount = new Decimal(sttLine.amount);
      if (!amount.isZero()) {
        sttTotal = amount;
      }
    }
  }

  const parts = [`${sideLabel} ${symbol} @ ${stockLine.rate} × ${stockLine.quantity} units`];
  if (capitalizable.size > 0) {
    const chargeParts: string[] = [];
    for (const [label, amount] of capitalizable) {
      if (amount.isZero()) continue;
      chargeParts.push(`${label} ${amount.toFixed(2)}`);
    }
    if (chargeParts.length > 0) {
      parts.push(chargeParts.join(', '));
    }
  }
  if (sttTotal !== null && !sttTotal.isZero()) {
    parts.push(`STT ${sttTotal.toFixed(2)} (non-deductible)`);
  }
  const fillsLabel = mode === 'daily_summary' ? 'trades' : 'fills';
  parts.push(`[merged ${mergedCount} ${fillsLabel}]`);
  return parts.join(' | ');
}

/**
 * Parse a per-fill trade narrative emitted by voucher-builder.buildTradeNarrative
 * into its charge components.
 *
 * Accepted input (pipe-separated segments):
 *   "Purchase of RELIANCE @ 2500 × 10 units"
 *   "Purchase of RELIANCE @ 2500 × 10 units | brokerage 20.00, GST 3.60"
 *   "Purchase of RELIANCE @ 2500 × 10 units | brokerage 20.00 | STT 2.50 (non-deductible)"
 *
 * Returns null for narratives that don't start with "Purchase of" / "Sale of"
 * (e.g. intraday consolidated vouchers) so callers can fall back cleanly.
 *
 * The STT segment is matched by the trailing "(non-deductible)" marker so
 * that any STT amount accidentally included in the capitalizable list is
 * not double-counted.
 */
function parseTradeNarrativeCharges(narrative: string): {
  capitalizable: Array<{ label: string; amount: Decimal }>;
  stt: Decimal | null;
} | null {
  if (!/^(Purchase|Sale) of\b/.test(narrative)) return null;
  const segments = narrative.split('|').map((s) => s.trim());
  if (segments.length === 0) return null;

  const capitalizable: Array<{ label: string; amount: Decimal }> = [];
  let stt: Decimal | null = null;

  // Skip the prefix segment ("Purchase of RELIANCE @ 2500 × 10 units").
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue;

    // STT segment: "STT 2.50 (non-deductible)" — capture the number.
    const sttMatch = segment.match(/^STT\s+([-+]?\d+(?:\.\d+)?)\s*\(non-deductible\)/i);
    if (sttMatch) {
      stt = (stt ?? new Decimal(0)).add(new Decimal(sttMatch[1]));
      continue;
    }

    // Skip noise segments (e.g. merged-fills marker, review hints).
    if (/^\[/.test(segment) || /^\(/.test(segment)) continue;

    // Capitalizable charges: "brokerage 20.00, GST 3.60, stamp 0.40, exch 0.10"
    // Split on commas and match each "label amount" pair.
    const items = segment.split(',').map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      const m = item.match(/^([A-Za-z][A-Za-z\s]*?)\s+([-+]?\d+(?:\.\d+)?)$/);
      if (!m) continue;
      const label = m[1].trim();
      const amount = new Decimal(m[2]);
      capitalizable.push({ label, amount });
    }
  }

  return { capitalizable, stt };
}
