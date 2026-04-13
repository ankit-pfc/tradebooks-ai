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
import {
  classifyTrade,
  TradeClassification,
  TradeClassificationStrategy,
} from './trade-classifier';
import type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  CorporateActionInput,
} from '../parsers/zerodha/types';
import { allocateCharges } from './charge-allocator';
import { PipelineValidationError } from '../errors/pipeline-validation';

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

function normaliseSecurityToken(value: string): string {
  return value.trim().toUpperCase();
}


/**
 * Build the canonical security_id used throughout the engine.
 *
 * Unified convention:
 * - For equity-delivery segments (EQ, BE, Equity, NSE-EQ, BSE-EQ), use
 *   ISIN as the primary key when available (same across all Indian
 *   exchanges for a given company).  Falls back to EQ:SYMBOL when ISIN
 *   is absent.  This ensures BSE/NSE delivery trades share FIFO lots
 *   even if the symbol differs across exchanges.
 * - For non-equity segments (F&O, CDS, MCX), keep EXCHANGE:SYMBOL.
 */
export function buildUnifiedSecurityId(
  exchange: string,
  symbol: string,
  isin?: string | null,
  segment?: string,
): string {
  const normalizedSymbol = normaliseSecurityToken(symbol);
  const isEquity = segment ? isEquitySegment(segment) : false;

  if (isEquity) {
    // Prefer ISIN — it's identical across NSE/BSE for the same company.
    // Skip sentinel values like "NA" that indicate ISIN is unavailable.
    const trimmedIsin = isin?.trim().toUpperCase();
    if (trimmedIsin && trimmedIsin.length > 0 && trimmedIsin !== 'NA') {
      return `ISIN:${trimmedIsin}`;
    }
    return `EQ:${normalizedSymbol}`;
  }

  // Non-equity (F&O, CDS, …): always keep EXCHANGE:SYMBOL.
  return `${exchange.trim().toUpperCase()}:${normalizedSymbol}`;
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
  isinSymbolMap?: ReadonlyMap<string, string>,
  classificationStrategy: TradeClassificationStrategy = TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
): CanonicalEvent[] {
  const eventId = crypto.randomUUID();
  const eventType =
    row.trade_type === 'buy' ? EventType.BUY_TRADE : EventType.SELL_TRADE;
  const tradeClassification = classifyTrade(
    row.product,
    row.segment,
    row.exchange,
    { strategy: classificationStrategy },
  );

  const qty = new Decimal(row.quantity);
  const price = new Decimal(row.price);
  const grossAmount = qty.mul(price);

  const eventDate = normaliseDate(row.trade_date);
  const securityId = buildUnifiedSecurityId(row.exchange, row.symbol, row.isin, row.segment);

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

  // Cross-exchange symbol unification: if this trade's ISIN appears in the
  // batch-wide ISIN→canonical-symbol map, use that symbol so NSE and BSE
  // trades for the same security render to a single Tally stock item.
  const isinKey = row.isin?.trim().toUpperCase();
  const canonicalSymbol =
    isinKey && isinKey !== 'NA' && isinKey !== 'N/A' && isinKey !== '-'
      ? isinSymbolMap?.get(isinKey) ?? row.symbol?.trim().toUpperCase() ?? null
      : row.symbol?.trim().toUpperCase() ?? null;

  const event: CanonicalEvent = {
    event_id: eventId,
    import_batch_id: batchId,
    event_type: eventType,
    trade_classification: tradeClassification,
    trade_product: row.product?.trim().toUpperCase() || undefined,
    event_date: eventDate,
    settlement_date: null, // T+1/T+2 settlement date not present in tradebook rows
    security_id: securityId,
    security_symbol: canonicalSymbol,
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
    trade_product: undefined,
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
      trade_product: undefined,
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
    trade_product: undefined,
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
 * Extract ISIN from a contract-note security description if present.
 * Format: "SYMBOL - EQ / INE123A01036" → "INE123A01036"
 */
function extractIsinFromDescription(description: string): string | null {
  // Indian ISIN: country code IN + 10 alphanumeric chars (covers INE, INF, IN9, etc.)
  const match = description.match(/\b(IN[A-Z0-9]{10})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Extract a clean trading symbol from a Zerodha CN security description.
 *
 * Handles both formats Zerodha emits:
 *   - XLSX cash-equity:  "GEMENVIRO-M/INE0RUJ01013"   → "GEMENVIRO-M"
 *   - PDF/XML format:    "RELIANCE - EQ / INE002A01018" → "RELIANCE"
 *   - F&O format:        "NIFTY24DECFUT" (no ISIN)    → "NIFTY24DECFUT"
 *
 * Strips any trailing /ISIN before taking the first whitespace-delimited
 * token. The previous implementation split on whitespace only, which left
 * the slash-separated XLSX format unparsed and produced bad stock item
 * names like "GEMENVIRO-M/INE0RUJ01013-SH" in the Tally export.
 */
export function extractCleanSymbolFromCnDescription(description: string): string {
  const cleaned = description.trim().toUpperCase();
  // Strip trailing "/ISIN" or " / ISIN"
  const withoutIsin = cleaned.replace(/\s*\/\s*IN[A-Z0-9]{10}\s*$/i, '').trim();
  // Strip the optional " - SEGMENT" suffix on the PDF format and any other
  // trailing " - X" tokens. Take the first whitespace-delimited token.
  const firstToken = withoutIsin.split(/\s+/)[0] || withoutIsin;
  return firstToken;
}

/** True when `value` looks like a valid Indian ISIN (country code IN + 10 alnum). */
function isValidIsinLike(value: string): boolean {
  return /^IN[A-Z0-9]{10}$/i.test(value);
}

/**
 * Build a security_id from a contract-note security description.
 * Contract notes use full names like "RELIANCE INDUSTRIES LTD" while
 * tradebooks use symbols like "RELIANCE".
 *
 * Resolution order (most-to-least preferred):
 *   1. `explicitIsin` — the FY21-22 XLSX CN layout exposes ISIN as its own
 *      column; use it verbatim so segment-marker detection bugs cannot
 *      corrupt the security_id. Trusted because it is structured data.
 *   2. ISIN extracted from the description — the newer PDF/XML CN layout
 *      embeds the ISIN inside the security description ("SYMBOL - EQ / INE…").
 *   3. EXCHANGE:SYMBOL fallback — only reached when no ISIN is available.
 *
 * Historically the ISIN lookup was gated on `isEquitySegment(segment)`, but
 * the FY21-22 XLSX layout uses exchange-qualified segment markers that the
 * previous `SEGMENT_MARKERS` check did not recognise. Combined with the
 * layout's missing Exchange column, that bug produced malformed security
 * IDs like "1612.0:HEG" (price value read as exchange). Preferring the
 * explicit-ISIN column unconditionally eliminates that entire failure mode.
 */
export function buildSecurityIdFromDescription(
  exchange: string,
  description: string,
  segment?: string,
  symbolByDescription?: ReadonlyMap<string, string>,
  explicitIsin?: string | null,
): string {
  const cleaned = description.trim().toUpperCase();

  // 1. Explicit ISIN column (FY21-22 XLSX CN layout).
  const trimmedExplicit = explicitIsin?.trim().toUpperCase() ?? '';
  if (trimmedExplicit && isValidIsinLike(trimmedExplicit)) {
    return `ISIN:${trimmedExplicit}`;
  }

  // 2. ISIN embedded in the description (PDF/XML CN layout).
  const isinFromDesc = extractIsinFromDescription(cleaned);
  if (isinFromDesc) {
    return `ISIN:${isinFromDesc}`;
  }

  // 3. Fall back to the legacy EXCHANGE:SYMBOL (or EQ:SYMBOL) form.
  const mappedSymbol = symbolByDescription?.get(cleaned);
  if (mappedSymbol) {
    return buildSecurityId(exchange, mappedSymbol, segment);
  }
  const firstWord = cleaned.split(/\s+/)[0] || cleaned;
  return buildSecurityId(exchange, firstWord, segment);
}

/**
 * Build a Map<ISIN, canonicalSymbol> spanning all trade rows in a batch.
 *
 * Same-ISIN trades from different exchanges (NSE vs BSE) frequently use
 * different ticker symbols (e.g. NSE "HDFC" vs BSE "HDFC-A"). Without
 * unification, the Tally export creates a separate stock item per symbol
 * even though they refer to the same security, breaking inventory tracking
 * and FIFO across exchanges. This map ensures the FIRST symbol seen for a
 * given ISIN becomes the canonical symbol for every subsequent event.
 *
 * Trade rows without an extractable ISIN are not added to the map — they
 * fall through to per-row symbol extraction.
 */
export function buildIsinSymbolMap(opts: {
  contractNoteSheets?: ContractNoteSheet[];
  tradebookRows?: ZerodhaTradebookRow[];
}): Map<string, string> {
  const map = new Map<string, string>();
  for (const sheet of opts.contractNoteSheets ?? []) {
    for (const trade of sheet.trades) {
      // Prefer the explicit ISIN column (FY21-22 layout) when present, else
      // fall back to extracting it from the security description (newer layouts).
      const explicit = trade.isin?.trim().toUpperCase();
      const isin =
        explicit && /^IN[A-Z0-9]{10}$/i.test(explicit)
          ? explicit
          : extractIsinFromDescription(trade.security_description);
      if (!isin || map.has(isin)) continue;
      const symbol = extractCleanSymbolFromCnDescription(trade.security_description);
      if (symbol) map.set(isin, symbol);
    }
  }
  for (const row of opts.tradebookRows ?? []) {
    const isin = row.isin?.trim().toUpperCase();
    if (!isin || isin === 'NA' || isin === 'N/A' || isin === '-') continue;
    if (map.has(isin)) continue;
    const symbol = row.symbol?.trim().toUpperCase();
    if (symbol) map.set(isin, symbol);
  }
  return map;
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
  symbolByDescription?: ReadonlyMap<string, string>,
  isinSymbolMap?: ReadonlyMap<string, string>,
  classificationStrategy: TradeClassificationStrategy = TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
): CanonicalEvent[] {
  if (trades.length === 0) return [];

  const allocations = allocateCharges(trades, charges);
  const eventDate = normaliseDate(charges.trade_date);
  const events: CanonicalEvent[] = [];

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const alloc = allocations[i];
    const securityId = buildSecurityIdFromDescription(
      trade.exchange,
      trade.security_description,
      trade.segment,
      symbolByDescription,
      trade.isin,
    );

    const qty = new Decimal(trade.quantity);
    const price = new Decimal(trade.gross_rate);
    const grossAmount = qty.mul(price).abs();

    const eventType = trade.buy_sell === 'B' ? EventType.BUY_TRADE : EventType.SELL_TRADE;
    const signedQty = eventType === EventType.BUY_TRADE ? qty : qty.negated();
    // Standard Zerodha equity CNs do not carry a product column, so
    // `trade.product` is usually undefined here and classification falls back
    // to the segment/exchange + strategy heuristic. When a CN variant DOES
    // populate the optional product field (F&O/CDS, future exports), honor
    // it so strict classification can succeed without strategy help.
    const tradeClassification = classifyTrade(
      trade.product,
      trade.segment,
      trade.exchange,
      { strategy: classificationStrategy },
    );

    const tradeHash = buildHash(
      trade.trade_no,
      charges.trade_date,
      trade.security_description,
      trade.quantity,
      trade.gross_rate,
    );

    // Derive a clean trading symbol for display and Tally stock-item naming.
    // Priority order:
    //   1. ISIN → canonical-symbol map (so NSE & BSE trades for the same ISIN
    //      always render to the SAME stock item in Tally — fixes the bug
    //      where "scrips with different names across exchanges" produced
    //      duplicate stock items).
    //   2. extractCleanSymbolFromCnDescription (handles both "SYMBOL/ISIN"
    //      and "SYMBOL - SEGMENT / ISIN" Zerodha formats).
    //   3. legacy symbolByDescription lookup (kept for backwards compat).
    const descCleaned = trade.security_description.trim().toUpperCase();
    const isinFromDesc = extractIsinFromDescription(descCleaned);
    const canonicalFromIsin = isinFromDesc ? isinSymbolMap?.get(isinFromDesc) : undefined;
    const cnSymbol = canonicalFromIsin
      ?? extractCleanSymbolFromCnDescription(descCleaned)
      ?? symbolByDescription?.get(descCleaned)
      ?? descCleaned;

    // Trade event
    events.push({
      event_id: crypto.randomUUID(),
      import_batch_id: batchId,
      event_type: eventType,
      trade_classification: tradeClassification,
      trade_product: undefined,
      event_date: eventDate,
      settlement_date: null,
      security_id: securityId,
      security_symbol: cnSymbol,
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
        trade_classification: tradeClassification,
        trade_product: undefined,
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
        trade_classification: tradeClassification,
        trade_product: undefined,
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

function applyAssumeAllEqInvestment(events: CanonicalEvent[]): CanonicalEvent[] {
  return events.map((event) => {
    if (event.trade_classification !== TradeClassification.PROFILE_DRIVEN) {
      return event;
    }

    return {
      ...event,
      trade_classification: TradeClassification.INVESTMENT,
    };
  });
}

function ensureStrictClassification(events: CanonicalEvent[]): void {
  const ambiguousTrades = events.filter(
    (event) =>
      (event.event_type === EventType.BUY_TRADE || event.event_type === EventType.SELL_TRADE) &&
      event.trade_classification === TradeClassification.PROFILE_DRIVEN,
  );

  if (ambiguousTrades.length === 0) {
    return;
  }

  const sampleRows = ambiguousTrades.slice(0, 5).map((event) => ({
    source_row_id: event.source_row_ids[0] ?? null,
    event_date: event.event_date,
    security_id: event.security_id,
    security_symbol: event.security_symbol ?? null,
  }));

  throw new PipelineValidationError(
    'E_CLASSIFICATION_AMBIGUOUS',
    'Trade classification is ambiguous because broker product markers are missing. Choose ASSUME_ALL_EQ_INVESTMENT or HEURISTIC_SAME_DAY_FLAT_INTRADAY to allow inference.',
    {
      ambiguous_trade_count: ambiguousTrades.length,
      sample_rows: sampleRows,
    },
  );
}

function assignDeterministicEventIds(events: CanonicalEvent[]): CanonicalEvent[] {
  return events.map((event, index) => ({
    ...event,
    event_id: `evt_${buildHash('EVENT_ID', event.event_hash, String(index)).slice(0, 24)}`,
  }));
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
  contractNoteSymbolByDescription?: ReadonlyMap<string, string>;
  batchId: string;
  fileIds: {
    tradebook?: string;
    fundsStatement?: string;
    contractNote?: string;
    dividends?: string;
    corporateActions?: string;
  };
  classificationStrategy?: TradeClassificationStrategy;
  deterministicIds?: boolean;
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
    contractNoteSymbolByDescription,
    classificationStrategy = TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
    deterministicIds = false,
  } = opts;

  const events: CanonicalEvent[] = [];

  // Pre-pass: build the batch-wide ISIN → canonical-symbol map. CN sheets
  // are walked first so CN-derived symbols win over tradebook symbols when
  // both sources reference the same ISIN. This map is the cross-exchange
  // unifier — see buildIsinSymbolMap docstring.
  const isinSymbolMap = buildIsinSymbolMap({
    contractNoteSheets,
    tradebookRows,
  });

  // Under investor mode (ASSUME_ALL_EQ_INVESTMENT), we deliberately use
  // STRICT_PRODUCT during row creation so that no-product equity rows stay
  // PROFILE_DRIVEN instead of being short-circuited to INVESTMENT inside
  // classifyTrade(). The two-step post-pass below then (a) flips same-day
  // full-netoff groups to SPECULATIVE_BUSINESS via reclassifyIntradayTrades,
  // and (b) flips whatever is still PROFILE_DRIVEN to INVESTMENT via
  // applyAssumeAllEqInvestment. This ordering is what lets intraday
  // round-trips on FY21-22-style CNs (no product column) land on the
  // consolidated intraday voucher path.
  const rowCreationStrategy =
    classificationStrategy === TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT
      ? TradeClassificationStrategy.STRICT_PRODUCT
      : classificationStrategy;

  // Collect CN trade_no values for dedup against tradebook trade_id
  const cnTradeNos = new Set<string>();

  // 1. Contract-note events (trades + charges per sheet)
  for (const sheet of contractNoteSheets) {
    const cnEvents = contractNoteToEvents(
      sheet.trades,
      sheet.charges,
      batchId,
      fileIds.contractNote ?? '',
      contractNoteSymbolByDescription,
      isinSymbolMap,
      rowCreationStrategy,
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
    const rowEvents = tradebookRowToEvents(
      row,
      batchId,
      fileIds.tradebook ?? '',
      isinSymbolMap,
      rowCreationStrategy,
    );
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

  // 6. Apply explicit trade-classification strategy.
  let classifiedEvents = events;

  if (classificationStrategy === TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY) {
    classifiedEvents = reclassifyIntradayTrades(classifiedEvents);
  } else if (classificationStrategy === TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT) {
    // Step 1: detect same-day full netoffs in PROFILE_DRIVEN (unclassified)
    // trade events and flip them (plus their tied charges) to
    // SPECULATIVE_BUSINESS. This catches unclassified contract-note rows that
    // round-tripped on the same day (e.g. Graphite 07/04/21 on the FY21-22
    // Zerodha layout that has no product column) and routes them through the
    // intraday voucher path. Explicit CNC/MIS/NRML trades are untouched by
    // reclassifyIntradayTrades because that function only reclassifies
    // PROFILE_DRIVEN events.
    classifiedEvents = reclassifyIntradayTrades(classifiedEvents);
    // Step 2: everything still PROFILE_DRIVEN after step 1 is treated as
    // INVESTMENT (user intent: "if broker didn't tag it, it's a hold").
    classifiedEvents = applyAssumeAllEqInvestment(classifiedEvents);
  }

  ensureStrictClassification(classifiedEvents);

  // 7. Optional deterministic event IDs for explain/debug snapshots and
  // reproducible golden outputs.
  if (deterministicIds) {
    classifiedEvents = assignDeterministicEventIds(classifiedEvents);
  }

  return classifiedEvents;
}

/**
 * Group BUY/SELL trade events by (security_id, event_date) and detect
 * same-day intraday round-trips. Handles BOTH full netoffs (buyQty ==
 * sellQty → all trades are intraday) and partial netoffs (buyQty !=
 * sellQty → min(buy,sell) shares are intraday, the remainder is delivery).
 *
 * For partial netoffs, events from the smaller side are entirely intraday.
 * Events from the larger side are consumed in FIFO order up to
 * `intradayQty = min(buyQty, sellQty)`. If the boundary trade straddles
 * the split, it is cloned into two events: one SPECULATIVE (intraday
 * portion) and one PROFILE_DRIVEN (delivery portion), with proportionally
 * split charge events.
 *
 * Charge events tied to reclassified trades inherit SPECULATIVE_BUSINESS.
 * For full netoffs, charges are matched broadly by (security_id, event_date).
 * For partial netoffs, charges are matched precisely by external_ref to
 * avoid misattributing delivery charges to the intraday voucher.
 *
 * ONLY reclassifies PROFILE_DRIVEN trades (CN-sourced equity rows without
 * a product code). Explicit CNC/MIS/NRML classifications are respected.
 */
export function reclassifyIntradayTrades(events: CanonicalEvent[]): CanonicalEvent[] {
  // 1. Group trade events by (security_id, event_date)
  const groups = new Map<string, number[]>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.event_type !== EventType.BUY_TRADE && e.event_type !== EventType.SELL_TRADE) continue;
    if (!e.security_id) continue;
    const key = `${e.security_id}|${e.event_date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  }

  // 2. Index charge events by (security_id, event_date, external_ref) for
  //    precise lookup during partial-netoff charge splitting.
  const chargesByExtRef = new Map<string, number[]>();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE) continue;
    if (!e.external_ref || !e.security_id) continue;
    const ck = `${e.security_id}|${e.event_date}|${e.external_ref}`;
    if (!chargesByExtRef.has(ck)) chargesByExtRef.set(ck, []);
    chargesByExtRef.get(ck)!.push(i);
  }

  // 3. Analyze each group — build a replacement map.
  //    replacements: original index → array of replacement events.
  //    Unmapped indexes pass through unchanged.
  const replacements = new Map<number, CanonicalEvent[]>();
  const fullNetoffKeys = new Set<string>(); // broad charge reclassification
  const handledChargeIndexes = new Set<number>(); // prevent double-handling

  for (const [key, indexes] of groups) {
    if (indexes.length < 2) continue;

    // Only reclassify PROFILE_DRIVEN groups (no explicit product codes).
    const allProfileDriven = indexes.every(
      (idx) => events[idx].trade_classification === TradeClassification.PROFILE_DRIVEN,
    );
    if (!allProfileDriven) continue;

    let buyQty = new Decimal(0);
    let sellQty = new Decimal(0);
    let hasBuy = false;
    let hasSell = false;
    for (const idx of indexes) {
      const e = events[idx];
      const qty = new Decimal(e.quantity).abs();
      if (e.event_type === EventType.BUY_TRADE) {
        buyQty = buyQty.add(qty);
        hasBuy = true;
      } else {
        sellQty = sellQty.add(qty);
        hasSell = true;
      }
    }
    if (!hasBuy || !hasSell) continue;

    if (buyQty.equals(sellQty)) {
      // --- FULL NETOFF: all trades in the group are intraday ---
      for (const idx of indexes) {
        replacements.set(idx, [
          { ...events[idx], trade_classification: TradeClassification.SPECULATIVE_BUSINESS },
        ]);
      }
      fullNetoffKeys.add(key);
    } else {
      // --- PARTIAL NETOFF: split intraday vs delivery ---
      const intradayQty = Decimal.min(buyQty, sellQty);
      const buyIndexes = indexes.filter((i) => events[i].event_type === EventType.BUY_TRADE);
      const sellIndexes = indexes.filter((i) => events[i].event_type === EventType.SELL_TRADE);

      const isBuySideSmaller = buyQty.lte(sellQty);
      const smallerSide = isBuySideSmaller ? buyIndexes : sellIndexes;
      const largerSide = isBuySideSmaller ? sellIndexes : buyIndexes;

      // Smaller side is entirely intraday.
      for (const idx of smallerSide) {
        replacements.set(idx, [
          { ...events[idx], trade_classification: TradeClassification.SPECULATIVE_BUSINESS },
        ]);
        _reclassifyChargesForTrade(events[idx], events, chargesByExtRef, replacements, handledChargeIndexes);
      }

      // Consume from larger side in array order until intradayQty is filled.
      let remaining = intradayQty;
      for (const idx of largerSide) {
        if (remaining.isZero()) break;

        const e = events[idx];
        const qty = new Decimal(e.quantity).abs();

        if (remaining.gte(qty)) {
          // Fully consumed — entire trade is intraday.
          replacements.set(idx, [
            { ...events[idx], trade_classification: TradeClassification.SPECULATIVE_BUSINESS },
          ]);
          _reclassifyChargesForTrade(e, events, chargesByExtRef, replacements, handledChargeIndexes);
          remaining = remaining.sub(qty);
        } else {
          // Boundary trade — split into intraday + delivery portions.
          _splitTradeAndCharges(
            idx, remaining, qty.sub(remaining),
            events, chargesByExtRef, replacements, handledChargeIndexes,
          );
          remaining = new Decimal(0);
        }
      }
    }
  }

  if (replacements.size === 0 && fullNetoffKeys.size === 0) return events;

  // 4. Full-netoff charge reclassification (broad security_id|event_date match).
  //    This is the original behavior: for full netoffs every charge event in the
  //    same (security, date) group flips to SPECULATIVE. For partial netoffs the
  //    charge reclassification was already handled precisely by external_ref above.
  if (fullNetoffKeys.size > 0) {
    for (let i = 0; i < events.length; i++) {
      if (replacements.has(i) || handledChargeIndexes.has(i)) continue;
      const e = events[i];
      if (e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE) continue;
      if (!e.security_id) continue;
      const dk = `${e.security_id}|${e.event_date}`;
      if (fullNetoffKeys.has(dk)) {
        replacements.set(i, [
          { ...e, trade_classification: TradeClassification.SPECULATIVE_BUSINESS },
        ]);
      }
    }
  }

  // 5. Build result array.
  const result: CanonicalEvent[] = [];
  for (let i = 0; i < events.length; i++) {
    const rep = replacements.get(i);
    if (rep) {
      result.push(...rep);
    } else {
      result.push(events[i]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Partial-netoff helpers (internal to reclassifyIntradayTrades)
// ---------------------------------------------------------------------------

/**
 * Reclassify all charge events linked to `trade` (by external_ref) as
 * SPECULATIVE_BUSINESS. Used for non-split intraday trades in partial netoffs.
 */
function _reclassifyChargesForTrade(
  trade: CanonicalEvent,
  events: CanonicalEvent[],
  chargesByExtRef: ReadonlyMap<string, number[]>,
  replacements: Map<number, CanonicalEvent[]>,
  handledChargeIndexes: Set<number>,
): void {
  if (!trade.external_ref || !trade.security_id) return;
  const ck = `${trade.security_id}|${trade.event_date}|${trade.external_ref}`;
  const chargeIndexes = chargesByExtRef.get(ck) ?? [];
  for (const ci of chargeIndexes) {
    if (handledChargeIndexes.has(ci)) continue;
    handledChargeIndexes.add(ci);
    replacements.set(ci, [
      { ...events[ci], trade_classification: TradeClassification.SPECULATIVE_BUSINESS },
    ]);
  }
}

/**
 * Split a boundary trade event (and its associated charges) into an intraday
 * portion (SPECULATIVE_BUSINESS) and a delivery portion (PROFILE_DRIVEN).
 *
 * The intraday half keeps the original `external_ref` so the voucher builder's
 * chargeIndex lookup finds its charges. The delivery half gets a `:delivery`
 * suffix. Charges are split proportionally by qty ratio; the delivery portion
 * absorbs rounding remainders so the sum is preserved.
 */
function _splitTradeAndCharges(
  tradeIndex: number,
  intradayQty: Decimal,
  deliveryQty: Decimal,
  events: CanonicalEvent[],
  chargesByExtRef: ReadonlyMap<string, number[]>,
  replacements: Map<number, CanonicalEvent[]>,
  handledChargeIndexes: Set<number>,
): void {
  const e = events[tradeIndex];
  const rate = new Decimal(e.rate);
  const totalQty = intradayQty.add(deliveryQty);
  const sign = e.event_type === EventType.BUY_TRADE ? 1 : -1;

  // Split gross amounts so they sum exactly to the original.
  const intradayGross = rate.mul(intradayQty).toDecimalPlaces(2);
  const deliveryGross = new Decimal(e.gross_amount).sub(intradayGross);

  const intradayEvent: CanonicalEvent = {
    ...e,
    event_id: crypto.randomUUID(),
    trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
    quantity: intradayQty.mul(sign).toFixed(),
    gross_amount: intradayGross.toFixed(2),
    event_hash: buildHash(e.event_hash, 'intraday-split', intradayQty.toFixed()),
  };

  const deliveryEvent: CanonicalEvent = {
    ...e,
    event_id: crypto.randomUUID(),
    trade_classification: TradeClassification.PROFILE_DRIVEN,
    quantity: deliveryQty.mul(sign).toFixed(),
    gross_amount: deliveryGross.toFixed(2),
    external_ref: e.external_ref ? `${e.external_ref}:delivery` : null,
    event_hash: buildHash(e.event_hash, 'delivery-split', deliveryQty.toFixed()),
  };

  replacements.set(tradeIndex, [intradayEvent, deliveryEvent]);

  // Split associated charge events proportionally.
  if (!e.external_ref || !e.security_id) return;
  const ck = `${e.security_id}|${e.event_date}|${e.external_ref}`;
  const chargeIndexes = chargesByExtRef.get(ck) ?? [];
  const ratio = intradayQty.div(totalQty);

  for (const ci of chargeIndexes) {
    if (handledChargeIndexes.has(ci)) continue;
    handledChargeIndexes.add(ci);

    const ce = events[ci];
    const originalAmount = new Decimal(ce.charge_amount);
    const intradayAmount = originalAmount.mul(ratio).toDecimalPlaces(2);
    const deliveryAmount = originalAmount.sub(intradayAmount); // absorbs remainder

    const splitCharges: CanonicalEvent[] = [];
    if (!intradayAmount.isZero()) {
      splitCharges.push({
        ...ce,
        event_id: crypto.randomUUID(),
        trade_classification: TradeClassification.SPECULATIVE_BUSINESS,
        charge_amount: intradayAmount.toFixed(2),
        event_hash: buildHash(ce.event_hash, 'intraday-split', intradayAmount.toFixed(2)),
      });
    }
    if (!deliveryAmount.isZero()) {
      splitCharges.push({
        ...ce,
        event_id: crypto.randomUUID(),
        trade_classification: TradeClassification.PROFILE_DRIVEN,
        charge_amount: deliveryAmount.toFixed(2),
        external_ref: e.external_ref ? `${e.external_ref}:delivery` : ce.external_ref,
        event_hash: buildHash(ce.event_hash, 'delivery-split', deliveryAmount.toFixed(2)),
      });
    }
    if (splitCharges.length > 0) {
      replacements.set(ci, splitCharges);
    }
  }
}
