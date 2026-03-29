/**
 * agts.ts
 * Parser for Zerodha Aggregate Trade Summary (AGTS) files (XLSX).
 *
 * AGTS files contain per-symbol aggregate buy/sell quantities and values.
 * Sheets: Equity, Mutual Funds, F&O, Currency, Commodity.
 *
 * All sheets share the Zerodha metadata pattern:
 *  - Rows 1-6: empty
 *  - Rows 7-9: Client ID, Client Name, PAN
 *  - Header row followed by data rows
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type {
  ZerodhaAgtsRow,
  AgtsParseResult,
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
    })
  );
}

function findHeaderRow(rows: string[][], headers: string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase());
    if (headers.every((h) => cells.includes(h.toLowerCase()))) return i;
  }
  return -1;
}

function buildColMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = headerRow[i].trim().toLowerCase();
    if (key) map.set(key, i);
  }
  return map;
}

function cell(row: string[], colMap: Map<string, number>, name: string): string {
  const idx = colMap.get(name.toLowerCase());
  if (idx === undefined) return '';
  return (row[idx] ?? '').trim();
}

function num(value: string): string {
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return '0';
  try {
    const d = new Decimal(cleaned);
    if (!d.isFinite()) return '0';
    return cleaned;
  } catch {
    return '0';
  }
}

function isEmptyRow(row: string[]): boolean {
  return row.every((c) => c.trim() === '');
}

// ---------------------------------------------------------------------------
// Sheet parser
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = ['Symbol', 'Exchange', 'Segment', 'Buy Quantity', 'Buy Value', 'Sell Quantity', 'Sell Value'];

function parseSheet(sheet: XLSX.WorkSheet): ZerodhaAgtsRow[] {
  const rows = toStringGrid(sheet);
  const headerIdx = findHeaderRow(rows, REQUIRED_HEADERS);
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaAgtsRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;

    results.push({
      symbol,
      exchange: cell(row, colMap, 'exchange'),
      segment: cell(row, colMap, 'segment'),
      buy_quantity: num(cell(row, colMap, 'buy quantity')),
      buy_value: num(cell(row, colMap, 'buy value')),
      sell_quantity: num(cell(row, colMap, 'sell quantity')),
      sell_value: num(cell(row, colMap, 'sell value')),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Zerodha AGTS (Aggregate Trade Summary) XLSX file.
 * Currently parses the "Equity" sheet; other asset class sheets are skipped for V1.
 *
 * @param fileBuffer - Raw file bytes (must be XLSX).
 * @param fileName   - Original filename (used for error messages).
 */
export function parseAgts(
  fileBuffer: Buffer,
  fileName: string,
): AgtsParseResult {
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

  // Parse all sheets that have the expected headers
  const allRows: ZerodhaAgtsRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (sheet) {
      allRows.push(...parseSheet(sheet));
    }
  }

  return {
    rows: allRows,
    metadata: {
      row_count: allRows.length,
      date_range: null, // AGTS has no date information
      parser_version: PARSER_VERSION,
    },
  };
}
