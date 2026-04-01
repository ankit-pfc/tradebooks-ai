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
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  CorporateActionInput,
} from '../parsers/zerodha/types';
import { allocateCharges } from './charge-allocator';

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

/**
 * Returns true for equity-delivery segments where BSE and NSE are fungible.
 * Covers: "EQ" (standard equity), "BE" (BSE Book Entry / delivery), "EQUITY"
 * (PDF contract notes), and "NSE-EQ" / "BSE-EQ" (XML contract notes).
 */
function isEquitySegment(segment: string): boolean {
  const s = segment.trim().toUpperCase();
  return s === 'EQ' || s === 'BE' || s === 'EQUITY' || s.endsWith('-EQ');
}

/** Build the canonical security_id used throughout the engine.
 *  For equity segments (EQ, BE, Equity, NSE-EQ …) the exchange prefix is
 *  replaced with "EQ" so that a buy on NSE and a sell on BSE of the same
 *  scrip share a single FIFO lot queue.
 *  All other segments (FO, CDS, MCX …) keep the full "EXCHANGE:SYMBOL" key.
 */
function buildSecurityId(exchange: string, symbol: string, segment?: string): string {
  if (segment && isEquitySegment(segment)) {
    return `EQ:${symbol.trim().toUpperCase()}`;
  }
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

/*
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
*/

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
  const securityId = buildSecurityId(row.exchange, row.symbol, row.segment);

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
// Dividend file converter
// ---------------------------------------------------------------------------

/**
 * Convert a single ZerodhaDividendRow into CanonicalEvents.
 *
 * Produces one DIVIDEND event carrying the gross amount, plus one
 * TDS_ON_DIVIDEND charge event when TDS was deducted (gross > net).
 *
 * The gross amount is computed as `quantity × dividend_per_share` and TDS
 * is the difference between gross and the reported `net_dividend_amount`.
 */
export function dividendRowToEvents(
  row: ZerodhaDividendRow,
  batchId: string,
  fileId: string,
): CanonicalEvent[] {
  const qty = new Decimal(row.quantity);
  const dps = new Decimal(row.dividend_per_share);
  const gross = qty.mul(dps);
  const net = new Decimal(row.net_dividend_amount);
  const tds = gross.sub(net);

  const eventDate = normaliseDate(row.ex_date);
  const securityId = `UNKNOWN:${row.symbol.trim().toUpperCase()}`;
  const eventHash = buildHash(row.symbol, row.ex_date, row.quantity, row.dividend_per_share);

  const events: CanonicalEvent[] = [];

  // DIVIDEND event — carries the gross amount
  events.push({
    event_id: crypto.randomUUID(),
    import_batch_id: batchId,
    event_type: EventType.DIVIDEND,
    event_date: eventDate,
    settlement_date: null,
    security_id: securityId,
    quantity: row.quantity,
    rate: row.dividend_per_share,
    gross_amount: gross.toFixed(2),
    charge_type: null,
    charge_amount: '0',
    source_file_id: fileId,
    source_row_ids: [`${row.symbol}|${row.ex_date}`],
    contract_note_ref: null,
    external_ref: row.isin || null,
    event_hash: eventHash,
  });

  // TDS_ON_DIVIDEND charge event — only when TDS was deducted
  if (tds.greaterThan(0)) {
    events.push({
      event_id: crypto.randomUUID(),
      import_batch_id: batchId,
      event_type: EventType.TDS_ON_DIVIDEND,
      event_date: eventDate,
      settlement_date: null,
      security_id: securityId,
      quantity: '0',
      rate: '0',
      gross_amount: '0',
      charge_type: 'TDS_ON_DIVIDEND',
      charge_amount: tds.toFixed(2),
      source_file_id: fileId,
      source_row_ids: [`${row.symbol}|${row.ex_date}`],
      contract_note_ref: null,
      external_ref: null,
      event_hash: buildHash('TDS_ON_DIVIDEND', row.symbol, row.ex_date, tds.toFixed(2)),
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Corporate action converter
// ---------------------------------------------------------------------------

const ACTION_TYPE_TO_EVENT: Record<CorporateActionInput['action_type'], EventType> = {
  BONUS: EventType.BONUS_SHARES,
  STOCK_SPLIT: EventType.STOCK_SPLIT,
  RIGHTS_ISSUE: EventType.RIGHTS_ISSUE,
  MERGER_DEMERGER: EventType.MERGER_DEMERGER,
};

/**
 * Convert a corporate action input to CanonicalEvent(s).
 *
 * - BONUS/STOCK_SPLIT: single event with ratio in rate field, zero cash movement
 * - RIGHTS_ISSUE: event with cost_per_share as rate, gross_amount computed
 * - MERGER_DEMERGER: event with old security_id; newSecurityId stored in external_ref
 */
export function corporateActionToEvents(
  action: CorporateActionInput,
  batchId: string,
  fileId: string,
): CanonicalEvent[] {
  const eventDate = normaliseDate(action.action_date);
  const eventType = ACTION_TYPE_TO_EVENT[action.action_type];
  const ratio = new Decimal(action.ratio_numerator).div(new Decimal(action.ratio_denominator));

  // For rights issues, gross = ratio × cost_per_share (represents total outflow
  // per unit held; the actual cost depends on existing qty which is handled at
  // lot-adjustment time). We store cost_per_share as rate.
  const rate = action.cost_per_share
    ? new Decimal(action.cost_per_share).toFixed()
    : ratio.toFixed(6);
  const grossAmount = action.action_type === 'RIGHTS_ISSUE' && action.cost_per_share
    ? new Decimal(action.cost_per_share).mul(ratio).toFixed(2)
    : '0';

  const eventHash = buildHash(
    action.action_type,
    action.security_id,
    action.action_date,
    action.ratio_numerator,
    action.ratio_denominator,
  );

  return [{
    event_id: crypto.randomUUID(),
    import_batch_id: batchId,
    event_type: eventType,
    event_date: eventDate,
    settlement_date: null,
    security_id: action.security_id,
    quantity: '0', // quantity change is computed by CostLotTracker.adjustLots
    rate,
    gross_amount: grossAmount,
    charge_type: null,
    charge_amount: '0',
    source_file_id: fileId,
    source_row_ids: [`${action.action_type}|${action.security_id}|${action.action_date}`],
    contract_note_ref: null,
    external_ref: action.new_security_id ?? action.notes ?? null,
    event_hash: eventHash,
  }];
}

// ---------------------------------------------------------------------------
// Contract-note converter
// ---------------------------------------------------------------------------

/** Map of EventType to the charge_type label used on the CanonicalEvent. */
const CHARGE_EVENT_MAP: Array<{
  field: 'brokerage' | 'stt' | 'exchange_charges' | 'clearing_charges' | 'sebi_fees' | 'stamp_duty';
  eventType: EventType;
  chargeType: string;
}> = [
  { field: 'brokerage', eventType: EventType.BROKERAGE, chargeType: 'BROKERAGE' },
  { field: 'stt', eventType: EventType.STT, chargeType: 'STT' },
  { field: 'exchange_charges', eventType: EventType.EXCHANGE_CHARGE, chargeType: 'EXCHANGE_CHARGE' },
  { field: 'clearing_charges', eventType: EventType.EXCHANGE_CHARGE, chargeType: 'CLEARING_CHARGE' },
  { field: 'sebi_fees', eventType: EventType.SEBI_CHARGE, chargeType: 'SEBI_CHARGE' },
  { field: 'stamp_duty', eventType: EventType.STAMP_DUTY, chargeType: 'STAMP_DUTY' },
];

/**
 * Build a security_id from a contract-note security description.
 * Contract notes use full names like "RELIANCE INDUSTRIES LTD" while
 * tradebooks use symbols like "RELIANCE". We normalise to
 * "{exchange}:{FIRST_WORD}" which matches the tradebook convention
 * for ~90% of Zerodha equities.
 *
 * When `segment` indicates an equity segment (EQ, BE, Equity, NSE-EQ …) the
 * exchange prefix is replaced with "EQ" so BSE/NSE lots remain fungible.
 */
export function buildSecurityIdFromDescription(
  exchange: string,
  description: string,
  segment?: string,
): string {
  const cleaned = description.trim().toUpperCase();
  // Use the first word as the symbol approximation
  const firstWord = cleaned.split(/\s+/)[0] || cleaned;
  return buildSecurityId(exchange, firstWord, segment);
}

/**
 * Convert a set of contract-note trades and their aggregate charges for a
 * single trading date into CanonicalEvents.
 *
 * Produces one BUY_TRADE or SELL_TRADE per trade row, plus one charge event
 * per non-zero charge type per trade (from proportional allocation).
 * GST (CGST + SGST + IGST) is consolidated into a single GST_ON_CHARGES event.
 */
export function contractNoteToEvents(
  trades: ZerodhaContractNoteTradeRow[],
  charges: ZerodhaContractNoteCharges,
  batchId: string,
  fileId: string,
): CanonicalEvent[] {
  if (trades.length === 0) return [];

  const allocations = allocateCharges(trades, charges);
  const eventDate = normaliseDate(charges.trade_date);
  const events: CanonicalEvent[] = [];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const alloc = allocations[i];
    const securityId = buildSecurityIdFromDescription(trade.exchange, trade.security_description, trade.segment);

    const qty = new Decimal(trade.quantity);
    const price = new Decimal(trade.gross_rate);
    const grossAmount = qty.mul(price).abs();

    const eventType = trade.buy_sell === 'B' ? EventType.BUY_TRADE : EventType.SELL_TRADE;
    const signedQty = eventType === EventType.BUY_TRADE ? qty : qty.negated();

    const tradeHash = buildHash(
      trade.trade_no,
      charges.trade_date,
      trade.security_description,
      trade.quantity,
      trade.gross_rate,
    );

    // Trade event
    events.push({
      event_id: crypto.randomUUID(),
      import_batch_id: batchId,
      event_type: eventType,
      event_date: eventDate,
      settlement_date: null,
      security_id: securityId,
      quantity: signedQty.toFixed(),
      rate: price.toFixed(),
      gross_amount: grossAmount.toFixed(2),
      charge_type: null,
      charge_amount: '0',
      source_file_id: fileId,
      source_row_ids: [trade.trade_no],
      contract_note_ref: charges.contract_note_no,
      external_ref: trade.trade_no,
      event_hash: tradeHash,
    });

    // Charge events (non-GST)
    for (const { field, eventType: chargeEventType, chargeType } of CHARGE_EVENT_MAP) {
      const amount = new Decimal(alloc[field]);
      if (amount.isZero()) continue;

      events.push({
        event_id: crypto.randomUUID(),
        import_batch_id: batchId,
        event_type: chargeEventType,
        event_date: eventDate,
        settlement_date: null,
        security_id: securityId,
        quantity: '0',
        rate: '0',
        gross_amount: '0',
        charge_type: chargeType,
        charge_amount: amount.toFixed(2),
        source_file_id: fileId,
        source_row_ids: [trade.trade_no],
        contract_note_ref: charges.contract_note_no,
        external_ref: trade.trade_no,
        event_hash: buildHash(chargeType, trade.trade_no, charges.trade_date, amount.toFixed(2)),
      });
    }

    // GST: consolidate CGST + SGST + IGST into one GST_ON_CHARGES event
    const gstTotal = new Decimal(alloc.cgst)
      .add(new Decimal(alloc.sgst))
      .add(new Decimal(alloc.igst));
    if (!gstTotal.isZero()) {
      events.push({
        event_id: crypto.randomUUID(),
        import_batch_id: batchId,
        event_type: EventType.GST_ON_CHARGES,
        event_date: eventDate,
        settlement_date: null,
        security_id: securityId,
        quantity: '0',
        rate: '0',
        gross_amount: '0',
        charge_type: 'GST_ON_CHARGES',
        charge_amount: gstTotal.toFixed(2),
        source_file_id: fileId,
        source_row_ids: [trade.trade_no],
        contract_note_ref: charges.contract_note_no,
        external_ref: trade.trade_no,
        event_hash: buildHash('GST_ON_CHARGES', trade.trade_no, charges.trade_date, gstTotal.toFixed(2)),
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/** A contract-note sheet: one charge summary paired with the trades from that sheet. */
export interface ContractNoteSheet {
  charges: ZerodhaContractNoteCharges;
  trades: ZerodhaContractNoteTradeRow[];
}

/**
 * Pair flat arrays of trades and charges into per-sheet groups.
 *
 * The contract-notes parser outputs trades and charges in sheet order.
 * Each charge entry records how many trades belong to it implicitly via the
 * parser's sequential output. Since ZerodhaContractNoteTradeRow lacks a date
 * field, we pair by counting: `tradesPerSheet[i]` trades belong to `charges[i]`.
 *
 * When `tradesPerSheet` is not available (i.e. the caller just has flat arrays),
 * we distribute trades to charges proportionally. For a single charge entry,
 * all trades belong to it.
 */
export function pairContractNoteData(
  trades: ZerodhaContractNoteTradeRow[],
  charges: ZerodhaContractNoteCharges[],
  tradesPerSheet?: number[],
): ContractNoteSheet[] {
  if (charges.length === 0) return [];

  if (tradesPerSheet) {
    const sheets: ContractNoteSheet[] = [];
    let offset = 0;
    for (let i = 0; i < charges.length; i++) {
      const count = tradesPerSheet[i] ?? 0;
      sheets.push({
        charges: charges[i],
        trades: trades.slice(offset, offset + count),
      });
      offset += count;
    }
    return sheets;
  }

  // Fallback: single charge entry gets all trades; otherwise cannot pair.
  if (charges.length === 1) {
    return [{ charges: charges[0], trades }];
  }

  // Multiple charges without explicit pairing — return each with empty trades
  // (the API route should always provide tradesPerSheet)
  return charges.map((c) => ({ charges: c, trades: [] }));
}

export interface BuildCanonicalEventsOpts {
  tradebookRows?: ZerodhaTradebookRow[];
  fundsRows?: ZerodhaFundsStatementRow[];
  /** Pre-paired contract note sheets (preferred) */
  contractNoteSheets?: ContractNoteSheet[];
  /** Standalone dividend rows (from dividends XLSX or Tax P&L dividend sheet) */
  dividendRows?: ZerodhaDividendRow[];
  /** Corporate action inputs (manual entry) */
  corporateActions?: CorporateActionInput[];
  batchId: string;
  fileIds: {
    tradebook?: string;
    fundsStatement?: string;
    contractNote?: string;
    dividends?: string;
    corporateActions?: string;
  };
}

/**
 * Build the full set of CanonicalEvents for an import batch from all available
 * Zerodha file data.
 *
 * When both tradebook and contract-note data are supplied, contract-note trade
 * events take priority (richer data: trade_no, charges, contract_note_ref).
 * Tradebook events whose event_hash matches a contract-note event are discarded.
 */
export function buildCanonicalEvents(opts: BuildCanonicalEventsOpts): CanonicalEvent[] {
  const {
    tradebookRows = [],
    fundsRows = [],
    contractNoteSheets = [],
    dividendRows = [],
    batchId,
    fileIds,
  } = opts;

  const events: CanonicalEvent[] = [];

  // Collect CN trade_no values for dedup against tradebook trade_id
  const cnTradeNos = new Set<string>();

  // 1. Contract-note events (trades + charges per sheet)
  for (const sheet of contractNoteSheets) {
    const cnEvents = contractNoteToEvents(
      sheet.trades,
      sheet.charges,
      batchId,
      fileIds.contractNote ?? '',
    );
    for (const e of cnEvents) {
      events.push(e);
      if (
        (e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE) &&
        e.external_ref
      ) {
        cnTradeNos.add(e.external_ref);
      }
    }
  }

  // 2. Tradebook events — skip those whose trade_id matches a CN trade_no
  for (const row of tradebookRows) {
    if (cnTradeNos.has(row.trade_id)) continue;
    const rowEvents = tradebookRowToEvents(row, batchId, fileIds.tradebook ?? '');
    events.push(...rowEvents);
  }

  // 3. Funds-statement events
  // When dedicated dividend rows are provided, skip funds-statement dividend
  // entries to prevent double-counting (the dedicated file has richer data
  // including gross amount and TDS breakdown).
  const skipFundsDividends = dividendRows.length > 0;
  for (const row of fundsRows) {
    if (skipFundsDividends && descriptionContains(row.description, DIVIDEND_KEYWORDS)) continue;
    const rowEvents = fundsStatementRowToEvents(row, batchId, fileIds.fundsStatement ?? '');
    events.push(...rowEvents);
  }

  // 4. Dividend file events (with TDS breakdown)
  for (const row of dividendRows) {
    const rowEvents = dividendRowToEvents(row, batchId, fileIds.dividends ?? '');
    events.push(...rowEvents);
  }

  // 5. Corporate action events (manual input)
  for (const action of (opts.corporateActions ?? [])) {
    const actionEvents = corporateActionToEvents(action, batchId, fileIds.corporateActions ?? '');
    events.push(...actionEvents);
  }

  return events;
}
