/**
 * holdings.ts
 * Parser for Zerodha holdings files (XLSX).
 *
 * Zerodha Console holdings exports are multi-sheet XLSX files:
 *  - Equity: per-stock holdings with quantity breakdowns
 *  - Mutual Funds: MF holdings
 *  - Combined: merged view (not parsed — redundant)
 *
 * File structure:
 *  - Data starts in column B
 *  - Rows 1-6: empty
 *  - Row 7: Client ID
 *  - Row 11: title ("Equity Holdings Statement as on YYYY-MM-DD")
 *  - Rows 13-18: summary block (Invested Value, Present Value, etc.)
 *  - Row 23 (approx): header row
 *  - Data rows follow
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type {
  ZerodhaHoldingsRow,
  ZerodhaMFHoldingsRow,
  HoldingsParseResult,
} from './types';

export const PARSER_VERSION = '1.1.0';

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
  const cleaned = value.replace(/,/g, '').replace(/%$/, '').trim();
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
// Equity sheet parser
// ---------------------------------------------------------------------------

const EQUITY_HEADERS = [
  'Symbol',
  'ISIN',
  'Quantity Available',
  'Average Price',
  'Previous Closing Price',
  'Unrealized P&L',
];

function parseEquitySheet(workbook: XLSX.WorkBook): ZerodhaHoldingsRow[] {
  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase() === 'equity',
  );
  if (!sheetName) return [];

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  const headerIdx = findHeaderRow(rows, EQUITY_HEADERS);
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaHoldingsRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;
    if (symbol.toLowerCase().startsWith('total')) continue;

    results.push({
      symbol,
      isin: cell(row, colMap, 'isin'),
      sector: cell(row, colMap, 'sector'),
      quantity_available: num(cell(row, colMap, 'quantity available')),
      quantity_discrepant: num(cell(row, colMap, 'quantity discrepant')),
      quantity_long_term: num(cell(row, colMap, 'quantity long term')),
      quantity_pledged_margin: num(cell(row, colMap, 'quantity pledged (margin)')),
      quantity_pledged_loan: num(cell(row, colMap, 'quantity pledged (loan)')),
      average_price: num(cell(row, colMap, 'average price')),
      previous_closing_price: num(cell(row, colMap, 'previous closing price')),
      unrealized_pnl: num(cell(row, colMap, 'unrealized p&l')),
      unrealized_pnl_pct: num(
        cell(row, colMap, 'unrealized p&l pct.') ||
        cell(row, colMap, 'unrealize p&l pct.'),
      ),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Mutual Funds sheet parser
// ---------------------------------------------------------------------------

const MF_HEADERS = [
  'Symbol',
  'ISIN',
  'Instrument Type',
  'Quantity Available',
  'Average Price',
];

function parseMFSheet(workbook: XLSX.WorkBook): ZerodhaMFHoldingsRow[] {
  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase() === 'mutual funds',
  );
  if (!sheetName) return [];

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  const headerIdx = findHeaderRow(rows, MF_HEADERS);
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaMFHoldingsRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;
    if (symbol.toLowerCase().startsWith('total')) continue;

    results.push({
      symbol,
      isin: cell(row, colMap, 'isin'),
      instrument_type: cell(row, colMap, 'instrument type'),
      quantity_available: num(cell(row, colMap, 'quantity available')),
      quantity_discrepant: num(cell(row, colMap, 'quantity discrepant')),
      quantity_pledged_margin: num(cell(row, colMap, 'quantity pledged (margin)')),
      quantity_pledged_loan: num(cell(row, colMap, 'quantity pledged (loan)')),
      average_price: num(cell(row, colMap, 'average price')),
      previous_closing_price: num(cell(row, colMap, 'previous closing price')),
      unrealized_pnl: num(cell(row, colMap, 'unrealized p&l')),
      unrealized_pnl_pct: num(
        cell(row, colMap, 'unrealized p&l pct.') ||
        cell(row, colMap, 'unrealize p&l pct.'),
      ),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Statement date extraction
// ---------------------------------------------------------------------------

function extractStatementDate(workbook: XLSX.WorkBook): string | null {
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return null;

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    for (const val of rows[i]) {
      const match = val.match(/as on (\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseHoldings(
  fileBuffer: Buffer,
  fileName: string,
): HoldingsParseResult {
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

  const equity = parseEquitySheet(workbook);
  const mutual_funds = parseMFSheet(workbook);
  const statementDate = extractStatementDate(workbook);

  return {
    equity,
    mutual_funds,
    metadata: {
      row_count: equity.length + mutual_funds.length,
      date_range: statementDate
        ? { from: statementDate, to: statementDate }
        : null,
      parser_version: PARSER_VERSION,
    },
  };
}
