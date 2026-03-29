/**
 * ledger.ts
 * Parser for Zerodha ledger files (XLSX).
 *
 * File structure (Equity sheet):
 *  - Data starts in column B
 *  - Rows 1-6: empty
 *  - Row 7: Client ID
 *  - Row 11: title ("Ledger for Equity from YYYY-MM-DD to YYYY-MM-DD")
 *  - Row 15 (approx): header row (Particulars, Posting Date, Cost Center,
 *    Voucher Type, Debit, Credit, Net Balance)
 *  - Row 16: Opening Balance row
 *  - Data rows follow
 */

import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';
import type { ZerodhaLedgerRow, LedgerParseResult } from './types';

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

const LEDGER_HEADERS = [
  'Particulars',
  'Posting Date',
  'Cost Center',
  'Voucher Type',
  'Debit',
  'Credit',
  'Net Balance',
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseLedger(
  fileBuffer: Buffer,
  fileName: string,
): LedgerParseResult {
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

  // Find a sheet that has ledger headers (usually "Equity")
  let targetSheet: string | undefined;
  let allRows: string[][] = [];
  let headerIdx = -1;

  for (const sn of workbook.SheetNames) {
    const rows = toStringGrid(workbook.Sheets[sn]);
    const idx = findHeaderRow(rows, LEDGER_HEADERS);
    if (idx !== -1) {
      targetSheet = sn;
      allRows = rows;
      headerIdx = idx;
      break;
    }
  }

  if (!targetSheet || headerIdx === -1) {
    throw new Error(
      `Could not locate ledger header row in "${fileName}". ` +
      `Expected columns: ${LEDGER_HEADERS.join(', ')}`,
    );
  }

  const colMap = buildColMap(allRows[headerIdx]);
  const results: ZerodhaLedgerRow[] = [];
  let openingBalance = '0';

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (isEmptyRow(row)) continue;

    const particulars = cell(row, colMap, 'particulars');
    if (!particulars) continue;

    // Opening Balance is a special row
    if (particulars.toLowerCase() === 'opening balance') {
      openingBalance = num(cell(row, colMap, 'net balance'));
      continue;
    }

    // Skip closing/total rows
    if (particulars.toLowerCase().includes('closing balance')) continue;

    const postingDate = cell(row, colMap, 'posting date');
    // Rows without a posting date are not real entries
    if (!postingDate) continue;

    results.push({
      particulars,
      posting_date: postingDate,
      cost_center: cell(row, colMap, 'cost center'),
      voucher_type: cell(row, colMap, 'voucher type'),
      debit: num(cell(row, colMap, 'debit')),
      credit: num(cell(row, colMap, 'credit')),
      net_balance: num(cell(row, colMap, 'net balance')),
    });
  }

  // Derive date range
  const dates = results.map((r) => r.posting_date).filter(Boolean).sort();
  const dateRange = dates.length > 0
    ? { from: dates[0], to: dates[dates.length - 1] }
    : null;

  return {
    rows: results,
    opening_balance: openingBalance,
    metadata: {
      row_count: results.length,
      date_range: dateRange,
      parser_version: PARSER_VERSION,
    },
  };
}
