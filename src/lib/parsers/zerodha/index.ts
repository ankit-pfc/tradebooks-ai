/**
 * index.ts
 * Public surface of the Zerodha parser module.
 *
 * Usage
 * -----
 *   import { parseZerodhaFile } from '@/lib/parsers/zerodha';
 *
 *   const result = parseZerodhaFile(buffer, 'tradebook-2024.csv');
 *   // result.type === 'tradebook'
 *   // result.data.rows  — ZerodhaTradebookRow[]
 *   // result.data.metadata — ParseMetadata
 *
 * Or import a specific parser directly:
 *
 *   import { parseTradebook } from '@/lib/parsers/zerodha';
 */

// ---------------------------------------------------------------------------
// Re-export types
// ---------------------------------------------------------------------------

export type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaHoldingsRow,
  ParseMetadata,
} from './types';

// ---------------------------------------------------------------------------
// Re-export individual parsers
// ---------------------------------------------------------------------------

export { parseTradebook } from './tradebook';
export type { TradebookParseResult } from './tradebook';

export { parseFundsStatement } from './funds-statement';
export type { FundsStatementParseResult } from './funds-statement';

export { parseHoldings } from './holdings';
export type { HoldingsParseResult } from './holdings';

// ---------------------------------------------------------------------------
// Re-export file-type detector
// ---------------------------------------------------------------------------

export { detectFileType } from './detect';
export type { ZerodhaFileType } from './detect';

// ---------------------------------------------------------------------------
// Unified result type
// ---------------------------------------------------------------------------

import type { TradebookParseResult } from './tradebook';
import type { FundsStatementParseResult } from './funds-statement';
import type { HoldingsParseResult } from './holdings';

/**
 * Discriminated union returned by `parseZerodhaFile`.
 * The `type` field tells callers which parser ran; `data` carries the typed
 * result for that parser.
 */
export type ZerodhaParseResult =
  | { type: 'tradebook'; data: TradebookParseResult }
  | { type: 'funds_statement'; data: FundsStatementParseResult }
  | { type: 'holdings'; data: HoldingsParseResult };

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

import { detectFileType } from './detect';
import { parseTradebook } from './tradebook';
import { parseFundsStatement } from './funds-statement';
import { parseHoldings } from './holdings';

/**
 * Auto-detect the type of a Zerodha file and route it to the correct parser.
 *
 * Throws if:
 *  - The file is empty.
 *  - The file type cannot be determined (use `detectFileType` separately and
 *    call the individual parsers if you need finer-grained control).
 *  - Contract notes are detected — parsing is not yet implemented.
 *  - The underlying parser encounters a malformed file.
 *
 * @param fileBuffer - Raw file bytes.
 * @param fileName   - Original filename as supplied by the uploader.
 *                     Used for format detection and error messages.
 */
export function parseZerodhaFile(
  fileBuffer: Buffer,
  fileName: string
): ZerodhaParseResult {
  if (fileBuffer.length === 0) {
    throw new Error(`File "${fileName}" is empty`);
  }

  const fileType = detectFileType(fileBuffer, fileName);

  switch (fileType) {
    case 'tradebook':
      return { type: 'tradebook', data: parseTradebook(fileBuffer, fileName) };

    case 'funds_statement':
      return {
        type: 'funds_statement',
        data: parseFundsStatement(fileBuffer, fileName),
      };

    case 'holdings':
      return { type: 'holdings', data: parseHoldings(fileBuffer, fileName) };

    case 'contract_note':
      throw new Error(
        `Contract note parsing is not yet implemented. ` +
          `File "${fileName}" was detected as a contract note.`
      );

    case 'unknown':
      throw new Error(
        `Unable to determine the file type for "${fileName}". ` +
          `Ensure the file is a valid Zerodha tradebook, funds statement, ` +
          `holdings export, or contract note.`
      );
  }
}
