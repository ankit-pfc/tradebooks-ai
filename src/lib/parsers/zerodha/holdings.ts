/**
 * holdings.ts
 * Parser for Zerodha holdings files (XLSX, occasionally CSV).
 *
 * Zerodha quirks handled:
 *  - UTF-8 BOM at the start of CSV exports
 *  - Header row may not be the first row (branding / summary rows above)
 *  - Trailing "Total" row at the bottom of the sheet (skipped)
 *  - Numeric values may include commas or percentage signs (e.g. "1,234.56",
 *    "2.34%") — percentage signs are stripped before Decimal parsing
 *  - Column headers use abbreviations: "Qty.", "Avg. cost", "Cur. val",
 *    "P&L", "Net chg.", "Day chg."
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type { ZerodhaHoldingsRow, ParseMetadata } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PARSER_VERSION = '1.0.0';

const REQUIRED_HEADERS = [
  'Instrument',
  'ISIN',
  'Qty.',
  'Avg. cost',
  'LTP',
  'Cur. val',
  'P&L',
  'Net chg.',
  'Day chg.',
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Normalise a raw header label to the snake_case field name used in
 * ZerodhaHoldingsRow.  Returns null for unrecognised columns.
 */
function normaliseHeader(raw: string): keyof ZerodhaHoldingsRow | null {
  const map: Record<string, keyof ZerodhaHoldingsRow> = {
    instrument: 'instrument',
    isin: 'isin',
    'qty.': 'quantity',
    'avg. cost': 'avg_cost',
    ltp: 'ltp',
    'cur. val': 'current_value',
    'p&l': 'pnl',
    'net chg.': 'net_change',
    'day chg.': 'day_change',
  };
  return map[raw.trim().toLowerCase()] ?? null;
}

/**
 * Validate and normalise a numeric string.
 * Handles commas (Indian number formatting) and trailing "%" characters.
 */
function parseNumeric(value: string, fieldName: string, rowIndex: number): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-') return '0';
  // Remove commas and optional trailing % (Net chg. / Day chg. are percentages)
  const cleaned = trimmed.replace(/,/g, '').replace(/%$/, '');
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite()) throw new Error('Non-finite');
    return cleaned;
  } catch {
    throw new Error(
      `Invalid numeric value "${value}" in field "${fieldName}" at data row ${rowIndex + 1}`
    );
  }
}

/** Find the header row index in a 2-D string grid. */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase());
    const hasAll = REQUIRED_HEADERS.every((h) => cells.includes(h.toLowerCase()));
    if (hasAll) return i;
  }
  return -1;
}

/**
 * Convert 2-D grid to ZerodhaHoldingsRow objects.
 * Automatically skips the final "Total" summary row if present.
 */
function buildRows(headerRow: string[], dataRows: string[][]): ZerodhaHoldingsRow[] {
  const colMap: Array<keyof ZerodhaHoldingsRow | null> = headerRow.map(normaliseHeader);

  const numericFields = new Set<keyof ZerodhaHoldingsRow>([
    'quantity',
    'avg_cost',
    'ltp',
    'current_value',
    'pnl',
    'net_change',
    'day_change',
  ]);

  const results: ZerodhaHoldingsRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];

    // Skip completely empty rows
    if (cells.every((c) => c.trim() === '')) continue;

    // Skip "Total" summary row — Zerodha appends one at the end of holdings exports
    const firstCell = (cells[0] ?? '').trim().toLowerCase();
    if (firstCell === 'total' || firstCell === 'totals') continue;

    const raw: Partial<ZerodhaHoldingsRow> = {};

    for (let col = 0; col < colMap.length; col++) {
      const field = colMap[col];
      if (field === null) continue;
      const cellValue = (cells[col] ?? '').trim();

      if (numericFields.has(field)) {
        raw[field] = parseNumeric(cellValue, field, i);
      } else {
        (raw as Record<string, string>)[field] = cellValue;
      }
    }

    // Validate all required fields are populated
    const missing = (Object.keys(
      Object.fromEntries(REQUIRED_HEADERS.map((h) => [normaliseHeader(h), true]))
    ) as Array<keyof ZerodhaHoldingsRow>).filter(
      (k) => k !== null && raw[k] === undefined
    );

    if (missing.length > 0) {
      throw new Error(
        `Data row ${i + 1} is missing required fields: ${missing.join(', ')}`
      );
    }

    results.push(raw as ZerodhaHoldingsRow);
  }

  return results;
}

// ---------------------------------------------------------------------------
// CSV path (less common for holdings but supported)
// ---------------------------------------------------------------------------

function parseCsv(buffer: Buffer): ZerodhaHoldingsRow[] {
  const raw = stripBom(buffer.toString('utf-8'));

  const result = Papa.parse<string[]>(raw, {
    header: false,
    skipEmptyLines: false,
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
      'Could not locate the holdings header row. ' +
        `Expected columns: ${REQUIRED_HEADERS.join(', ')}`
    );
  }

  return buildRows(allRows[headerIdx], allRows.slice(headerIdx + 1));
}

// ---------------------------------------------------------------------------
// XLSX path (primary format for Zerodha holdings)
// ---------------------------------------------------------------------------

function parseXlsx(buffer: Buffer): ZerodhaHoldingsRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: true, cellDates: false });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('XLSX file contains no sheets');
  }

  const sheet = workbook.Sheets[firstSheetName];
  const allRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  });

  const stringRows: string[][] = allRows.map((row) =>
    (row as unknown[]).map((cell) => {
      if (cell === null || cell === undefined) return '';
      return String(cell);
    })
  );

  const headerIdx = findHeaderRowIndex(stringRows);
  if (headerIdx === -1) {
    throw new Error(
      'Could not locate the holdings header row in XLSX. ' +
        `Expected columns: ${REQUIRED_HEADERS.join(', ')}`
    );
  }

  return buildRows(stringRows[headerIdx], stringRows.slice(headerIdx + 1));
}

// ---------------------------------------------------------------------------
// File-type detection helper
// ---------------------------------------------------------------------------

function isXlsxBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HoldingsParseResult {
  rows: ZerodhaHoldingsRow[];
  metadata: ParseMetadata;
}

/**
 * Parse a Zerodha holdings file from a Buffer.
 *
 * Holdings are typically exported as XLSX; CSV is also accepted for
 * compatibility with manual exports.  File type is auto-detected from the
 * buffer's magic bytes, with the file extension used as a fallback.
 *
 * @param fileBuffer - Raw file bytes.
 * @param fileName   - Original filename used for error messages and format
 *                     detection fallback.
 */
export function parseHoldings(
  fileBuffer: Buffer,
  fileName: string
): HoldingsParseResult {
  if (fileBuffer.length === 0) {
    throw new Error(`File "${fileName}" is empty`);
  }

  const useXlsx =
    isXlsxBuffer(fileBuffer) ||
    fileName.toLowerCase().endsWith('.xlsx') ||
    fileName.toLowerCase().endsWith('.xls');

  const rows = useXlsx ? parseXlsx(fileBuffer) : parseCsv(fileBuffer);

  // Holdings snapshots do not carry a date column, so date_range is null
  return {
    rows,
    metadata: {
      row_count: rows.length,
      date_range: null,
      parser_version: PARSER_VERSION,
    },
  };
}
