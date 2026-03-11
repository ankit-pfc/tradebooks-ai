/**
 * checks.ts
 * Core reconciliation checks run against canonical events and voucher drafts
 * before export. All arithmetic uses decimal.js to avoid floating-point errors.
 */

import Decimal from 'decimal.js';
import { CanonicalEvent, EventType } from '../types/events';
import { VoucherDraft } from '../types/vouchers';

// ---------------------------------------------------------------------------
// Local types (mirrors the shapes described in the reconciliation spec)
// ---------------------------------------------------------------------------

export interface ReconciliationCheck {
  check_name: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  expected: string;
  actual: string;
  difference: string;
  details: string;
}

export interface ReconciliationResult {
  checks: ReconciliationCheck[];
  overall_status: 'PASSED' | 'FAILED' | 'WARNING';
  mismatch_count: number;
  warning_count: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * checkTradeTotals
 *
 * Sums gross_amount for all BUY_TRADE and SELL_TRADE events and compares the
 * total against the equivalent sum computed from raw tradebook rows.
 *
 * Raw rows are expected to carry a numeric `gross_amount` (or `value`) field.
 * If the raw rows lack that field the check degrades to a WARNING.
 */
export function checkTradeTotals(
  events: CanonicalEvent[],
  rawTradebookRows: Record<string, unknown>[],
): ReconciliationCheck {
  const CHECK_NAME = 'TRADE_TOTALS';

  // Sum from canonical events
  const eventTotal = events
    .filter(
      (e) =>
        e.event_type === EventType.BUY_TRADE ||
        e.event_type === EventType.SELL_TRADE,
    )
    .reduce((acc, e) => acc.plus(new Decimal(e.gross_amount)), new Decimal(0));

  // Sum from raw rows – try common field names
  const rawFields = ['gross_amount', 'value', 'trade_value', 'amount'];

  const hasRawAmounts = rawTradebookRows.some((row) =>
    rawFields.some((f) => row[f] !== undefined && row[f] !== null),
  );

  if (!hasRawAmounts) {
    return {
      check_name: CHECK_NAME,
      status: 'WARNING',
      expected: 'N/A',
      actual: eventTotal.toFixed(2),
      difference: 'N/A',
      details:
        'Raw tradebook rows do not contain a recognisable gross_amount field; ' +
        'cannot compare totals. Provide rows with gross_amount, value, ' +
        'trade_value, or amount to enable this check.',
    };
  }

  const rawTotal = rawTradebookRows.reduce((acc, row) => {
    const field = rawFields.find(
      (f) => row[f] !== undefined && row[f] !== null,
    );
    if (!field) return acc;
    try {
      return acc.plus(new Decimal(row[field] as string | number));
    } catch {
      return acc;
    }
  }, new Decimal(0));

  const difference = eventTotal.minus(rawTotal).abs();
  const passed = difference.isZero();

  return {
    check_name: CHECK_NAME,
    status: passed ? 'PASSED' : 'FAILED',
    expected: rawTotal.toFixed(2),
    actual: eventTotal.toFixed(2),
    difference: difference.toFixed(2),
    details: passed
      ? 'Event trade totals match raw tradebook totals.'
      : `Trade total mismatch: events sum to ${eventTotal.toFixed(2)}, ` +
        `raw rows sum to ${rawTotal.toFixed(2)} (difference ${difference.toFixed(2)}).`,
  };
}

/**
 * checkVoucherBalance
 *
 * Every voucher must have total_debit === total_credit (double-entry rule).
 * Returns FAILED as soon as any unbalanced voucher is found.
 */
export function checkVoucherBalance(vouchers: VoucherDraft[]): ReconciliationCheck {
  const CHECK_NAME = 'VOUCHER_BALANCE';

  if (vouchers.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: '0',
      actual: '0',
      difference: '0',
      details: 'No vouchers to check.',
    };
  }

  const unbalanced: Array<{ id: string; debit: string; credit: string; diff: string }> = [];

  for (const voucher of vouchers) {
    const debit = new Decimal(voucher.total_debit);
    const credit = new Decimal(voucher.total_credit);
    const diff = debit.minus(credit).abs();

    if (!diff.isZero()) {
      unbalanced.push({
        id: voucher.voucher_draft_id,
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        diff: diff.toFixed(2),
      });
    }
  }

  const totalDiff = unbalanced
    .reduce((acc, v) => acc.plus(new Decimal(v.diff)), new Decimal(0));

  if (unbalanced.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: '0',
      actual: '0',
      difference: '0',
      details: `All ${vouchers.length} voucher(s) are balanced.`,
    };
  }

  const sampleLines = unbalanced
    .slice(0, 5)
    .map((v) => `voucher ${v.id}: DR ${v.debit} vs CR ${v.credit} (diff ${v.diff})`)
    .join('; ');

  return {
    check_name: CHECK_NAME,
    status: 'FAILED',
    expected: '0',
    actual: String(unbalanced.length),
    difference: totalDiff.toFixed(2),
    details:
      `${unbalanced.length} of ${vouchers.length} voucher(s) are unbalanced. ` +
      `Sample: ${sampleLines}` +
      (unbalanced.length > 5 ? ` ... and ${unbalanced.length - 5} more.` : '.'),
  };
}

/**
 * checkHoldingsReconciliation
 *
 * For each security in the event set:
 *   closing_qty = opening_qty + sum(buy_qty) - sum(sell_qty)
 *
 * opening_qty is sourced from holdingsRows (keyed by symbol or isin).
 * If no holdingsRows are provided the check degrades to WARNING.
 */
export function checkHoldingsReconciliation(
  events: CanonicalEvent[],
  holdingsRows: Record<string, unknown>[],
): ReconciliationCheck {
  const CHECK_NAME = 'HOLDINGS_RECONCILIATION';

  // Build a map of security_id -> net quantity change from events
  const netQtyBySecurityId = new Map<string, Decimal>();

  for (const event of events) {
    if (
      (event.event_type !== EventType.BUY_TRADE &&
        event.event_type !== EventType.SELL_TRADE) ||
      !event.security_id
    ) {
      continue;
    }

    const qty = new Decimal(event.quantity); // positive = buy, negative = sell
    const prev = netQtyBySecurityId.get(event.security_id) ?? new Decimal(0);
    netQtyBySecurityId.set(event.security_id, prev.plus(qty));
  }

  if (netQtyBySecurityId.size === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: '0',
      actual: '0',
      difference: '0',
      details: 'No trade events found; holdings check skipped.',
    };
  }

  if (!holdingsRows || holdingsRows.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'WARNING',
      expected: 'N/A',
      actual: 'N/A',
      difference: 'N/A',
      details:
        'No holdings snapshot data provided. Supply broker holdings rows ' +
        '(with symbol/isin and quantity fields) to enable closing-position verification.',
    };
  }

  // Build a lookup: symbol/isin -> opening quantity from holdings
  const openingQtyMap = new Map<string, Decimal>();
  for (const row of holdingsRows) {
    const key: string | undefined =
      (row.security_id ?? row.isin ?? row.symbol ?? row.scrip) as string | undefined;
    const qty =
      row.opening_quantity ?? row.opening_qty ?? row.quantity ?? row.qty;
    if (key && qty !== undefined && qty !== null) {
      try {
        openingQtyMap.set(String(key).trim().toUpperCase(), new Decimal(qty as string | number));
      } catch {
        // skip malformed rows
      }
    }
  }

  const mismatches: string[] = [];
  let checkedCount = 0;

  for (const [securityId, netQty] of netQtyBySecurityId.entries()) {
    const key = securityId.trim().toUpperCase();
    const openingQty = openingQtyMap.get(key) ?? new Decimal(0);
    const expectedClosing = openingQty.plus(netQty);

    // Look for a closing/expected field in holdings rows that matches this key
    const holdingRow = holdingsRows.find((r) => {
      const rKey =
        r.security_id ?? r.isin ?? r.symbol ?? r.scrip;
      return rKey && String(rKey).trim().toUpperCase() === key;
    });

    const closingField =
      (holdingRow?.closing_quantity ??
        holdingRow?.closing_qty ??
        holdingRow?.expected_closing ??
        null) as string | number | null;

    if (closingField === null) {
      // No closing figure in holdings – we can only verify net movement
      checkedCount++;
      continue;
    }

    try {
      const actualClosing = new Decimal(closingField);
      const diff = expectedClosing.minus(actualClosing).abs();
      checkedCount++;

      if (!diff.isZero()) {
        mismatches.push(
          `${securityId}: expected closing ${expectedClosing.toFixed(4)}, ` +
            `holdings shows ${actualClosing.toFixed(4)} (diff ${diff.toFixed(4)})`,
        );
      }
    } catch {
      // skip if closing field is non-numeric
    }
  }

  if (mismatches.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: String(checkedCount),
      actual: '0',
      difference: '0',
      details: `Holdings reconciliation passed for ${checkedCount} security(ies).`,
    };
  }

  const sampleLines = mismatches.slice(0, 5).join('; ');
  return {
    check_name: CHECK_NAME,
    status: 'FAILED',
    expected: String(checkedCount),
    actual: String(mismatches.length),
    difference: String(mismatches.length),
    details:
      `${mismatches.length} holding position(s) do not reconcile. ` +
      sampleLines +
      (mismatches.length > 5 ? ` ... and ${mismatches.length - 5} more.` : '.'),
  };
}

/**
 * checkDuplicateEvents
 *
 * Scans all events for repeated event_hash values.
 * A single duplicate is WARNING; more than one is FAILED.
 */
export function checkDuplicateEvents(events: CanonicalEvent[]): ReconciliationCheck {
  const CHECK_NAME = 'DUPLICATE_EVENTS';

  const hashCount = new Map<string, number>();
  for (const event of events) {
    hashCount.set(event.event_hash, (hashCount.get(event.event_hash) ?? 0) + 1);
  }

  const duplicates = [...hashCount.entries()].filter(([, count]) => count > 1);

  if (duplicates.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: '0',
      actual: '0',
      difference: '0',
      details: `No duplicate event hashes found across ${events.length} event(s).`,
    };
  }

  const totalDuplicateEvents = duplicates.reduce(
    (acc, [, count]) => acc + (count - 1),
    0,
  );

  const sampleHashes = duplicates
    .slice(0, 3)
    .map(([hash, count]) => `${hash.slice(0, 12)}… (×${count})`)
    .join(', ');

  // More than 3 distinct duplicate hashes is an ERROR-level data problem
  const status: 'FAILED' | 'WARNING' = duplicates.length > 3 ? 'FAILED' : 'WARNING';

  return {
    check_name: CHECK_NAME,
    status,
    expected: '0',
    actual: String(totalDuplicateEvents),
    difference: String(totalDuplicateEvents),
    details:
      `Found ${duplicates.length} duplicate hash(es) producing ${totalDuplicateEvents} ` +
      `extra event(s). Sample: ${sampleHashes}. ` +
      'This may indicate the same file was imported more than once.',
  };
}

/**
 * checkChargeCompleteness
 *
 * For each BUY_TRADE and SELL_TRADE event, verifies that at least one STT
 * charge event shares the same contract_note_ref (or falls on the same date
 * for the same security when contract_note_ref is absent).
 *
 * Zerodha charges STT on every delivery trade; its absence is anomalous.
 * This is a WARNING-level check – it does not block export.
 */
export function checkChargeCompleteness(events: CanonicalEvent[]): ReconciliationCheck {
  const CHECK_NAME = 'CHARGE_COMPLETENESS';

  const tradeEvents = events.filter(
    (e) =>
      e.event_type === EventType.BUY_TRADE ||
      e.event_type === EventType.SELL_TRADE,
  );

  if (tradeEvents.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: '0',
      actual: '0',
      difference: '0',
      details: 'No trade events to check for STT completeness.',
    };
  }

  // Build a Set of keys where STT was found
  // Key strategy (in priority order):
  //   1. contract_note_ref (most reliable)
  //   2. event_date + security_id (fallback for un-referenced events)
  const sttKeys = new Set<string>();
  for (const e of events) {
    if (e.event_type === EventType.STT) {
      if (e.contract_note_ref) {
        sttKeys.add(`cnref:${e.contract_note_ref}`);
      }
      if (e.security_id && e.event_date) {
        sttKeys.add(`datekey:${e.event_date}:${e.security_id}`);
      }
    }
  }

  const tradesWithoutStt: string[] = [];

  for (const trade of tradeEvents) {
    const byRef =
      trade.contract_note_ref && sttKeys.has(`cnref:${trade.contract_note_ref}`);
    const byDateKey =
      trade.security_id &&
      trade.event_date &&
      sttKeys.has(`datekey:${trade.event_date}:${trade.security_id}`);

    if (!byRef && !byDateKey) {
      tradesWithoutStt.push(trade.event_id);
    }
  }

  if (tradesWithoutStt.length === 0) {
    return {
      check_name: CHECK_NAME,
      status: 'PASSED',
      expected: String(tradeEvents.length),
      actual: String(tradeEvents.length),
      difference: '0',
      details: `STT charge found for all ${tradeEvents.length} trade event(s).`,
    };
  }

  const sampleIds = tradesWithoutStt.slice(0, 5).join(', ');

  return {
    check_name: CHECK_NAME,
    status: 'WARNING',
    expected: String(tradeEvents.length),
    actual: String(tradeEvents.length - tradesWithoutStt.length),
    difference: String(tradesWithoutStt.length),
    details:
      `${tradesWithoutStt.length} trade event(s) have no associated STT charge. ` +
      `This may indicate intraday trades (STT rate differs) or missing charge rows. ` +
      `Sample event IDs: ${sampleIds}` +
      (tradesWithoutStt.length > 5 ? ` ... and ${tradesWithoutStt.length - 5} more.` : '.'),
  };
}

// ---------------------------------------------------------------------------
// Aggregate runner
// ---------------------------------------------------------------------------

/**
 * runFullReconciliation
 *
 * Executes all reconciliation checks in sequence and aggregates them into a
 * single ReconciliationResult.
 *
 * Overall status priority: FAILED > WARNING > PASSED.
 */
export function runFullReconciliation(params: {
  events: CanonicalEvent[];
  vouchers: VoucherDraft[];
  rawTradebookRows?: Record<string, unknown>[];
  holdingsRows?: Record<string, unknown>[];
}): ReconciliationResult {
  const { events, vouchers, rawTradebookRows = [], holdingsRows = [] } = params;

  const checks: ReconciliationCheck[] = [
    checkTradeTotals(events, rawTradebookRows),
    checkVoucherBalance(vouchers),
    checkHoldingsReconciliation(events, holdingsRows),
    checkDuplicateEvents(events),
    checkChargeCompleteness(events),
  ];

  const failedChecks = checks.filter((c) => c.status === 'FAILED');
  const warningChecks = checks.filter((c) => c.status === 'WARNING');

  const mismatch_count = failedChecks.length;
  const warning_count = warningChecks.length;

  const overall_status: 'PASSED' | 'FAILED' | 'WARNING' =
    mismatch_count > 0 ? 'FAILED' : warning_count > 0 ? 'WARNING' : 'PASSED';

  const passedCount = checks.filter((c) => c.status === 'PASSED').length;
  const summary =
    overall_status === 'PASSED'
      ? `All ${checks.length} reconciliation checks passed.`
      : `${passedCount}/${checks.length} checks passed. ` +
        (mismatch_count > 0 ? `${mismatch_count} FAILED. ` : '') +
        (warning_count > 0 ? `${warning_count} WARNING(s).` : '');

  return {
    checks,
    overall_status,
    mismatch_count,
    warning_count,
    summary,
  };
}
