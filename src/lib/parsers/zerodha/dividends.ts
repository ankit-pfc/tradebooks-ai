/**
 * dividends.ts
 * Parser for standalone Zerodha dividends files (XLSX).
 *
 * These are separate from the Tax PNL dividend sheet. The standalone file has:
 *  - Data starts in column B
 *  - Rows 1-6: empty
 *  - Row 7-9: Client ID, Client Name, PAN
 *  - Row 11: title
 *  - Row 15 (approx): header row (Symbol, ISIN, Ex-Date, Quantity,
 *    Dividend Per Share, Net Dividend Amount)
 *  - Note: uses "Ex-Date" not "Date"
 *  - Total row at the end
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type { ZerodhaDividendRow, DividendsParseResult } from './types';

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

const DIVIDEND_HEADERS = ['Symbol', 'ISIN', 'Ex-Date', 'Quantity', 'Dividend Per Share', 'Net Dividend Amount'];
// Fallback for Tax PNL embedded dividends which use "Date" instead of "Ex-Date"
const DIVIDEND_HEADERS_ALT = ['Symbol', 'ISIN', 'Date', 'Quantity', 'Dividend Per Share', 'Net Dividend Amount'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseDividends(
  fileBuffer: Buffer,
  fileName: string,
): DividendsParseResult {
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

  // Find the dividends sheet
  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes('dividend'),
  ) ?? workbook.SheetNames[0];

  const rows = toStringGrid(workbook.Sheets[sheetName]);

  // Try both header variants
  let headerIdx = findHeaderRow(rows, DIVIDEND_HEADERS);
  let usesExDate = true;
  if (headerIdx === -1) {
    headerIdx = findHeaderRow(rows, DIVIDEND_HEADERS_ALT);
    usesExDate = false;
  }
  if (headerIdx === -1) {
    throw new Error(
      `Could not locate dividend header row in "${fileName}". ` +
      `Expected columns: ${DIVIDEND_HEADERS.join(', ')}`,
    );
  }

  const colMap = buildColMap(rows[headerIdx]);
  const dateCol = usesExDate ? 'ex-date' : 'date';
  const results: ZerodhaDividendRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;
    if (symbol.toLowerCase().includes('total')) continue;
    // Skip disclaimer/footer rows (sentences rather than stock symbols)
    if (symbol.length > 30) continue;

    results.push({
      symbol,
      isin: cell(row, colMap, 'isin'),
      ex_date: cell(row, colMap, dateCol),
      quantity: num(cell(row, colMap, 'quantity')),
      dividend_per_share: num(cell(row, colMap, 'dividend per share')),
      net_dividend_amount: num(cell(row, colMap, 'net dividend amount')),
    });
  }

  const dates = results.map((r) => r.ex_date).filter(Boolean).sort();

  return {
    rows: results,
    metadata: {
      row_count: results.length,
      date_range: dates.length > 0
        ? { from: dates[0], to: dates[dates.length - 1] }
        : null,
      parser_version: PARSER_VERSION,
    },
  };
}
