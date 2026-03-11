/**
 * funds-statement.ts
 * Parser for Zerodha funds-statement files (CSV or XLSX).
 *
 * Zerodha quirks handled:
 *  - UTF-8 BOM at the start of CSV exports
 *  - One or more metadata / summary rows before the actual header row
 *  - Trailing empty rows and summary/total rows after the last data row
 *  - Optional "Instrument" column (not present in all export variants)
 *  - Numeric values formatted with commas (e.g. "1,23,456.78")
 *  - Debit / Credit cells that may be empty strings (treated as "0")
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type { ZerodhaFundsStatementRow, ParseMetadata } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PARSER_VERSION = '1.0.0';

/**
 * Headers that MUST be present in the header row for a file to be recognised
 * as a Zerodha funds statement.
 */
const REQUIRED_HEADERS = [
  'Posting Date',
  'Segment',
  'Description',
  'Debit',
  'Credit',
  'Running Balance',
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Normalise a raw header label to the snake_case field name used in
 * ZerodhaFundsStatementRow.  Returns null for unrecognised / extra headers.
 */
function normaliseHeader(raw: string): keyof ZerodhaFundsStatementRow | null {
  const map: Record<string, keyof ZerodhaFundsStatementRow> = {
    'posting date': 'posting_date',
    segment: 'segment',
    description: 'description',
    debit: 'debit',
    credit: 'credit',
    'running balance': 'running_balance',
    instrument: 'instrument',
  };
  return map[raw.trim().toLowerCase()] ?? null;
}

/**
 * Validate and normalise a numeric string.
 * Empty or whitespace-only values are treated as "0".
 */
function parseNumeric(value: string, fieldName: string, rowIndex: number): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '-') return '0';
  const cleaned = trimmed.replace(/,/g, '');
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

/**
 * Find the index of the header row by scanning for a row that contains all
 * required column labels.  Returns -1 if not found.
 */
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase());
    const hasAll = REQUIRED_HEADERS.every((h) =>
      cells.includes(h.toLowerCase())
    );
    if (hasAll) return i;
  }
  return -1;
}

/**
 * Convert normalised 2-D grid into typed ZerodhaFundsStatementRow objects.
 * Rows that look like totals/summaries (where posting_date is blank and
 * description contains "total" or "opening balance") are skipped so they
 * don't pollute the result set.
 */
function buildRows(
  headerRow: string[],
  dataRows: string[][]
): ZerodhaFundsStatementRow[] {
  const colMap: Array<keyof ZerodhaFundsStatementRow | null> =
    headerRow.map(normaliseHeader);

  const hasInstrumentCol = colMap.includes('instrument');

  const results: ZerodhaFundsStatementRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];

    // Skip completely empty rows
    if (cells.every((c) => c.trim() === '')) continue;

    const raw: Partial<ZerodhaFundsStatementRow> = {};

    for (let col = 0; col < colMap.length; col++) {
      const field = colMap[col];
      if (field === null) continue;
      const cellValue = (cells[col] ?? '').trim();

      if (field === 'debit' || field === 'credit' || field === 'running_balance') {
        raw[field] = parseNumeric(cellValue, field, i);
      } else if (field === 'instrument') {
        raw.instrument = cellValue === '' ? null : cellValue;
      } else {
        (raw as Record<string, string>)[field] = cellValue;
      }
    }

    // If instrument column doesn't exist in this file, default to null
    if (!hasInstrumentCol) {
      raw.instrument = null;
    }

    // Skip summary / total rows (posting_date is blank but other fields exist)
    const pd = (raw.posting_date ?? '').trim();
    const desc = (raw.description ?? '').trim().toLowerCase();
    if (pd === '' && (desc.includes('total') || desc.includes('opening balance') || desc === '')) {
      continue;
    }

    // Validate required string fields are present
    const requiredStringFields: Array<keyof ZerodhaFundsStatementRow> = [
      'posting_date',
      'segment',
      'description',
      'debit',
      'credit',
      'running_balance',
    ];
    const missing = requiredStringFields.filter((k) => raw[k] === undefined);
    if (missing.length > 0) {
      throw new Error(
        `Data row ${i + 1} is missing required fields: ${missing.join(', ')}`
      );
    }

    results.push(raw as ZerodhaFundsStatementRow);
  }

  return results;
}

/** Derive date_range from posting_date values. */
function deriveDateRange(
  rows: ZerodhaFundsStatementRow[]
): { from: string; to: string } | null {
  if (rows.length === 0) return null;
  const dates = rows.map((r) => r.posting_date).filter(Boolean);
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------
// CSV path
// ---------------------------------------------------------------------------

function parseCsv(buffer: Buffer): ZerodhaFundsStatementRow[] {
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
      'Could not locate the funds-statement header row. ' +
        `Expected columns: ${REQUIRED_HEADERS.join(', ')}`
    );
  }

  return buildRows(allRows[headerIdx], allRows.slice(headerIdx + 1));
}

// ---------------------------------------------------------------------------
// XLSX path
// ---------------------------------------------------------------------------

function parseXlsx(buffer: Buffer): ZerodhaFundsStatementRow[] {
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
      'Could not locate the funds-statement header row in XLSX. ' +
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

export interface FundsStatementParseResult {
  rows: ZerodhaFundsStatementRow[];
  metadata: ParseMetadata;
}

/**
 * Parse a Zerodha funds-statement file from a Buffer.
 *
 * Auto-detects CSV vs XLSX from magic bytes; falls back to the file extension
 * when the content is ambiguous.
 *
 * @param fileBuffer - Raw file bytes.
 * @param fileName   - Original filename used for error messages and fallback
 *                     format detection.
 */
export function parseFundsStatement(
  fileBuffer: Buffer,
  fileName: string
): FundsStatementParseResult {
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
