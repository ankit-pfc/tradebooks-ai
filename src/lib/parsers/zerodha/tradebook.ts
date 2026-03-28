/**
 * tradebook.ts
 * Parser for Zerodha tradebook files (CSV or XLSX).
 *
 * Zerodha quirks handled:
 *  - UTF-8 BOM at the start of CSV exports
 *  - One or more metadata / disclaimer rows before the actual header row
 *  - Trailing empty rows after the last data row
 *  - "Symbol/Scrip" header (contains a forward-slash)
 *  - XLSX files delivered as .xlsx buffers
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type { ZerodhaTradebookRow, ParseMetadata } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PARSER_VERSION = '1.0.0';

/**
 * Core header names required in a Zerodha tradebook.
 * The parser searches for a row that contains all of these (case-insensitive).
 * Note: "Symbol" and "Symbol/Scrip" are treated as equivalent — XLSX exports
 * use "Symbol" while CSV exports use "Symbol/Scrip".
 */
const REQUIRED_HEADERS = [
  'Trade Date',
  'Exchange',
  'Segment',
  'ISIN',
  'Trade Type',
  'Quantity',
  'Price',
  'Trade ID',
  'Order ID',
  'Order Execution Time',
] as const;

/** Either form of the symbol column header is acceptable. */
const SYMBOL_HEADERS = ['Symbol/Scrip', 'Symbol'] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip UTF-8 BOM if present. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Normalise a raw header label to the snake_case key used in
 * ZerodhaTradebookRow.  Returns null for unrecognised headers so callers can
 * skip them cleanly.
 */
function normaliseHeader(raw: string): keyof ZerodhaTradebookRow | null {
  const map: Record<string, keyof ZerodhaTradebookRow> = {
    'trade date': 'trade_date',
    exchange: 'exchange',
    segment: 'segment',
    'symbol/scrip': 'symbol',
    symbol: 'symbol',
    isin: 'isin',
    'trade type': 'trade_type',
    quantity: 'quantity',
    price: 'price',
    'trade id': 'trade_id',
    'order id': 'order_id',
    'order execution time': 'order_execution_time',
    product: 'product',
    series: 'series',
    auction: 'auction',
    amount: 'amount',
  };
  return map[raw.trim().toLowerCase()] ?? null;
}

/** Validate and normalise a numeric string using Decimal.js. */
function parseNumeric(value: string, fieldName: string, rowIndex: number): string {
  const trimmed = value.trim();
  // Zerodha sometimes formats numbers with commas (e.g. "1,23,456.78")
  const cleaned = trimmed.replace(/,/g, '');
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite()) {
      throw new Error(`Non-finite value`);
    }
    return cleaned;
  } catch {
    throw new Error(
      `Invalid numeric value "${value}" in field "${fieldName}" at data row ${rowIndex + 1}`
    );
  }
}

/** Normalise trade_type to a strict union. */
function parseTradeType(value: string, rowIndex: number): 'buy' | 'sell' {
  const lower = value.trim().toLowerCase();
  if (lower === 'buy' || lower === 'sell') return lower;
  throw new Error(
    `Unexpected trade_type "${value}" at data row ${rowIndex + 1} — expected "buy" or "sell"`
  );
}

/**
 * Given a 2-D array of string rows (as returned by both PapaParse and XLSX),
 * find the index of the header row by scanning for a row that contains all
 * required headers plus at least one form of the symbol column.
 * Returns -1 if not found.
 */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase());
    const hasRequired = REQUIRED_HEADERS.every((h) =>
      cells.some((c) => c === h.toLowerCase())
    );
    const hasSymbol = SYMBOL_HEADERS.some((h) =>
      cells.some((c) => c === h.toLowerCase())
    );
    if (hasRequired && hasSymbol) return i;
  }
  return -1;
}

/**
 * Convert a 2-D string grid (header row + data rows) into typed
 * ZerodhaTradebookRow objects.
 */
function buildRows(headerRow: string[], dataRows: string[][]): ZerodhaTradebookRow[] {
  // Map column index -> normalised field name (null = skip)
  const colMap: Array<keyof ZerodhaTradebookRow | null> = headerRow.map(normaliseHeader);

  const results: ZerodhaTradebookRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];

    // Skip completely empty rows
    if (cells.every((c) => c.trim() === '')) continue;

    const raw: Partial<ZerodhaTradebookRow> = {};

    for (let col = 0; col < colMap.length; col++) {
      const field = colMap[col];
      if (field === null) continue;
      const cellValue = (cells[col] ?? '').trim();

      if (field === 'quantity' || field === 'price') {
        raw[field] = parseNumeric(cellValue, field, i);
      } else if (field === 'amount') {
        // amount is optional and may be empty
        if (cellValue) raw[field] = parseNumeric(cellValue, field, i);
      } else if (field === 'trade_type') {
        raw[field] = parseTradeType(cellValue, i);
      } else if (field === 'product') {
        // product is optional; normalise to uppercase union
        if (cellValue) {
          const upper = cellValue.toUpperCase() as 'CNC' | 'MIS' | 'NRML' | 'MTF';
          if (['CNC', 'MIS', 'NRML', 'MTF'].includes(upper)) {
            raw[field] = upper;
          }
        }
      } else {
        (raw as Record<string, string>)[field] = cellValue;
      }
    }

    // Verify all required fields are present (excludes optional series/auction/amount)
    const REQUIRED_FIELDS: Array<keyof ZerodhaTradebookRow> = [
      'trade_date', 'exchange', 'segment', 'symbol', 'isin',
      'trade_type', 'quantity', 'price', 'trade_id', 'order_id',
      'order_execution_time',
    ];
    const missing = REQUIRED_FIELDS.filter(
      (k) => raw[k] === undefined
    );

    if (missing.length > 0) {
      throw new Error(
        `Data row ${i + 1} is missing required fields: ${missing.join(', ')}`
      );
    }

    results.push(raw as ZerodhaTradebookRow);
  }

  return results;
}

/**
 * Derive date_range from the parsed rows.
 * Assumes trade_date strings are ISO-8601 or DD-MM-YYYY / YYYY-MM-DD
 * sortable after normalisation.
 */
function deriveDateRange(
  rows: ZerodhaTradebookRow[]
): { from: string; to: string } | null {
  if (rows.length === 0) return null;
  const dates = rows.map((r) => r.trade_date).filter(Boolean);
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------
// CSV path
// ---------------------------------------------------------------------------

function parseCsv(buffer: Buffer): ZerodhaTradebookRow[] {
  const raw = stripBom(buffer.toString('utf-8'));

  // PapaParse with header:false gives us a 2-D string array so we can
  // detect and skip metadata rows ourselves.
  const result = Papa.parse<string[]>(raw, {
    header: false,
    skipEmptyLines: false, // We handle empty rows ourselves
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(`CSV parse error at row ${first.row}: ${first.message}`);
  }

  const allRows = (result.data as string[][]).map((row) =>
    row.map((cell) => (typeof cell === 'string' ? cell : String(cell ?? '')))
  );

  const headerIdx = findHeaderRowIndex(allRows);
  if (headerIdx === -1) {
    throw new Error(
      'Could not locate the tradebook header row. ' +
        `Expected columns: ${[...REQUIRED_HEADERS, 'Symbol/Scrip or Symbol'].join(', ')}`
    );
  }

  const headerRow = allRows[headerIdx];
  const dataRows = allRows.slice(headerIdx + 1);

  return buildRows(headerRow, dataRows);
}

// ---------------------------------------------------------------------------
// XLSX path
// ---------------------------------------------------------------------------

function parseXlsx(buffer: Buffer): ZerodhaTradebookRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('XLSX file contains no sheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  // header:1 returns a 2-D array of raw cell values
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });

  // Convert everything to strings for uniform treatment
  const stringRows: string[][] = allRows.map((row) =>
    (row as unknown[]).map((cell) => {
      if (cell === null || cell === undefined) return '';
      return String(cell);
    })
  );

  const headerIdx = findHeaderRowIndex(stringRows);
  if (headerIdx === -1) {
    throw new Error(
      'Could not locate the tradebook header row in XLSX. ' +
        `Expected columns: ${[...REQUIRED_HEADERS, 'Symbol/Scrip or Symbol'].join(', ')}`
    );
  }

  const headerRow = stringRows[headerIdx];
  const dataRows = stringRows.slice(headerIdx + 1);

  return buildRows(headerRow, dataRows);
}

// ---------------------------------------------------------------------------
// File-type detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the buffer looks like a ZIP-based XLSX file
 * (starts with the PK magic bytes).
 */
function isXlsxBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TradebookParseResult {
  rows: ZerodhaTradebookRow[];
  metadata: ParseMetadata;
}

/**
 * Parse a Zerodha tradebook file from a Buffer.
 *
 * Auto-detects CSV vs XLSX from file content (magic bytes) rather than
 * relying solely on the file extension so that renamed files still work.
 *
 * @param fileBuffer - Raw file bytes.
 * @param fileName   - Original filename (used for error messages and as a
 *                     fallback hint when magic bytes are ambiguous).
 */
export function parseTradebook(
  fileBuffer: Buffer,
  fileName: string
): TradebookParseResult {
  if (fileBuffer.length === 0) {
    throw new Error(`File "${fileName}" is empty`);
  }

  const useXlsx =
    isXlsxBuffer(fileBuffer) ||
    fileName.toLowerCase().endsWith('.xlsx') ||
    fileName.toLowerCase().endsWith('.xls');

  const rows = useXlsx ? parseXlsx(fileBuffer) : parseCsv(fileBuffer);

  return {
    rows,
    metadata: {
      row_count: rows.length,
      date_range: deriveDateRange(rows),
      parser_version: PARSER_VERSION,
    },
  };
}
