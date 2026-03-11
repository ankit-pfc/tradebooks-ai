/**
 * manifest.ts
 * Generates the import manifest JSON that accompanies every export package.
 *
 * The manifest is a portable, self-describing record of what was exported,
 * which accounting profile was used, and integrity checksums for each artifact
 * file.  It allows independent verification of an export package without
 * needing access to the TradeBooks AI database.
 */

import type { ImportManifest } from '../types/export';

// ---------------------------------------------------------------------------
// Public input type
// ---------------------------------------------------------------------------

export interface GenerateManifestParams {
  /** Full legal name of the broker account holder. */
  client_name: string;
  /** Name of the broker (e.g. "Zerodha"). */
  broker: string;
  /** Start of the reporting period covered by this export ("YYYY-MM-DD"). */
  period_from: string;
  /** End of the reporting period covered by this export ("YYYY-MM-DD"). */
  period_to: string;
  /** Human-readable name of the accounting profile used (e.g. "Retail Investor - FY2025"). */
  accounting_profile: string;
  /**
   * Semver string of the parser module that produced the canonical events
   * (e.g. "1.2.0").
   */
  parser_version: string;
  /**
   * Semver string of this exporter module (e.g. "1.0.0").
   * Bump when the XML format or manifest schema changes.
   */
  exporter_version: string;
  /**
   * Map of artifact filename → checksum hex string.
   * Keys should be the bare filenames included in artifact_files
   * (e.g. { "masters.xml": "abc123...", "transactions.xml": "def456..." }).
   */
  checksums: Record<string, string>;
  /**
   * Ordered list of artifact filenames included in this export package.
   * Convention: masters.xml first, then transactions.xml, then any reports.
   */
  artifact_files: string[];
  /** Number of Tally vouchers contained in the transactions XML. */
  voucher_count: number;
  /** Number of Tally ledger masters contained in the masters XML. */
  ledger_count: number;
  /**
   * ISO-8601 timestamp for when the manifest was generated.
   * Defaults to the current UTC time if omitted.
   */
  generated_at?: string;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Builds an ImportManifest object from the provided parameters.
 *
 * All string fields are trimmed; no validation of semver format or date
 * ranges is performed here — callers are expected to supply well-formed data.
 *
 * @param params  Manifest configuration.
 * @returns       A fully populated ImportManifest ready for JSON serialisation.
 *
 * @example
 * ```ts
 * const manifest = generateManifest({
 *   client_name: 'Ravi Kumar',
 *   broker: 'Zerodha',
 *   period_from: '2024-04-01',
 *   period_to: '2025-03-31',
 *   accounting_profile: 'Retail Investor - FY2025',
 *   parser_version: '1.2.0',
 *   exporter_version: '1.0.0',
 *   checksums: {
 *     'masters.xml': 'a1b2c3...',
 *     'transactions.xml': 'd4e5f6...',
 *   },
 *   artifact_files: ['masters.xml', 'transactions.xml', 'manifest.json'],
 *   voucher_count: 420,
 *   ledger_count: 18,
 * });
 * ```
 */
export function generateManifest(
  params: GenerateManifestParams,
): ImportManifest {
  const {
    client_name,
    broker,
    period_from,
    period_to,
    accounting_profile,
    parser_version,
    exporter_version,
    checksums,
    artifact_files,
    voucher_count,
    ledger_count,
    generated_at,
  } = params;

  return {
    client_name: client_name.trim(),
    broker: broker.trim(),
    period_from: period_from.trim(),
    period_to: period_to.trim(),
    accounting_profile: accounting_profile.trim(),
    parser_version: parser_version.trim(),
    exporter_version: exporter_version.trim(),
    checksums,
    generated_at: generated_at ?? new Date().toISOString(),
    artifact_files,
    voucher_count,
    ledger_count,
  };
}

// ---------------------------------------------------------------------------
// Serialisation helper
// ---------------------------------------------------------------------------

/**
 * Serialises an ImportManifest to a formatted JSON string.
 * Use this to write the manifest.json artifact to disk or include it as
 * in-memory file_content on an ExportArtifact record.
 */
export function serializeManifest(manifest: ImportManifest): string {
  return JSON.stringify(manifest, null, 2);
}
