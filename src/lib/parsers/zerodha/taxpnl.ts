/**
 * taxpnl.ts
 * Parser for Zerodha Tax P&L files (XLSX).
 *
 * Zerodha Tax P&L reports are multi-sheet XLSX files containing:
 *  - Tradewise Exits (all closed trades with P&L)
 *  - Equity / MF / F&O / Currency / Commodity summaries
 *  - Other Debits and Credits (DP charges, etc.)
 *  - Open Positions (start and end of period)
 *  - Equity Dividends
 *  - Ledger Balances
 *
 * All sheets share a common structure:
 *  - Rows 1-6: empty
 *  - Rows 7-9: Client ID, Client Name, PAN
 *  - Variable gap then a header row followed by data rows
 *  - Some sheets contain sub-sections with their own headers
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type {
  ZerodhaTaxPnlExitRow,
  ZerodhaTaxPnlChargeRow,
  ZerodhaTaxPnlDividendRow,
  ZerodhaTaxPnlEquitySummaryRow,
  TaxPnlParseResult,
} from './types';

export const PARSER_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert all cells to strings for uniform treatment. */
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

/**
 * Find the row index where ALL specified headers appear (case-insensitive).
 * Returns -1 if not found.
 */
function findHeaderRow(rows: string[][], headers: string[]): number {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase());
    if (headers.every((h) => cells.includes(h.toLowerCase()))) return i;
  }
  return -1;
}

/** Build a column index map from a header row. */
function buildColMap(headerRow: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = headerRow[i].trim().toLowerCase();
    if (key) map.set(key, i);
  }
  return map;
}

/** Get cell value by column name, returns empty string if missing. */
function cell(row: string[], colMap: Map<string, number>, name: string): string {
  const idx = colMap.get(name.toLowerCase());
  if (idx === undefined) return '';
  return (row[idx] ?? '').trim();
}

/** Validate and clean a numeric string. Returns '0' for empty values. */
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

/**
 * Normalise date: handles ISO strings, DD/MM/YYYY, and Excel serial numbers.
 * Excel serial numbers are days since 1900-01-01 (with the Lotus 1-2-3 bug
 * where 1900-02-29 is incorrectly counted).
 */
function normDate(value: string): string {
  if (!value) return '';
  // If it looks like an ISO date already, strip time part
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  // Try DD/MM/YYYY or DD-MM-YYYY
  const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  // Excel serial number (a pure integer or float, typically 40000-50000 range)
  const serial = parseFloat(value);
  if (!isNaN(serial) && serial > 30000 && serial < 60000) {
    // Convert Excel serial to JS Date
    // Excel epoch is 1900-01-01, but it incorrectly counts 1900-02-29
    // so we subtract 2 days from the base
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + serial * 86400000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return value;
}

/** Check if a row is effectively empty. */
function isEmptyRow(row: string[]): boolean {
  return row.every((c) => c.trim() === '');
}

// ---------------------------------------------------------------------------
// Sheet parsers
// ---------------------------------------------------------------------------

function parseExits(workbook: XLSX.WorkBook): ZerodhaTaxPnlExitRow[] {
  // Find the "Tradewise Exits" sheet (name starts with "Tradewise")
  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().startsWith('tradewise')
  );
  if (!sheetName) return [];

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  const headerIdx = findHeaderRow(rows, ['Symbol', 'Entry Date', 'Exit Date', 'Buy Value', 'Sell Value', 'Profit']);
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaTaxPnlExitRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    // Stop at sub-section headers (e.g. "Mutual Funds", "F&O", etc.)
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;
    // Sub-section titles are in the symbol column but have no ISIN
    const isin = cell(row, colMap, 'isin');
    // If symbol looks like a section header (no isin and no numeric data), skip
    if (!isin && !cell(row, colMap, 'quantity')) {
      // Could be a section divider like "Mutual Funds" — skip it
      continue;
    }

    results.push({
      symbol,
      isin,
      entry_date: normDate(cell(row, colMap, 'entry date')),
      exit_date: normDate(cell(row, colMap, 'exit date')),
      quantity: num(cell(row, colMap, 'quantity')),
      buy_value: num(cell(row, colMap, 'buy value')),
      sell_value: num(cell(row, colMap, 'sell value')),
      profit: num(cell(row, colMap, 'profit')),
      period_of_holding: cell(row, colMap, 'period of holding') || '0',
      fair_market_value: num(cell(row, colMap, 'fair market value')),
      taxable_profit: num(cell(row, colMap, 'taxable profit')),
      turnover: num(cell(row, colMap, 'turnover')),
    });
  }

  return results;
}

function parseCharges(workbook: XLSX.WorkBook): ZerodhaTaxPnlChargeRow[] {
  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes('other debit')
  );
  if (!sheetName) return [];

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  const headerIdx = findHeaderRow(rows, ['Particulars', 'Posting Date', 'Debit', 'Credit']);
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaTaxPnlChargeRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const particulars = cell(row, colMap, 'particulars');
    if (!particulars || particulars.toLowerCase() === 'particulars') continue;
    // Skip sub-section headers (e.g. "Equity", "F&O", "Commodity")
    const debit = cell(row, colMap, 'debit');
    const credit = cell(row, colMap, 'credit');
    if (!debit && !credit) continue;

    results.push({
      particulars,
      posting_date: normDate(cell(row, colMap, 'posting date')),
      debit: num(debit),
      credit: num(credit),
    });
  }

  return results;
}

function parseDividends(workbook: XLSX.WorkBook): ZerodhaTaxPnlDividendRow[] {
  const sheetName = workbook.SheetNames.find((n) =>
    n.toLowerCase().includes('dividend')
  );
  if (!sheetName) return [];

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  // Try "Date" header first, fall back to "Ex-Date" (standalone dividends file)
  let headerIdx = findHeaderRow(rows, ['Symbol', 'Date', 'Quantity', 'Dividend Per Share']);
  let dateColName = 'date';
  if (headerIdx === -1) {
    headerIdx = findHeaderRow(rows, ['Symbol', 'Ex-Date', 'Quantity', 'Dividend Per Share']);
    dateColName = 'ex-date';
  }
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaTaxPnlDividendRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;
    // Skip total rows
    if (symbol.toLowerCase().includes('total')) continue;

    results.push({
      symbol,
      isin: cell(row, colMap, 'isin'),
      date: normDate(cell(row, colMap, dateColName)),
      quantity: num(cell(row, colMap, 'quantity')),
      dividend_per_share: num(cell(row, colMap, 'dividend per share')),
      net_dividend_amount: num(cell(row, colMap, 'net dividend amount')),
    });
  }

  return results;
}

function parseEquitySummary(workbook: XLSX.WorkBook): ZerodhaTaxPnlEquitySummaryRow[] {
  // The "Equity" sheet (or "Equity and Non Equity" in FY2122) has a simple structure
  const sheetName = workbook.SheetNames.find((n) => {
    const lower = n.toLowerCase();
    return lower === 'equity' || lower.startsWith('equity and non');
  });
  if (!sheetName) return [];

  const rows = toStringGrid(workbook.Sheets[sheetName]);
  const headerIdx = findHeaderRow(rows, ['Symbol', 'Quantity', 'Buy Value', 'Sell Value']);
  if (headerIdx === -1) return [];

  const colMap = buildColMap(rows[headerIdx]);
  const results: ZerodhaTaxPnlEquitySummaryRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isEmptyRow(row)) continue;

    const symbol = cell(row, colMap, 'symbol');
    if (!symbol || symbol.toLowerCase() === 'symbol') continue;

    results.push({
      symbol,
      quantity: num(cell(row, colMap, 'quantity')),
      buy_value: num(cell(row, colMap, 'buy value')),
      sell_value: num(cell(row, colMap, 'sell value')),
      realized_pnl: num(cell(row, colMap, 'realized p&l')),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Date range derivation
// ---------------------------------------------------------------------------

function deriveDateRange(
  exits: ZerodhaTaxPnlExitRow[],
  charges: ZerodhaTaxPnlChargeRow[],
): { from: string; to: string } | null {
  const dates: string[] = [];
  for (const e of exits) {
    if (e.entry_date) dates.push(e.entry_date);
    if (e.exit_date) dates.push(e.exit_date);
  }
  for (const c of charges) {
    if (c.posting_date) dates.push(c.posting_date);
  }
  if (dates.length === 0) return null;
  const sorted = [...dates].sort();
  return { from: sorted[0], to: sorted[sorted.length - 1] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Zerodha Tax P&L XLSX file.
 *
 * @param fileBuffer - Raw file bytes (must be XLSX).
 * @param fileName   - Original filename (used for error messages).
 */
export function parseTaxPnl(
  fileBuffer: Buffer,
  fileName: string,
): TaxPnlParseResult {
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

  const exits = parseExits(workbook);
  const charges = parseCharges(workbook);
  const dividends = parseDividends(workbook);
  const equity_summary = parseEquitySummary(workbook);

  const totalRows = exits.length + charges.length + dividends.length + equity_summary.length;

  return {
    exits,
    charges,
    dividends,
    equity_summary,
    metadata: {
      row_count: totalRows,
      date_range: deriveDateRange(exits, charges),
      parser_version: PARSER_VERSION,
    },
  };
}
