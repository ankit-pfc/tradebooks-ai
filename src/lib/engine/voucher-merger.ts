/**
 * voucher-merger.ts
 * Post-processing step that consolidates buy vouchers for partial fills.
 *
 * Zerodha often splits a single buy order into multiple trades when it is filled
 * in parts at the same price (e.g. 100 shares split into 33 + 33 + 34). These
 * appear as separate buy vouchers in the Tally import, cluttering the ledger.
 * This module merges vouchers that share the same date, stock ledger, and rate
 * into a single voucher entry.
 *
 * Buy vouchers can be either PURCHASE (trader mode) or JOURNAL (investor mode).
 * A JOURNAL voucher is identified as a buy when it has a stock DR line with
 * non-null quantity.
 *
 * SELL/SALES vouchers and non-buy JOURNAL vouchers pass through unchanged.
 */

import Decimal from 'decimal.js';
import { VoucherType, VoucherStatus } from '@/lib/types/vouchers';
import type { VoucherLine } from '@/lib/types/vouchers';
import type { BuiltVoucherDraft } from '@/lib/engine/voucher-builder';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge buy vouchers that represent partial fills of the same buy order.
 *
 * Two buy vouchers are eligible for merging when they share:
 *   - `voucher_date`
 *   - stock DR ledger name (identifies the security)
 *   - per-unit `rate` on the stock DR line
 *
 * Buy vouchers are identified as:
 *   - PURCHASE type (trader mode), OR
 *   - JOURNAL type with a stock DR line (investor mode buy trades)
 *
 * The "stock DR line" is the line where `dr_cr === 'DR'` and `quantity !== null`
 * (the investment/stock-in-trade ledger line). All other lines (broker CR,
 * charge DRs) are merged by ledger name + direction, summing amounts.
 *
 * SELL/SALES vouchers, non-buy JOURNALs, RECEIPT, PAYMENT, and CONTRA pass
 * through unchanged.
 */
export function mergeSameRatePurchaseVouchers(
  vouchers: BuiltVoucherDraft[],
): BuiltVoucherDraft[] {
  const buyVouchers: BuiltVoucherDraft[] = [];
  const others: BuiltVoucherDraft[] = [];

  for (const v of vouchers) {
    if (v.voucher_type === VoucherType.PURCHASE) {
      buyVouchers.push(v);
    } else if (v.voucher_type === VoucherType.JOURNAL && isBuyJournal(v)) {
      buyVouchers.push(v);
    } else {
      others.push(v);
    }
  }

  // Group buy vouchers by merge key: date | stock-DR-ledger-name | rate
  const groups = new Map<string, BuiltVoucherDraft[]>();
  const ungrouped: BuiltVoucherDraft[] = [];

  for (const v of buyVouchers) {
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

  const mergedBuys: BuiltVoucherDraft[] = [...ungrouped];

  for (const group of groups.values()) {
    if (group.length === 1) {
      mergedBuys.push(group[0]);
      continue;
    }

    mergedBuys.push(mergeGroup(group));
  }

  // Preserve chronological ordering across all voucher types
  return [...mergedBuys, ...others].sort((a, b) =>
    a.voucher_date.localeCompare(b.voucher_date),
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * A JOURNAL voucher is a "buy journal" (investor-mode purchase) when it has a
 * stock DR line — a DR line with non-null quantity. Non-buy journals (corporate
 * actions, off-market transfers, sell journals) either lack a stock DR line or
 * have the stock line on the CR side.
 */
function isBuyJournal(v: BuiltVoucherDraft): boolean {
  return v.lines.some((l) => l.dr_cr === 'DR' && l.quantity !== null);
}

function mergeGroup(group: BuiltVoucherDraft[]): BuiltVoucherDraft {
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
    mergedLines.push({
      ...line,
      voucher_draft_id: base.voucher_draft_id,
      line_no: lineNo++,
      amount: totalAmount.toFixed(2),
      quantity: totalQty !== null ? totalQty.toFixed() : null,
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
      ? `Purchase of ${stockDrLine.ledger_name} @ ${stockDrLine.rate} × ${stockDrLine.quantity} units (${group.length} fills)`
      : base.narrative;

  return {
    ...base,
    total_debit: totalDebit,
    total_credit: totalCredit,
    draft_status: VoucherStatus.DRAFT,
    narrative,
    // Null out the single-trade external reference — the merged voucher spans multiple trades
    external_reference: null,
    source_event_ids: group.flatMap((v) => v.source_event_ids),
    lines: mergedLines,
  };
}
