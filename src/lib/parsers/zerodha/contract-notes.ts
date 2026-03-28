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

function findRowStartingWith(
  rows: string[][],
  prefix: string,
  startFrom = 0,
): number {
  const lowerPrefix = prefix.toLowerCase();
  for (let i = startFrom; i < rows.length; i++) {
    const firstCell = (rows[i][0] ?? '').trim().toLowerCase();
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

// Known segment markers in the trade section
const SEGMENT_MARKERS = new Set([
  'equity', 'f&o', 'currency', 'commodity', 'mutual funds',
]);

// ---------------------------------------------------------------------------
// Single sheet parser
// ---------------------------------------------------------------------------

interface SheetParseResult {
  trades: ZerodhaContractNoteTradeRow[];
  charges: ZerodhaContractNoteCharges | null;
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

  // Find the trade header row
  let tradeHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const firstCell = (rows[i][0] ?? '').trim().toLowerCase();
    if (firstCell === 'order no.' || firstCell === 'order no') {
      tradeHeaderIdx = i;
      break;
    }
  }

  const trades: ZerodhaContractNoteTradeRow[] = [];
  let currentSegment = '';

  if (tradeHeaderIdx >= 0) {
    // Parse trade rows after the header
    for (let i = tradeHeaderIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = (row[0] ?? '').trim();
      const firstCellLower = firstCell.toLowerCase();

      // Check if this is a segment marker
      if (SEGMENT_MARKERS.has(firstCellLower)) {
        currentSegment = firstCell;
        continue;
      }

      // Stop at the charges section
      if (firstCellLower.startsWith('pay in/pay out') ||
          firstCellLower.startsWith('net total') ||
          firstCellLower === '') {
        // Check if it's the charges section or just an empty row
        if (firstCellLower.startsWith('pay in/pay out')) break;
        // Empty row might separate segments or end trades
        // Look ahead for more trades vs charges section
        const nextNonEmpty = rows.slice(i + 1).findIndex(
          (r) => (r[0] ?? '').trim() !== '',
        );
        if (nextNonEmpty >= 0) {
          const nextCell = (rows[i + 1 + nextNonEmpty][0] ?? '').trim().toLowerCase();
          if (nextCell.startsWith('pay in') || nextCell.startsWith('ncl-')) {
            break;
          }
        }
        continue;
      }

      // Try to parse as a trade row — Order No should be numeric
      const orderNo = firstCell;
      if (!orderNo || !/^\d/.test(orderNo)) {
        // Not a trade row — might be "NCL-Cash" header or similar
        if (firstCellLower.startsWith('ncl-')) break;
        continue;
      }

      const buySell = (row[5] ?? '').trim().toUpperCase();
      if (buySell !== 'B' && buySell !== 'S') continue;

      trades.push({
        order_no: orderNo,
        order_time: (row[1] ?? '').trim(),
        trade_no: (row[2] ?? '').trim(),
        trade_time: (row[3] ?? '').trim(),
        security_description: (row[4] ?? '').trim(),
        buy_sell: buySell as 'B' | 'S',
        quantity: num((row[6] ?? '').trim()),
        exchange: (row[7] ?? '').trim(),
        gross_rate: num((row[8] ?? '').trim()),
        brokerage_per_unit: num((row[9] ?? '').trim()),
        net_rate: num((row[10] ?? '').trim()),
        net_total: num((row[12] ?? '').trim()),
        segment: currentSegment,
      });
    }
  }

  // Parse charges section
  let charges: ZerodhaContractNoteCharges | null = null;

  const payInRow = findRowStartingWith(rows, 'pay in/pay out');
  if (payInRow >= 0) {
    // Charges use the "NET TOTAL" column (col 10, 0-indexed)
    // or the NCL-Cash column (col 7, 0-indexed)
    // The net total column is consistently at col 10
    const getChargeVal = (prefix: string): string => {
      const idx = findRowStartingWith(rows, prefix, payInRow);
      if (idx < 0) return '0';
      // Try net total column first (col 10), then NCL-Cash (col 7)
      const v = extractCellValue(rows, idx, 10) || extractCellValue(rows, idx, 7);
      return num(v);
    };

    charges = {
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
    };
  }

  return { trades, charges };
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

  for (const sheetName of workbook.SheetNames) {
    const rows = toStringGrid(workbook.Sheets[sheetName]);
    const result = parseSheet(rows);
    allTrades.push(...result.trades);
    if (result.charges) {
      allCharges.push(result.charges);
      tradesPerSheet.push(result.trades.length);
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
    metadata: {
      row_count: allTrades.length,
      date_range: dates.length > 0
        ? { from: dates[0], to: dates[dates.length - 1] }
        : null,
      parser_version: PARSER_VERSION,
    },
  };
}
