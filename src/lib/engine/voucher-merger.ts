/**
 * voucher-merger.ts
 * Post-processing step that consolidates PURCHASE vouchers for partial fills.
 *
 * Zerodha often splits a single buy order into multiple trades when it is filled
 * in parts at the same price (e.g. 100 shares split into 33 + 33 + 34). These
 * appear as separate PURCHASE vouchers in the Tally import, cluttering the
 * ledger. This module merges vouchers that share the same date, stock ledger,
 * and rate into a single voucher entry.
 *
 * SELL vouchers are intentionally left unchanged — sell trades have a different
 * cost-lot matching story and the user has indicated they should stay separate.
 */

import Decimal from 'decimal.js';
import { VoucherType, VoucherStatus } from '@/lib/types/vouchers';
import type { VoucherLine } from '@/lib/types/vouchers';
import type { BuiltVoucherDraft } from '@/lib/engine/voucher-builder';

export type PurchaseMergeMode = 'same_rate' | 'daily_summary';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge PURCHASE vouchers that represent partial fills of the same buy order.
 *
 * Two PURCHASE vouchers are eligible for merging when they share:
 *   - `voucher_date`
 *   - stock DR ledger name (identifies the security)
 *   - per-unit `rate` on the stock DR line
 *
 * The "stock DR line" is the line where `dr_cr === 'DR'` and `quantity !== null`
 * (the investment/stock-in-trade ledger line). All other lines (broker CR,
 * charge DRs) are merged by ledger name + direction, summing amounts.
 *
 * SELL, JOURNAL, RECEIPT, PAYMENT, and CONTRA vouchers pass through unchanged.
 */
export function mergeSameRatePurchaseVouchers(
  vouchers: BuiltVoucherDraft[],
): BuiltVoucherDraft[] {
  const purchases: BuiltVoucherDraft[] = [];
  const others: BuiltVoucherDraft[] = [];

  for (const v of vouchers) {
    // Merge both PURCHASE (trader mode) and JOURNAL buy (investor mode) vouchers
    if (v.voucher_type === VoucherType.PURCHASE ||
        (v.voucher_type === VoucherType.JOURNAL && v.narrative?.startsWith('Purchase of'))) {
      purchases.push(v);
    } else {
      others.push(v);
    }
  }

  // Group purchases by merge key: date | stock-DR-ledger-name | rate
  const groups = new Map<string, BuiltVoucherDraft[]>();
  const ungrouped: BuiltVoucherDraft[] = [];

  for (const v of purchases) {
    const stockDrLine = v.lines.find((l) => l.dr_cr === 'DR' && l.quantity !== null);
    if (!stockDrLine) {
      // No stock DR line — cannot determine a merge key; keep as-is.
      ungrouped.push(v);
      continue;
    }
    const key = `${v.voucher_date}|${stockDrLine.ledger_name}|${stockDrLine.rate ?? '0'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  const mergedPurchases: BuiltVoucherDraft[] = [...ungrouped];

  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedPurchases.push(group[0]);
      continue;
    }

    mergedPurchases.push(mergeGroup(group));
  }

  // Preserve chronological ordering across all voucher types
  return [...mergedPurchases, ...others].sort((a, b) =>
    a.voucher_date.localeCompare(b.voucher_date),
  );
}

export function mergeDailySummaryPurchaseVouchers(
  vouchers: BuiltVoucherDraft[],
): BuiltVoucherDraft[] {
  const purchases: BuiltVoucherDraft[] = [];
  const others: BuiltVoucherDraft[] = [];

  for (const v of vouchers) {
    // Merge both PURCHASE (trader mode) and JOURNAL buy (investor mode) vouchers
    if (v.voucher_type === VoucherType.PURCHASE ||
        (v.voucher_type === VoucherType.JOURNAL && v.narrative?.startsWith('Purchase of'))) {
      purchases.push(v);
    } else {
      others.push(v);
    }
  }

  const groups = new Map<string, BuiltVoucherDraft[]>();
  const ungrouped: BuiltVoucherDraft[] = [];

  for (const v of purchases) {
    const stockDrLine = v.lines.find((l) => l.dr_cr === 'DR' && l.quantity !== null);
    if (!stockDrLine) {
      ungrouped.push(v);
      continue;
    }

    const key = `${v.voucher_date}|${stockDrLine.ledger_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  const mergedPurchases: BuiltVoucherDraft[] = [...ungrouped];

  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedPurchases.push(group[0]);
      continue;
    }

    mergedPurchases.push(mergeGroup(group, 'daily_summary'));
  }

  return [...mergedPurchases, ...others].sort((a, b) =>
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

  return mergeSameRatePurchaseVouchers(vouchers);
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
  mode: PurchaseMergeMode = 'same_rate',
): BuiltVoucherDraft {
  const base = group[0];

  // Accumulate lines: key = "ledger_name|dr_cr"
  // For the stock DR line, also accumulate quantity.
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
    const isStockLine = line.dr_cr === 'DR' && line.quantity !== null;
    const nextRate =
      isStockLine && totalQty !== null && !totalQty.isZero()
        ? totalAmount.div(totalQty).toFixed(2)
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

  // Build a descriptive narrative from the stock DR line of the base voucher
  const stockDrLine = mergedLines.find((l) => l.dr_cr === 'DR' && l.quantity !== null);
  const narrative =
    stockDrLine && stockDrLine.quantity !== null && stockDrLine.rate !== null
      ? `Purchase of ${stockDrLine.ledger_name} @ ${stockDrLine.rate} × ${stockDrLine.quantity} units (${group.length} ${mode === 'daily_summary' ? 'trades' : 'fills'})`
      : base.narrative;

  return {
    ...base,
    total_debit: totalDebit,
    total_credit: totalCredit,
    draft_status: VoucherStatus.DRAFT,
    narrative,
    // Preserve the base external reference so merged vouchers keep the contract note number
    external_reference: base.external_reference,
    source_event_ids: group.flatMap((v) => v.source_event_ids),
    lines: mergedLines,
  };
}
