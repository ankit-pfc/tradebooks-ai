/**
 * detect.ts
 * Heuristics for identifying which type of Zerodha file was uploaded.
 *
 * Detection strategy (in priority order):
 *  1. Filename pattern matching — Zerodha uses predictable filename conventions.
 *  2. Column-header fingerprinting — scan the first ~20 rows for header labels
 *     that are unique to each report type.
 *  3. Return 'unknown' when neither strategy can reach a confident conclusion.
 *
 * The function never throws; it always returns one of the union members so
 * callers can branch cleanly without a try/catch.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type ZerodhaFileType =
  | 'tradebook'
  | 'funds_statement'
  | 'holdings'
  | 'contract_note'
  | 'taxpnl'
  | 'agts'
  | 'unknown';

// ---------------------------------------------------------------------------
// Header fingerprints
// Each entry lists headers that, when ALL present together, uniquely identify
// the file type.  The arrays are deliberately minimal to remain robust against
// Zerodha silently adding/removing columns in future exports.
// ---------------------------------------------------------------------------

const FINGERPRINTS: Array<{ type: ZerodhaFileType; headers: string[] }> = [
  {
    type: 'tradebook',
    headers: ['trade date', 'trade type', 'trade id', 'order id', 'order execution time'],
  },
  {
    type: 'funds_statement',
    headers: ['posting date', 'running balance', 'debit', 'credit'],
  },
  {
    type: 'holdings',
    // "qty." and "avg. cost" are distinctive — no other Zerodha report uses them
    headers: ['qty.', 'avg. cost', 'cur. val', 'ltp'],
  },
  {
    type: 'contract_note',
    // Contract notes typically include these columns; the set is conservative
    // because the format varies between equity and F&O notes.
    headers: ['trade no', 'order no', 'brokerage'],
  },
  {
    type: 'taxpnl',
    // "taxable profit" and "period of holding" are unique to the Tax P&L report
    headers: ['taxable profit', 'period of holding'],
  },
  {
    type: 'agts',
    // The combination of buy/sell quantity + value columns is unique to AGTS
    headers: ['buy quantity', 'buy value', 'sell quantity', 'sell value'],
  },
];

// ---------------------------------------------------------------------------
// Filename pattern matching
// ---------------------------------------------------------------------------

const FILENAME_PATTERNS: Array<{ type: ZerodhaFileType; pattern: RegExp }> = [
  { type: 'tradebook', pattern: /tradebook/i },
  { type: 'funds_statement', pattern: /fund[s_\s-]*statement/i },
  { type: 'holdings', pattern: /holding/i },
  { type: 'contract_note', pattern: /contract[_\s-]*note/i },
  { type: 'taxpnl', pattern: /tax[_\s-]*p[&]?n[&]?l/i },
  { type: 'agts', pattern: /agts/i },
];

function detectFromFilename(fileName: string): ZerodhaFileType | null {
  for (const { type, pattern } of FILENAME_PATTERNS) {
    if (pattern.test(fileName)) return type;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Buffer helpers
// ---------------------------------------------------------------------------

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

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
// Header extraction
// Reads at most MAX_SCAN_ROWS rows and returns a flat, deduplicated set of
// lowercase header-like cell values found across all of them.
// ---------------------------------------------------------------------------

const MAX_SCAN_ROWS = 20;

function extractHeaderCandidates(buffer: Buffer, isXlsx: boolean): Set<string> {
  const candidates = new Set<string>();

  try {
    if (isXlsx) {
      const workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellText: true,
        cellDates: false,
        sheetRows: MAX_SCAN_ROWS,
      });

      // Scan up to 3 sheets to catch multi-sheet files like taxpnl
      const sheetsToScan = workbook.SheetNames.slice(0, 3);
      for (const sheetName of sheetsToScan) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Also add sheet names as candidates (useful for taxpnl detection)
        candidates.add(sheetName.trim().toLowerCase());

        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          blankrows: false,
        });

        for (const row of rows) {
          for (const cell of row as unknown[]) {
            const str = String(cell ?? '').trim().toLowerCase();
            if (str) candidates.add(str);
          }
        }
      }
    } else {
      // CSV
      const text = stripBom(buffer.toString('utf-8'));
      // Only parse the first MAX_SCAN_ROWS lines for speed
      const firstLines = text.split('\n').slice(0, MAX_SCAN_ROWS).join('\n');

      const result = Papa.parse<string[]>(firstLines, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      for (const row of result.data as string[][]) {
        for (const cell of row) {
          const str = String(cell ?? '').trim().toLowerCase();
          if (str) candidates.add(str);
        }
      }
    }
  } catch {
    // Parsing failed — return whatever we gathered so far
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Fingerprint matching
// ---------------------------------------------------------------------------

function detectFromHeaders(candidates: Set<string>): ZerodhaFileType | null {
  for (const { type, headers } of FINGERPRINTS) {
    if (headers.every((h) => candidates.has(h))) return type;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect which type of Zerodha file was uploaded.
 *
 * The function first checks the filename for known patterns, then falls back
 * to scanning column headers inside the file content.  Returns `'unknown'`
 * when neither approach is conclusive.
 *
 * @param fileBuffer - Raw file bytes.
 * @param fileName   - Original filename as supplied by the uploader.
 */
export function detectFileType(
  fileBuffer: Buffer,
  fileName: string
): ZerodhaFileType {
  // 1. Fast path: filename pattern matching
  const fromFilename = detectFromFilename(fileName);
  if (fromFilename !== null) return fromFilename;

  // 2. Content-based detection
  if (fileBuffer.length === 0) return 'unknown';

  const isXlsx =
    isXlsxBuffer(fileBuffer) ||
    fileName.toLowerCase().endsWith('.xlsx') ||
    fileName.toLowerCase().endsWith('.xls');

  const candidates = extractHeaderCandidates(fileBuffer, isXlsx);
  const fromHeaders = detectFromHeaders(candidates);
  if (fromHeaders !== null) return fromHeaders;

  return 'unknown';
}
