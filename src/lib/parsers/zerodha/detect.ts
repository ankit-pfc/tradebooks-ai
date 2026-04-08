/**
 * detect.ts
 * Heuristics for identifying which type of Zerodha file was uploaded.
 *
 * Detection strategy (in priority order):
 *  1. Filename pattern matching — Zerodha uses predictable filename conventions.
 *  2. Content fingerprinting — scan the first ~20 rows of up to 3 sheets for
 *     tokens (header cells, sheet names, title rows) that uniquely identify
 *     each file type. Each fingerprint is a predicate over the candidate set
 *     so it can combine exact matches, prefix matches, and substring matches
 *     as appropriate for that format.
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
  | 'pnl'
  | 'agts'
  | 'ledger'
  | 'dividends'
  | 'unknown';

// ---------------------------------------------------------------------------
// Candidate-set helpers
// Each helper returns true when the given token is present in the candidate
// set using a specific matching semantic.
// ---------------------------------------------------------------------------

/** Exact lowercase match, after trimming. */
function hasExact(candidates: Set<string>, token: string): boolean {
  return candidates.has(token);
}

/**
 * True when any candidate either equals `token` or starts with `token`
 * (e.g. `'trade no'` matches `'trade no.'`, `'trade no. (nse)'`).
 */
function hasPrefix(candidates: Set<string>, token: string): boolean {
  if (candidates.has(token)) return true;
  for (const c of candidates) {
    if (c.startsWith(token)) return true;
  }
  return false;
}

/** True when any candidate contains `token` as a substring. */
function hasSubstring(candidates: Set<string>, token: string): boolean {
  for (const c of candidates) {
    if (c.includes(token)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Fingerprints
// Each entry is a predicate function over the candidate set. The first entry
// whose predicate returns true wins, so order matters:
//   * Stricter fingerprints MUST appear before more permissive ones.
//   * taxpnl appears before pnl because taxpnl is a specific case of pnl.
// ---------------------------------------------------------------------------

const FINGERPRINTS: Array<{
  type: ZerodhaFileType;
  match: (candidates: Set<string>) => boolean;
}> = [
  {
    type: 'tradebook',
    match: (c) =>
      ['trade date', 'trade type', 'trade id', 'order id', 'order execution time'].every(
        (h) => hasExact(c, h),
      ),
  },
  {
    type: 'funds_statement',
    match: (c) =>
      ['posting date', 'running balance', 'debit', 'credit'].every((h) =>
        hasExact(c, h),
      ),
  },
  {
    type: 'holdings',
    match: (c) =>
      ['quantity available', 'average price', 'previous closing price'].every((h) =>
        hasExact(c, h),
      ),
  },
  {
    type: 'contract_note',
    // Zerodha contract notes have two independent signatures; either one is
    // sufficient:
    //
    //   A. Title row: every CN sheet starts with the merged title cell
    //      "CONTRACT NOTE CUM TAX INVOICE (Tax Invoice under Section 31 of
    //      GST Act)". This is unique to CN files across the entire Zerodha
    //      export catalogue.
    //
    //   B. Trade-table header row: contains columns whose headers start with
    //      "Trade No.", "Order No.", and "Brokerage per Unit". The FY 21-22
    //      format in particular uses trailing periods and qualifiers (e.g.
    //      "Brokerage per Unit (Rs)") which the previous exact-match
    //      fingerprint silently rejected — hence the prefix semantics.
    match: (c) => {
      if (hasSubstring(c, 'contract note cum tax invoice')) return true;
      const hasTradeNo = hasPrefix(c, 'trade no');
      const hasOrderNo = hasPrefix(c, 'order no');
      const hasBrokerage = hasPrefix(c, 'brokerage per unit') || hasExact(c, 'brokerage');
      return hasTradeNo && hasOrderNo && hasBrokerage;
    },
  },
  {
    type: 'taxpnl',
    // "taxable profit" and "period of holding" are unique to the Tax P&L report.
    // MUST be checked before `pnl` below because Tax P&L XLSX files also
    // contain "p&l statement" in their title row.
    match: (c) => ['taxable profit', 'period of holding'].every((h) => hasExact(c, h)),
  },
  {
    type: 'pnl',
    // Generic Zerodha P&L statement — not the Tax P&L report. Signatures:
    //   * Sheet named "Other Debits and Credits" (unique to the pnl format).
    //   * OR title row containing "p&l statement for" (the Zerodha P&L export
    //     title, e.g. "P&L Statement for Equity from 2021-04-01 to …").
    // This file is informational only — the pipeline skips it because every
    // value it carries is already derivable from the tradebook + tax P&L.
    match: (c) => hasExact(c, 'other debits and credits') || hasSubstring(c, 'p&l statement for'),
  },
  {
    type: 'agts',
    // The combination of buy/sell quantity + value columns is unique to AGTS.
    match: (c) =>
      ['buy quantity', 'buy value', 'sell quantity', 'sell value'].every((h) =>
        hasExact(c, h),
      ),
  },
];

// ---------------------------------------------------------------------------
// Filename pattern matching
// ---------------------------------------------------------------------------

// Order matters — more specific patterns come first so e.g. `taxpnl` wins
// over a bare `pnl` match. The `pnl` pattern is anchored to the start of the
// filename so `taxpnl-FC9134.xlsx` can never hit it.
const FILENAME_PATTERNS: Array<{ type: ZerodhaFileType; pattern: RegExp }> = [
  { type: 'tradebook', pattern: /tradebook/i },
  { type: 'funds_statement', pattern: /fund[s_\s-]*statement/i },
  { type: 'holdings', pattern: /holding/i },
  { type: 'contract_note', pattern: /contract[_\s-]*note/i },
  { type: 'taxpnl', pattern: /tax[_\s-]*p[&]?n[&]?l/i },
  { type: 'pnl', pattern: /^pnl[-_]/i },
  { type: 'agts', pattern: /agts/i },
  { type: 'ledger', pattern: /ledger/i },
  { type: 'dividends', pattern: /dividend/i },
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
// lowercase tokens (header cells, title cells, sheet names) found across all
// scanned rows and sheets.
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

      // Scan up to 3 sheets to catch multi-sheet files like taxpnl and the
      // FY 21-22 consolidated CN export (which has one sheet per trade date).
      const sheetsToScan = workbook.SheetNames.slice(0, 3);
      for (const sheetName of sheetsToScan) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        // Sheet names are useful candidates for taxpnl and the generic pnl
        // file (which has a distinctive "Other Debits and Credits" sheet).
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
  for (const { type, match } of FINGERPRINTS) {
    if (match(candidates)) return type;
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
 * to scanning column headers, title rows, and sheet names inside the file
 * content. Returns `'unknown'` when neither approach is conclusive.
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
