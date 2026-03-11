/**
 * canonical-events.ts
 * Converts parsed Zerodha rows into CanonicalEvent objects.
 *
 * All monetary arithmetic uses decimal.js to preserve precision.
 * IDs are generated with crypto.randomUUID(); event_hash is a deterministic
 * SHA-256 over the event's identifying fields for duplicate detection.
 */

import Decimal from 'decimal.js';
import { createHash } from 'crypto';
import { EventType, type CanonicalEvent } from '../types/events';
import type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
} from '../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Derive an ISO date string from a Zerodha date value.
 *  Zerodha exports dates as "DD-MM-YYYY" or "YYYY-MM-DD". Normalise to
 *  "YYYY-MM-DD" for consistent downstream handling.
 */
function normaliseDate(raw: string): string {
  const trimmed = raw.trim();
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  // DD-MM-YYYY or DD/MM/YYYY
  const parts = trimmed.split(/[-/]/);
  if (parts.length >= 3 && parts[0].length === 2) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return trimmed.slice(0, 10);
}

/** Generate a deterministic hex hash over the supplied fields. */
function buildHash(...fields: string[]): string {
  return createHash('sha256').update(fields.join('|')).digest('hex');
}

/** Build the canonical security_id used throughout the engine.
 *  Convention: "{exchange}:{symbol}" — keeps it human-readable and unique
 *  across exchanges.
 */
function buildSecurityId(exchange: string, symbol: string): string {
  return `${exchange.trim().toUpperCase()}:${symbol.trim().toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Keyword sets for funds-statement classification
// ---------------------------------------------------------------------------

const DIVIDEND_KEYWORDS = [
  'dividend',
  'div',
  'interim dividend',
  'final dividend',
];

const SETTLEMENT_DEBIT_KEYWORDS = [
  'settlement',
  'pay-in',
  'payin',
  'funds withdrawn',
  'withdrawal',
];

const SETTLEMENT_CREDIT_KEYWORDS = [
  'payout',
  'pay-out',
  'funds received',
  'receipt',
  'settlement credit',
];

function descriptionContains(description: string, keywords: string[]): boolean {
  const lower = description.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Public converters
// ---------------------------------------------------------------------------

/**
 * Convert a single Zerodha tradebook row into one CanonicalEvent.
 * Each row maps 1-to-1 with a BUY_TRADE or SELL_TRADE event.
 * No charge events are generated here; Zerodha tradebooks do not carry
 * per-trade charge breakdowns (those come from contract notes).
 */
export function tradebookRowToEvents(
  row: ZerodhaTradebookRow,
  batchId: string,
  fileId: string,
): CanonicalEvent[] {
  const eventId = crypto.randomUUID();
  const eventType =
    row.trade_type === 'buy' ? EventType.BUY_TRADE : EventType.SELL_TRADE;

  const qty = new Decimal(row.quantity);
  const price = new Decimal(row.price);
  const grossAmount = qty.mul(price);

  const eventDate = normaliseDate(row.trade_date);
  const securityId = buildSecurityId(row.exchange, row.symbol);

  // Signed quantity: positive for buys, negative for sells (accounting convention)
  const signedQty =
    eventType === EventType.BUY_TRADE ? qty : qty.negated();

  const eventHash = buildHash(
    row.trade_id,
    row.trade_date,
    row.symbol,
    row.quantity,
    row.price,
  );

  const event: CanonicalEvent = {
    event_id: eventId,
    import_batch_id: batchId,
    event_type: eventType,
    event_date: eventDate,
    settlement_date: null, // T+1/T+2 settlement date not present in tradebook rows
    security_id: securityId,
    quantity: signedQty.toFixed(),
    rate: new Decimal(row.price).toFixed(),
    gross_amount: grossAmount.toFixed(2),
    charge_type: null,
    charge_amount: '0',
    source_file_id: fileId,
    source_row_ids: [row.trade_id],
    contract_note_ref: null,
    external_ref: row.order_id || null,
    event_hash: eventHash,
  };

  return [event];
}

/**
 * Convert a single Zerodha funds-statement row into one or more CanonicalEvents.
 *
 * Classification logic:
 * 1. If description contains dividend keywords → DIVIDEND (always a credit)
 * 2. If credit > 0 → BANK_RECEIPT
 * 3. If debit > 0  → BANK_PAYMENT
 * 4. Zero-value rows (running balance adjustments, etc.) are skipped.
 */
export function fundsStatementRowToEvents(
  row: ZerodhaFundsStatementRow,
  batchId: string,
  fileId: string,
): CanonicalEvent[] {
  const debit = new Decimal(row.debit || '0');
  const credit = new Decimal(row.credit || '0');
  const eventDate = normaliseDate(row.posting_date);

  // Skip zero-movement rows (e.g. opening balance, informational lines)
  if (debit.isZero() && credit.isZero()) {
    return [];
  }

  const isDividend = descriptionContains(row.description, DIVIDEND_KEYWORDS);
  const isCredit = credit.greaterThan(0);

  let eventType: EventType;
  if (isDividend) {
    eventType = EventType.DIVIDEND;
  } else if (isCredit) {
    eventType = EventType.BANK_RECEIPT;
  } else {
    eventType = EventType.BANK_PAYMENT;
  }

  const amount = isCredit ? credit : debit;
  const grossAmount = amount.toFixed(2);

  const rowKey = `${row.posting_date}|${row.description}|${row.debit}|${row.credit}`;
  const eventHash = buildHash(rowKey);
  const eventId = crypto.randomUUID();

  // For dividend events we can attempt to derive security_id from instrument field
  const securityId =
    isDividend && row.instrument
      ? `UNKNOWN:${row.instrument.trim().toUpperCase()}`
      : null;

  const event: CanonicalEvent = {
    event_id: eventId,
    import_batch_id: batchId,
    event_type: eventType,
    event_date: eventDate,
    settlement_date: null,
    security_id: securityId,
    quantity: '0',
    rate: '0',
    gross_amount: grossAmount,
    charge_type: null,
    charge_amount: '0',
    source_file_id: fileId,
    source_row_ids: [rowKey],
    contract_note_ref: null,
    external_ref: row.description || null,
    event_hash: eventHash,
  };

  return [event];
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Build the full set of CanonicalEvents for an import batch from all available
 * Zerodha file rows.
 *
 * Processing order: tradebook rows first (trades), then funds-statement rows
 * (cash movements), so downstream charge-grouping logic can link charges to
 * the trade events that generated them.
 */
export function buildCanonicalEvents(
  tradebookRows: ZerodhaTradebookRow[],
  fundsRows: ZerodhaFundsStatementRow[],
  batchId: string,
  tradebookFileId: string,
  fundsFileId: string,
): CanonicalEvent[] {
  const events: CanonicalEvent[] = [];

  for (const row of tradebookRows) {
    const rowEvents = tradebookRowToEvents(row, batchId, tradebookFileId);
    events.push(...rowEvents);
  }

  for (const row of fundsRows) {
    const rowEvents = fundsStatementRowToEvents(row, batchId, fundsFileId);
    events.push(...rowEvents);
  }

  return events;
}
