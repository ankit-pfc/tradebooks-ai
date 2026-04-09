/**
 * contract-notes.ts
 * Parser for Zerodha contract notes (XLSX).
 *
 * Contract note files are multi-sheet XLSX where each sheet is one trading day
 * (sheet name = "DD-MM-YYYY"). Unlike other Zerodha files, data starts in
 * column A.
 *
 * Each sheet structure:
 *  - Row 1-5: Header info (company name, compliance officer, address)
 *  - Row 6: CONTRACT NOTE NO, contract note number in col D
 *  - Row 7: Trade Date in col D, Settlement No in col J
 *  - Row 9-12: Client info (Name, Address, PAN, UCC)
 *  - Row 20: Trade header row (Order No., Order Time., Trade No., etc.)
 *  - Row 21: Segment marker ("Equity", "F&O", etc.)
 *  - Rows 22+: Trade data
 *  - After trades: charges section (Pay in/Pay out, Brokerage, STT, etc.)
 *  - Row with "Net amount receivable/(payable by client)" = final net
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type {
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ContractNoteParseResult,
} from './types';

export const PARSER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toStringGrid(sheet: XLSX.WorkSheet): string[][] {
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });
  return allRows.map((row) =>
    (row as unknown[]).map((cell) => {
      if (cell === null || cell === undefined) return '';
      return String(cell);
    }),
  );
}

function num(value: string): string {
  const cleaned = value.replace(/,/g, '').replace(/₹/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '') return '0';
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite()) return '0';
    return cleaned;
  } catch {
    return '0';
  }
}

/**
 * Normalize the sign convention of individual charge fields on a parsed
 * contract note.
 *
 * Zerodha ships contract notes in two different sign conventions for the
 * charges section:
 *
 *   - **FY22-23+ ("positive-cost")**: individual charge rows store positive
 *     magnitudes; the client pays these. A single small row is occasionally
 *     negative — a genuine rebate (e.g. -0.59 exchange-charge refund) that
 *     the sign-aware voucher builder handles correctly.
 *
 *   - **FY21-22 ("deduction")**: the entire NET TOTAL column is signed from
 *     the broker's perspective, so every charge row is stored as a negative
 *     number (costs appear as outflows from the client balance). The
 *     magnitudes are correct but the signs must be flipped so downstream
 *     code sees costs as positive.
 *
 * Detection: sum the nine individual cost fields as parsed. A non-negative
 * sum means we're in the FY22-23+ convention and any residual negatives are
 * real rebates — leave them alone. A negative sum means we're in the
 * FY21-22 convention and every cost field must have its sign flipped.
 *
 * `pay_in_pay_out` and `net_amount` are cash-flow markers (signed in both
 * conventions from the client's perspective) and are not touched here.
 *
 * @internal Exported for test coverage and cross-parser reuse.
 */
export function normalizeChargeSignConvention(
  charges: ZerodhaContractNoteCharges,
): ZerodhaContractNoteCharges {
  const costFields = [
    'brokerage',
    'exchange_charges',
    'clearing_charges',
    'cgst',
    'sgst',
    'igst',
    'stt',
    'sebi_fees',
    'stamp_duty',
  ] as const;

  const signedSum = costFields.reduce(
    (sum, key) => sum.add(new Decimal(charges[key] || '0')),
    new Decimal(0),
  );

  if (signedSum.gte(0)) return charges;

  // FY21-22 deduction convention: flip every non-zero individual cost field
  const flipped: ZerodhaContractNoteCharges = { ...charges };
  for (const key of costFields) {
    const parsed = new Decimal(charges[key] || '0');
    if (!parsed.isZero()) {
      flipped[key] = parsed.neg().toString();
    }
  }
  return flipped;
}

/** Collapse whitespace and strip spaces around '/' so "pay in / pay out" matches "pay in/pay out". */
function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function findRowStartingWith(
  rows: string[][],
  prefix: string,
  startFrom = 0,
): number {
  const lowerPrefix = normalizeLabel(prefix);
  for (let i = startFrom; i < rows.length; i++) {
    const firstCell = normalizeLabel(rows[i][0] ?? '');
    if (firstCell.startsWith(lowerPrefix)) return i;
  }
  return -1;
}

function extractCellValue(
  rows: string[][],
  rowIdx: number,
  colIdx: number,
): string {
  if (rowIdx < 0 || rowIdx >= rows.length) return '';
  return (rows[rowIdx][colIdx] ?? '').trim();
}

// Known segment markers in the trade section.
// Newer (FY22-23+) Zerodha CNs use plain labels like "Equity" / "F&O".
// Older (FY21-22) CNs use exchange-qualified labels like "NSE-EQ - Z",
// "BSE-EQ - Z", "NSE-F&O" on the row that precedes the trades for that
// exchange+segment combo. `normaliseSegmentMarker` normalises both forms to
// a canonical label ("Equity", "F&O", …) so the downstream security-id
// builder can tell that the trades are equity (and therefore prefer ISIN).
const SEGMENT_MARKERS = new Set([
  'equity', 'f&o', 'currency', 'commodity', 'mutual funds',
]);

function normaliseSegmentMarker(rawFirstCell: string): string | null {
  const lower = rawFirstCell.trim().toLowerCase();
  if (!lower) return null;

  if (SEGMENT_MARKERS.has(lower)) {
    // "equity" → "Equity", preserve others as-is (lower-cased downstream use)
    return lower === 'equity' ? 'Equity' : rawFirstCell.trim();
  }

  // FY21-22 style: "NSE-EQ - Z", "BSE-EQ - Z", "NSE-EQ", "BSE-EQ"
  if (/^(?:nse|bse)[-\s]?eq\b/.test(lower)) return 'Equity';
  // F&O: "NSE-F&O", "BSE-F&O"
  if (/^(?:nse|bse)[-\s]?f&o\b/.test(lower)) return 'F&O';
  // Currency derivatives: "NSE-CDS", "BSE-CDS"
  if (/^(?:nse|bse)[-\s]?cds\b/.test(lower)) return 'Currency';
  // Commodity: "MCX-COM", "MCX"
  if (/^mcx\b/.test(lower)) return 'Commodity';

  return null;
}

// ---------------------------------------------------------------------------
// Dynamic column mapping from header row
// ---------------------------------------------------------------------------

/** Canonical column names the parser needs. */
interface TradeColumnMap {
  order_no: number;
  order_time: number;
  trade_no: number;
  trade_time: number;
  security_description: number;
  buy_sell: number;
  quantity: number;
  exchange: number;
  gross_rate: number;
  brokerage_per_unit: number;
  net_rate: number;
  net_total: number;
  /** ISIN column — only present in the FY21-22 layout. -1 = absent. */
  isin: number;
}

/** Patterns to match header cells → canonical column name. */
const HEADER_PATTERNS: Array<{ key: keyof TradeColumnMap; patterns: string[] }> = [
  { key: 'order_no',              patterns: ['order no', 'order no.'] },
  { key: 'order_time',            patterns: ['order time', 'order time.'] },
  { key: 'trade_no',              patterns: ['trade no', 'trade no.'] },
  { key: 'trade_time',            patterns: ['trade time', 'trade time.'] },
  { key: 'security_description',  patterns: ['security', 'scrip name', 'security/contract description'] },
  { key: 'buy_sell',              patterns: ['buy', 'b/s', 'buy/sell', 'buy(b)/ sell(s)'] },
  { key: 'quantity',              patterns: ['quantity', 'qty'] },
  { key: 'exchange',              patterns: ['exchange'] },
  { key: 'gross_rate',            patterns: ['gross rate', 'trade price', 'gross rate per unit'] },
  { key: 'brokerage_per_unit',    patterns: ['brokerage per unit', 'brokerage', 'brokerage per unit (rs)'] },
  { key: 'net_rate',              patterns: ['net rate', 'net rate per unit', 'net rate per unit (rs)'] },
  { key: 'net_total',             patterns: ['net total', 'net total (before levies)'] },
  { key: 'isin',                  patterns: ['isin'] },
];

/**
 * Default column positions used as a fallback when header detection fails.
 *
 * Historically `exchange` defaulted to position 7 on the assumption that
 * every Zerodha CN exposes an Exchange column at that index. The FY21-22
 * equity CN layout violates that assumption: it has no Exchange column at
 * all, and position 7 is actually "Gross Rate". Falling back to 7 caused
 * the parser to read "1580.0" / "1612.0" etc as the exchange string, which
 * then propagated into a malformed security_id like "1612.0:HEG" and broke
 * FIFO matching across trade days.
 *
 * The fix: every column whose header may legitimately be absent from a
 * given CN layout (`exchange`, `isin`) defaults to `-1` (sentinel). The
 * trade-row assembly code checks for `>= 0` before reading the cell and
 * substitutes an empty string otherwise, so a missing column can no longer
 * silently alias onto a populated numeric column.
 */
const DEFAULT_COLUMN_MAP: TradeColumnMap = {
  order_no: 0,
  order_time: 1,
  trade_no: 2,
  trade_time: 3,
  security_description: 4,
  buy_sell: 5,
  quantity: 6,
  exchange: -1,
  gross_rate: 7,
  brokerage_per_unit: 8,
  net_rate: 9,
  net_total: 11,
  isin: -1,
};

/**
 * Build a column map by matching header cell text against known patterns.
 * Falls back to default positions for any column not found in the header.
 * @internal Exported for testing.
 */
export function buildColumnMap(headerRow: string[]): TradeColumnMap {
  const cols = { ...DEFAULT_COLUMN_MAP };
  const normalized = headerRow.map((c) => (c ?? '').trim().toLowerCase());

  for (const { key, patterns } of HEADER_PATTERNS) {
    const idx = normalized.findIndex((cell) =>
      patterns.some((p) => cell === p || cell.startsWith(p)),
    );
    if (idx >= 0) {
      cols[key] = idx;
    }
  }

  return cols;
}

// ---------------------------------------------------------------------------
// Single sheet parser
// ---------------------------------------------------------------------------

interface SheetParseResult {
  trades: ZerodhaContractNoteTradeRow[];
  charges: ZerodhaContractNoteCharges | null;
  /** Non-empty when trades were expected but parsing produced zero rows. */
  diagnostic?: string;
}

function parseSheet(rows: string[][]): SheetParseResult {
  // Extract metadata
  const contractNoteNoRow = findRowStartingWith(rows, 'contract note no');
  const contractNoteNo = contractNoteNoRow >= 0
    ? extractCellValue(rows, contractNoteNoRow, 3)
    : '';

  const tradeDateRow = findRowStartingWith(rows, 'trade date');
  const tradeDate = tradeDateRow >= 0
    ? extractCellValue(rows, tradeDateRow, 3)
    : '';

  // Settlement number - look in the same row or nearby
  let settlementNo = '';
  if (tradeDateRow >= 0) {
    // Settlement No. is typically in col 9 (J) of the trade date row
    settlementNo = extractCellValue(rows, tradeDateRow, 9);
  }

  // Find the trade header row — scan all cells in each row since the header
  // column may not be at position 0 if the sheet has extra leading columns.
  let tradeHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    for (const cell of rows[i]) {
      const val = (cell ?? '').trim().toLowerCase();
      if (val === 'order no.' || val === 'order no') {
        tradeHeaderIdx = i;
        break;
      }
    }
    if (tradeHeaderIdx >= 0) break;
  }

  const trades: ZerodhaContractNoteTradeRow[] = [];
  let currentSegment = '';
  let diagnostic: string | undefined;

  if (tradeHeaderIdx >= 0) {
    // Detect column positions from header row
    const cols = buildColumnMap(rows[tradeHeaderIdx]);

    // Content-based fallback for the Exchange column: when the header row
    // does not name it, sniff the first real trade row (one whose order_no
    // starts with a digit) at the documented Zerodha position 7. If that
    // cell holds an exchange-like token (2-4 uppercase letters, e.g. NSE,
    // BSE, MCX) we trust it; otherwise we leave the column unset.
    //
    // This is the split that avoids the FY21-22 regression: that layout has
    // NO Exchange column and position 7 is the numeric Gross Rate value
    // (e.g. "1580.0"). The previous unconditional positional fallback read
    // that number as the exchange string and produced corrupt security IDs
    // like "1580.0:HEG".
    if (cols.exchange < 0) {
      for (let k = tradeHeaderIdx + 1; k < rows.length; k++) {
        const sample = rows[k];
        const firstCell = (sample[cols.order_no] ?? '').trim();
        if (!/^\d/.test(firstCell)) continue;
        const candidate = (sample[7] ?? '').trim().toUpperCase();
        if (/^[A-Z]{2,4}$/.test(candidate)) {
          cols.exchange = 7;
        }
        break;
      }
    }

    // Parse trade rows after the header
    for (let i = tradeHeaderIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = (row[cols.order_no] ?? '').trim();
      const firstCellLower = firstCell.toLowerCase();

      // Check if this is a segment marker. Handles both the newer plain
      // labels ("Equity", "F&O") and the FY21-22 exchange-qualified labels
      // ("NSE-EQ - Z", "BSE-EQ - Z", "NSE-F&O", …).
      const normalisedSegment = normaliseSegmentMarker(firstCell);
      if (normalisedSegment) {
        currentSegment = normalisedSegment;
        continue;
      }

      // Stop at the charges section boundary. Use normalizeLabel so the
      // "PAY IN / PAY OUT OBLIGATION" variant (FY21-22 layout, spaces around
      // the slash) matches the same prefix as the newer "pay in/pay out".
      const firstCellNormalised = normalizeLabel(firstCell);
      if (firstCellNormalised.startsWith('pay in/pay out')) break;
      if (firstCellLower.startsWith('ncl-')) break;

      // Handle empty rows and "net total" boundaries
      if (firstCellLower === '' || firstCellLower.startsWith('net total')) {
        // Look ahead past empty rows for more trades vs charges
        let foundCharges = false;
        for (let j = i + 1; j < rows.length; j++) {
          const ahead = (rows[j][cols.order_no] ?? '').trim().toLowerCase();
          if (ahead === '') continue;
          // More trades or segment markers ahead — keep going
          if (SEGMENT_MARKERS.has(ahead) || /^\d/.test(ahead)) break;
          // Charges boundary — stop the trade loop
          if (ahead.startsWith('pay in') || ahead.startsWith('ncl-') || ahead.startsWith('net total')) {
            foundCharges = true;
          }
          break;
        }
        if (foundCharges) break;
        continue;
      }

      // Try to parse as a trade row — Order No should be numeric
      const orderNo = firstCell;
      if (!orderNo || !/^\d/.test(orderNo)) {
        continue;
      }

      // Buy/sell cell may be "B"/"S" or "buy"/"sell" (case-insensitive) —
      // normalize to the first character.
      const buySellRaw = (row[cols.buy_sell] ?? '').trim().toUpperCase();
      const buySell = buySellRaw.charAt(0);
      if (buySell !== 'B' && buySell !== 'S') continue;

      // Sentinel-guarded cell reads: `-1` means "header not found in this
      // layout" (e.g. FY21-22 CN has no Exchange column, newer CNs have no
      // ISIN column). Returning an empty string keeps the downstream
      // security-id builder honest instead of silently aliasing onto an
      // unrelated populated column.
      const exchangeCell =
        cols.exchange >= 0 ? (row[cols.exchange] ?? '').trim() : '';
      const isinCell =
        cols.isin >= 0 ? (row[cols.isin] ?? '').trim() : '';

      trades.push({
        order_no: orderNo,
        order_time: (row[cols.order_time] ?? '').trim(),
        trade_no: (row[cols.trade_no] ?? '').trim(),
        trade_time: (row[cols.trade_time] ?? '').trim(),
        security_description: (row[cols.security_description] ?? '').trim(),
        buy_sell: buySell as 'B' | 'S',
        quantity: num((row[cols.quantity] ?? '').trim()),
        exchange: exchangeCell,
        gross_rate: num((row[cols.gross_rate] ?? '').trim()),
        brokerage_per_unit: num((row[cols.brokerage_per_unit] ?? '').trim()),
        net_rate: num((row[cols.net_rate] ?? '').trim()),
        net_total: num((row[cols.net_total] ?? '').trim()),
        segment: currentSegment,
        isin: isinCell || undefined,
      });
    }

    // Diagnostic: header found but no trades extracted
    if (trades.length === 0) {
      const headerCells = rows[tradeHeaderIdx].map((c) => (c ?? '').trim()).filter(Boolean);
      diagnostic = `Trade header found at row ${tradeHeaderIdx + 1} with columns [${headerCells.join(', ')}] but no trade rows were extracted. ` +
        `Buy/sell column index: ${cols.buy_sell}. Check if the XLSX layout matches expected Zerodha format.`;
    }
  }

  // Parse charges section
  let charges: ZerodhaContractNoteCharges | null = null;

  const payInRow = findRowStartingWith(rows, 'pay in/pay out');
  if (payInRow >= 0) {
    // Detect the "NET TOTAL" column dynamically — its position shifts with
    // the number of exchange/segment columns (NSE-EQ, NSE-F&O, …, NET TOTAL).
    // Scan a few rows above payInRow for the header row that labels the
    // charge columns.
    let netTotalCol = -1;
    for (let r = Math.max(0, payInRow - 3); r < payInRow; r++) {
      const row = rows[r] ?? [];
      for (let c = 0; c < row.length; c++) {
        if (normalizeLabel(row[c] ?? '') === 'net total') {
          netTotalCol = c;
          break;
        }
      }
      if (netTotalCol >= 0) break;
    }

    const getChargeVal = (prefix: string): string => {
      const idx = findRowStartingWith(rows, prefix, payInRow);
      if (idx < 0) return '0';
      const row = rows[idx] ?? [];
      // Prefer the detected NET TOTAL column; fall back to the last non-empty
      // numeric cell on the row (robust against layout drift).
      if (netTotalCol >= 0) {
        const v = (row[netTotalCol] ?? '').trim();
        if (v) return num(v);
      }
      for (let c = row.length - 1; c >= 0; c--) {
        const v = (row[c] ?? '').trim();
        if (v && /^-?[\d,.]+$/.test(v.replace(/₹/g, '').trim())) return num(v);
      }
      return '0';
    };

    charges = normalizeChargeSignConvention({
      contract_note_no: contractNoteNo,
      trade_date: tradeDate,
      settlement_no: settlementNo,
      pay_in_pay_out: getChargeVal('pay in/pay out'),
      brokerage: getChargeVal('taxable value of supply'),
      exchange_charges: getChargeVal('exchange transaction charges'),
      clearing_charges: getChargeVal('clearing charges'),
      cgst: getChargeVal('cgst'),
      sgst: getChargeVal('sgst'),
      igst: getChargeVal('igst'),
      stt: getChargeVal('securities transaction tax'),
      sebi_fees: getChargeVal('sebi turnover fees'),
      stamp_duty: getChargeVal('stamp duty'),
      net_amount: getChargeVal('net amount receivable'),
    });
  }

  return { trades, charges, diagnostic };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseContractNotes(
  fileBuffer: Buffer,
  fileName: string,
): ContractNoteParseResult {
  if (fileBuffer.length === 0) {
    throw new Error(`File "${fileName}" is empty`);
  }

  const workbook = XLSX.read(fileBuffer, {
    type: 'buffer',
    cellText: true,
    cellDates: false,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error(`File "${fileName}" contains no sheets`);
  }

  const allTrades: ZerodhaContractNoteTradeRow[] = [];
  const allCharges: ZerodhaContractNoteCharges[] = [];
  const tradesPerSheet: number[] = [];
  const diagnostics: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const rows = toStringGrid(workbook.Sheets[sheetName]);
    const result = parseSheet(rows);
    allTrades.push(...result.trades);
    if (result.charges) {
      allCharges.push(result.charges);
      tradesPerSheet.push(result.trades.length);
    }
    if (result.diagnostic) {
      diagnostics.push(`Sheet "${sheetName}": ${result.diagnostic}`);
    }
  }

  // Derive date range from trade dates in charges
  const dates = allCharges
    .map((c) => c.trade_date)
    .filter(Boolean)
    .sort();

  return {
    trades: allTrades,
    charges: allCharges,
    tradesPerSheet,
    diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
    metadata: {
      row_count: allTrades.length,
      date_range: dates.length > 0
        ? { from: dates[0], to: dates[dates.length - 1] }
        : null,
      parser_version: PARSER_VERSION,
    },
  };
}
