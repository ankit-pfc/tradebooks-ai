/**
 * trade-matcher.ts
 * Matches tradebook rows to contract-note trade rows for cross-file
 * reconciliation. Uses a priority-based matching strategy:
 *   1. EXACT: trade_no == trade_id
 *   2. HIGH: order_no + quantity + date match
 *   3. APPROXIMATE: date + security + direction + qty + price tolerance
 */

import Decimal from 'decimal.js';
import type {
  ZerodhaTradebookRow,
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
} from '../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MatchConfidence = 'EXACT' | 'HIGH' | 'APPROXIMATE';

export interface TradeMatch {
  tradebookRow: ZerodhaTradebookRow;
  contractNoteRow: ZerodhaContractNoteTradeRow;
  match_confidence: MatchConfidence;
}

export interface TradeMatchResult {
  matched: TradeMatch[];
  unmatchedTradebook: ZerodhaTradebookRow[];
  unmatchedContractNote: ZerodhaContractNoteTradeRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a Zerodha date to YYYY-MM-DD. */
function normaliseDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parts = trimmed.split(/[-/]/);
  if (parts.length >= 3 && parts[0].length === 2) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return trimmed.slice(0, 10);
}

/**
 * Normalise a contract-note security description to a short symbol.
 * "RELIANCE INDUSTRIES LTD" → "RELIANCE"
 * "TATA CONSULTANCY SERV LT" → "TATA"
 */
function normaliseDescription(desc: string): string {
  return desc.trim().toUpperCase().split(/\s+/)[0] || '';
}

/** Tradebook direction as 'B' | 'S'. */
function tbDirection(row: ZerodhaTradebookRow): 'B' | 'S' {
  return row.trade_type === 'buy' ? 'B' : 'S';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Match tradebook rows to contract-note trade rows.
 *
 * `cnCharges` is required to pair each CN trade with its trading date (since
 * ZerodhaContractNoteTradeRow does not carry a date field). The caller must
 * pass charges in the same order as the parser returns them, along with
 * `tradesPerSheet` to partition the flat trades array into per-date groups.
 *
 * For simplicity, this function also accepts the pre-paired representation
 * via `cnTradesWithDate`.
 */
export function matchTrades(
  tradebookRows: ZerodhaTradebookRow[],
  cnTradesWithDate: Array<{ trade: ZerodhaContractNoteTradeRow; tradeDate: string }>,
): TradeMatchResult {
  const matched: TradeMatch[] = [];
  const usedTbIndices = new Set<number>();
  const usedCnIndices = new Set<number>();

  // Pass 1: EXACT match by trade_no == trade_id
  for (let ci = 0; ci < cnTradesWithDate.length; ci++) {
    if (usedCnIndices.has(ci)) continue;
    const cn = cnTradesWithDate[ci];

    for (let ti = 0; ti < tradebookRows.length; ti++) {
      if (usedTbIndices.has(ti)) continue;
      const tb = tradebookRows[ti];

      if (cn.trade.trade_no === tb.trade_id) {
        matched.push({
          tradebookRow: tb,
          contractNoteRow: cn.trade,
          match_confidence: 'EXACT',
        });
        usedTbIndices.add(ti);
        usedCnIndices.add(ci);
        break;
      }
    }
  }

  // Pass 2: HIGH confidence — order_no + quantity + date
  for (let ci = 0; ci < cnTradesWithDate.length; ci++) {
    if (usedCnIndices.has(ci)) continue;
    const cn = cnTradesWithDate[ci];
    const cnDate = normaliseDate(cn.tradeDate);

    for (let ti = 0; ti < tradebookRows.length; ti++) {
      if (usedTbIndices.has(ti)) continue;
      const tb = tradebookRows[ti];

      if (
        cn.trade.order_no === tb.order_id &&
        cn.trade.quantity === tb.quantity &&
        cnDate === normaliseDate(tb.trade_date)
      ) {
        matched.push({
          tradebookRow: tb,
          contractNoteRow: cn.trade,
          match_confidence: 'HIGH',
        });
        usedTbIndices.add(ti);
        usedCnIndices.add(ci);
        break;
      }
    }
  }

  // Pass 3: APPROXIMATE — date + security + direction + qty + price tolerance
  for (let ci = 0; ci < cnTradesWithDate.length; ci++) {
    if (usedCnIndices.has(ci)) continue;
    const cn = cnTradesWithDate[ci];
    const cnDate = normaliseDate(cn.tradeDate);
    const cnSymbol = normaliseDescription(cn.trade.security_description);
    const cnPrice = new Decimal(cn.trade.gross_rate);

    for (let ti = 0; ti < tradebookRows.length; ti++) {
      if (usedTbIndices.has(ti)) continue;
      const tb = tradebookRows[ti];

      const dateMatch = cnDate === normaliseDate(tb.trade_date);
      const dirMatch = cn.trade.buy_sell === tbDirection(tb);
      const qtyMatch = cn.trade.quantity === tb.quantity;
      const symbolMatch = cnSymbol === tb.symbol.trim().toUpperCase();
      const priceDiff = cnPrice.sub(new Decimal(tb.price)).abs();
      const priceMatch = priceDiff.lte(new Decimal('0.05'));

      if (dateMatch && dirMatch && qtyMatch && symbolMatch && priceMatch) {
        matched.push({
          tradebookRow: tb,
          contractNoteRow: cn.trade,
          match_confidence: 'APPROXIMATE',
        });
        usedTbIndices.add(ti);
        usedCnIndices.add(ci);
        break;
      }
    }
  }

  // Collect unmatched
  const unmatchedTradebook = tradebookRows.filter((_, i) => !usedTbIndices.has(i));
  const unmatchedContractNote = cnTradesWithDate
    .filter((_, i) => !usedCnIndices.has(i))
    .map((entry) => entry.trade);

  return { matched, unmatchedTradebook, unmatchedContractNote };
}

/**
 * Helper to flatten contract-note data into the `cnTradesWithDate` format
 * expected by `matchTrades`.
 */
export function flattenCnTradesWithDate(
  trades: ZerodhaContractNoteTradeRow[],
  charges: ZerodhaContractNoteCharges[],
  tradesPerSheet: number[],
): Array<{ trade: ZerodhaContractNoteTradeRow; tradeDate: string }> {
  const result: Array<{ trade: ZerodhaContractNoteTradeRow; tradeDate: string }> = [];
  let offset = 0;

  for (let i = 0; i < charges.length; i++) {
    const count = tradesPerSheet[i] ?? 0;
    const date = charges[i].trade_date;
    for (let j = 0; j < count; j++) {
      if (offset + j < trades.length) {
        result.push({ trade: trades[offset + j], tradeDate: date });
      }
    }
    offset += count;
  }

  return result;
}
