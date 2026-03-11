/**
 * exceptions.ts
 * Detects structured exception cases from reconciliation results and raw event data.
 * Each exception carries a type, severity, human-readable description, source refs,
 * and a suggested remediation action.
 */

import Decimal from 'decimal.js';
import { CanonicalEvent, EventType } from '../types/events';
import {
  ExceptionType,
  ExceptionSeverity,
} from '../types/reconciliation';
import { ReconciliationResult } from './checks';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface DetectedException {
  exception_type: ExceptionType | string;
  severity: ExceptionSeverity | string;
  description: string;
  source_refs: string[];
  suggested_action: string;
}

// ---------------------------------------------------------------------------
// Known charge types that the engine understands
// ---------------------------------------------------------------------------

/**
 * Set of charge_type values the engine recognises as standard.
 * Any value outside this set raises an UNKNOWN_CHARGE exception.
 */
const KNOWN_CHARGE_TYPES = new Set<string>([
  EventType.BROKERAGE,
  EventType.STT,
  EventType.EXCHANGE_CHARGE,
  EventType.SEBI_CHARGE,
  EventType.GST_ON_CHARGES,
  EventType.STAMP_DUTY,
  EventType.DP_CHARGE,
  // Also accept the string literals that may arrive from raw broker data
  'BROKERAGE',
  'STT',
  'EXCHANGE_CHARGE',
  'SEBI_CHARGE',
  'GST_ON_CHARGES',
  'STAMP_DUTY',
  'DP_CHARGE',
  'TDS',
  'IPFT',
  'CLEARING_CHARGE',
  'TRANSACTION_CHARGE',
]);

// ---------------------------------------------------------------------------
// Keywords used for text-based pattern matching
// ---------------------------------------------------------------------------

const OFF_MARKET_KEYWORDS = [
  'off-market',
  'off market',
  'dp transfer',
  'demat transfer',
  'off-mkt',
  'inter-depository',
  'cdsl transfer',
  'nsdl transfer',
];

const AUCTION_KEYWORDS = [
  'auction',
  'short delivery',
  'short del',
  'auction settlement',
  'close-out',
  'closeout',
];

// ---------------------------------------------------------------------------
// Helper: compute running net quantity per security
// ---------------------------------------------------------------------------

function computeNegativeQuantityEvents(
  events: CanonicalEvent[],
): Array<{ event_id: string; security_id: string; running_qty: Decimal }> {
  // Sort events chronologically before simulating
  const sorted = [...events].sort((a, b) => {
    if (a.event_date < b.event_date) return -1;
    if (a.event_date > b.event_date) return 1;
    return 0;
  });

  const runningQty = new Map<string, Decimal>();
  const negativeEvents: Array<{
    event_id: string;
    security_id: string;
    running_qty: Decimal;
  }> = [];

  for (const event of sorted) {
    if (
      (event.event_type !== EventType.BUY_TRADE &&
        event.event_type !== EventType.SELL_TRADE) ||
      !event.security_id
    ) {
      continue;
    }

    const prev = runningQty.get(event.security_id) ?? new Decimal(0);
    // quantity is signed: positive for buys, negative for sells
    const qty = new Decimal(event.quantity);
    const next = prev.plus(qty);
    runningQty.set(event.security_id, next);

    if (next.isNegative()) {
      negativeEvents.push({
        event_id: event.event_id,
        security_id: event.security_id,
        running_qty: next,
      });
    }
  }

  return negativeEvents;
}

// ---------------------------------------------------------------------------
// Helper: find duplicate event hashes
// ---------------------------------------------------------------------------

function findDuplicateHashes(
  events: CanonicalEvent[],
): Map<string, string[]> {
  const hashToIds = new Map<string, string[]>();
  for (const event of events) {
    const ids = hashToIds.get(event.event_hash) ?? [];
    ids.push(event.event_id);
    hashToIds.set(event.event_hash, ids);
  }
  return new Map([...hashToIds].filter(([, ids]) => ids.length > 1));
}

// ---------------------------------------------------------------------------
// Helper: check whether any text field contains a keyword (case-insensitive)
// ---------------------------------------------------------------------------

function containsKeyword(text: string | null | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * detectExceptions
 *
 * Analyses canonical events together with the completed reconciliation result
 * and returns a list of structured exceptions suitable for storage as ExceptionCase
 * records or display in the review UI.
 *
 * Detection order follows severity (ERROR first, then WARNING, then INFO).
 */
export function detectExceptions(
  events: CanonicalEvent[],
  reconciliationResult: ReconciliationResult,
): DetectedException[] {
  const exceptions: DetectedException[] = [];

  // -------------------------------------------------------------------------
  // 1. NEGATIVE_QUANTITY (ERROR)
  //    A sell event would push the running position below zero, indicating a
  //    data gap (e.g. the opening holdings were not provided or buys are missing).
  // -------------------------------------------------------------------------
  const negativeQtyEvents = computeNegativeQuantityEvents(events);
  if (negativeQtyEvents.length > 0) {
    const uniqueSecurities = [...new Set(negativeQtyEvents.map((e) => e.security_id))];
    const sourceRefs = negativeQtyEvents.map((e) => e.event_id);
    exceptions.push({
      exception_type: ExceptionType.NEGATIVE_QUANTITY,
      severity: ExceptionSeverity.ERROR,
      description:
        `${negativeQtyEvents.length} sell event(s) across ${uniqueSecurities.length} ` +
        `security(ies) would result in a negative open position: ` +
        uniqueSecurities.slice(0, 5).join(', ') +
        (uniqueSecurities.length > 5 ? ` and ${uniqueSecurities.length - 5} more` : '') +
        '. This typically means buy events are missing or holdings data was not imported.',
      source_refs: sourceRefs,
      suggested_action:
        'Upload the complete tradebook for this period including all buy transactions, ' +
        'or provide an opening holdings snapshot so the engine can compute the correct ' +
        'starting position for each security.',
    });
  }

  // -------------------------------------------------------------------------
  // 2. DUPLICATE_IMPORT (ERROR)
  //    Duplicate event_hash values indicate the same data was imported more than once.
  // -------------------------------------------------------------------------
  const duplicates = findDuplicateHashes(events);
  if (duplicates.size > 0) {
    const allDuplicateEventIds = [...duplicates.values()].flat();
    const sampleHashes = [...duplicates.keys()]
      .slice(0, 3)
      .map((h) => h.slice(0, 12) + '…')
      .join(', ');

    exceptions.push({
      exception_type: ExceptionType.DUPLICATE_IMPORT,
      severity: ExceptionSeverity.ERROR,
      description:
        `${duplicates.size} duplicate event hash(es) detected across ` +
        `${allDuplicateEventIds.length} event(s). Sample hashes: ${sampleHashes}. ` +
        'The same file or date range appears to have been imported more than once.',
      source_refs: allDuplicateEventIds,
      suggested_action:
        'Review the import history and delete the duplicate import batch before proceeding. ' +
        'If the duplicates are intentional (e.g. amended contract notes), ' +
        'mark the older events as superseded.',
    });
  }

  // -------------------------------------------------------------------------
  // 3. HOLDINGS_MISMATCH (ERROR)
  //    The holdings reconciliation check failed – computed position does not
  //    match the broker holdings snapshot.
  // -------------------------------------------------------------------------
  const holdingsCheck = reconciliationResult.checks.find(
    (c) => c.check_name === 'HOLDINGS_RECONCILIATION',
  );
  if (holdingsCheck && holdingsCheck.status === 'FAILED') {
    exceptions.push({
      exception_type: ExceptionType.HOLDINGS_MISMATCH,
      severity: ExceptionSeverity.ERROR,
      description:
        `Holdings reconciliation failed: ${holdingsCheck.details} ` +
        'Computed closing positions do not match the broker holdings snapshot.',
      source_refs: [],
      suggested_action:
        'Compare the broker holdings report date against the last trade date in the import ' +
        'batch to ensure they align. Check for corporate actions (bonus, split, merger) ' +
        'that may have altered share counts and are not yet represented as canonical events.',
    });
  }

  // -------------------------------------------------------------------------
  // 4. UNKNOWN_CHARGE (WARNING)
  //    An event carries a charge_type that the engine does not recognise.
  // -------------------------------------------------------------------------
  const unknownChargeEvents = events.filter(
    (e) =>
      e.charge_type !== null &&
      e.charge_type !== undefined &&
      e.charge_type.trim() !== '' &&
      !KNOWN_CHARGE_TYPES.has(e.charge_type.trim().toUpperCase()) &&
      !KNOWN_CHARGE_TYPES.has(e.charge_type.trim()),
  );

  if (unknownChargeEvents.length > 0) {
    const unknownTypes = [
      ...new Set(unknownChargeEvents.map((e) => e.charge_type as string)),
    ];
    exceptions.push({
      exception_type: ExceptionType.UNKNOWN_CHARGE,
      severity: ExceptionSeverity.WARNING,
      description:
        `${unknownChargeEvents.length} event(s) contain unrecognised charge type(s): ` +
        unknownTypes.slice(0, 5).join(', ') +
        (unknownTypes.length > 5 ? ` and ${unknownTypes.length - 5} more` : '') +
        '. These charges will not be mapped to a standard ledger head.',
      source_refs: unknownChargeEvents.map((e) => e.event_id),
      suggested_action:
        'Add the new charge type(s) to the engine charge mapping table and re-run parsing, ' +
        'or manually assign a ledger head to each affected event before export.',
    });
  }

  // -------------------------------------------------------------------------
  // 5. OFF_MARKET_TRANSFER (WARNING)
  //    Events whose narrative or external_ref contains off-market transfer keywords.
  //    These require a manual journal entry and cannot be auto-generated.
  // -------------------------------------------------------------------------
  const offMarketEvents = events.filter(
    (e) =>
      e.event_type === EventType.OFF_MARKET_TRANSFER ||
      containsKeyword(e.external_ref, OFF_MARKET_KEYWORDS) ||
      containsKeyword(e.contract_note_ref, OFF_MARKET_KEYWORDS),
  );

  if (offMarketEvents.length > 0) {
    exceptions.push({
      exception_type: ExceptionType.OFF_MARKET_TRANSFER,
      severity: ExceptionSeverity.WARNING,
      description:
        `${offMarketEvents.length} off-market or DP transfer event(s) detected. ` +
        'These transfers occur outside the exchange and require manual accounting treatment ' +
        '(cost basis, taxation, and consideration details must be entered manually).',
      source_refs: offMarketEvents.map((e) => e.event_id),
      suggested_action:
        'Create manual journal entries for each off-market transfer, ensuring you record ' +
        'the correct cost of acquisition/disposal and any applicable stamp duty or ' +
        'regulatory charges. Consult the client for transfer consideration details.',
    });
  }

  // -------------------------------------------------------------------------
  // 6. AUCTION_EVENT (WARNING)
  //    Events related to auction settlement or short delivery require special
  //    accounting treatment under SEBI auction rules.
  // -------------------------------------------------------------------------
  const auctionEvents = events.filter(
    (e) =>
      e.event_type === EventType.AUCTION_ADJUSTMENT ||
      containsKeyword(e.external_ref, AUCTION_KEYWORDS) ||
      containsKeyword(e.contract_note_ref, AUCTION_KEYWORDS),
  );

  if (auctionEvents.length > 0) {
    exceptions.push({
      exception_type: ExceptionType.AUCTION_EVENT,
      severity: ExceptionSeverity.WARNING,
      description:
        `${auctionEvents.length} auction settlement or short-delivery event(s) detected. ` +
        'Auction close-out proceeds are taxed differently from normal trade proceeds and ' +
        'require a separate ledger treatment per SEBI circular.',
      source_refs: auctionEvents.map((e) => e.event_id),
      suggested_action:
        'Review each auction event and ensure the settlement amount is booked to the ' +
        '"Auction Settlement" ledger head rather than the standard securities trading account. ' +
        'Consult your tax advisor for the applicable capital gains treatment.',
    });
  }

  return exceptions;
}
