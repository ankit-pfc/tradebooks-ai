/**
 * export.ts
 * Types for export artifacts, Tally import executions, and the import manifest.
 * Covers both file-based exports and direct localhost push to Tally.
 */

/**
 * Category of artifact produced during the export step.
 * - MASTERS_XML: Tally XML containing ledger and stock item master definitions.
 * - TRANSACTIONS_XML: Tally XML containing voucher entries.
 * - RECONCILIATION_JSON: Machine-readable reconciliation report.
 * - RECONCILIATION_PDF: Human-readable PDF reconciliation report.
 * - IMPORT_MANIFEST: JSON manifest describing the full export package.
 */
export enum ArtifactType {
  MASTERS_XML = 'MASTERS_XML',
  TRANSACTIONS_XML = 'TRANSACTIONS_XML',
  RECONCILIATION_JSON = 'RECONCILIATION_JSON',
  RECONCILIATION_PDF = 'RECONCILIATION_PDF',
  IMPORT_MANIFEST = 'IMPORT_MANIFEST',
}

/**
 * Delivery method for getting artifacts into Tally.
 * - FILE_EXPORT: artifacts are written to disk; user imports them manually in Tally.
 * - LOCALHOST_PUSH: artifacts are pushed directly to Tally via its localhost HTTP server.
 */
export enum ImportMode {
  FILE_EXPORT = 'FILE_EXPORT',
  LOCALHOST_PUSH = 'LOCALHOST_PUSH',
}

/**
 * Outcome status of a Tally import execution attempt.
 * - PENDING: execution queued but not yet started.
 * - IN_PROGRESS: currently sending data to Tally.
 * - SUCCESS: all vouchers/masters imported successfully.
 * - PARTIAL: some records succeeded, some failed (check error_count).
 * - FAILED: import could not be completed (e.g. Tally unreachable, XML rejected).
 */
export enum ImportStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SUCCESS = 'SUCCESS',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED',
}

/**
 * A single generated artifact file (or in-memory content) associated with an import batch.
 * Multiple artifacts may be produced per batch (e.g. masters XML + transactions XML + PDF).
 */
export interface ExportArtifact {
  export_artifact_id: string;
  import_batch_id: string;
  /** Type of content this artifact contains. */
  artifact_type: ArtifactType;
  /** Absolute or relative file path on the server where the artifact is stored. Null for in-memory artifacts. */
  file_path: string | null;
  /**
   * Raw file content as a string (used for small in-memory artifacts like JSON manifests).
   * Null when the artifact is stored on disk (see file_path).
   */
  file_content: string | null;
  /** Checksum of the artifact content for integrity verification. */
  checksum: string;
  created_at: string;
}

/**
 * Records a single attempt to import one or more artifacts into a Tally company.
 * Each execution tracks success/error counts and the raw response from Tally.
 */
export interface ImportExecution {
  import_execution_id: string;
  import_batch_id: string;
  /** Exact company name in Tally that the data was imported into. */
  tally_company_name: string;
  /** Delivery method used for this execution. */
  import_mode: ImportMode;
  /** Outcome of the import attempt. */
  import_status: ImportStatus;
  /**
   * Raw XML or JSON response body returned by Tally, stored for debugging.
   * Null for FILE_EXPORT mode (no live Tally response).
   */
  tally_response_raw: string | null;
  /** Number of vouchers / masters successfully imported. */
  success_count: number;
  /** Number of vouchers / masters that failed to import. */
  error_count: number;
  created_at: string;
}

/**
 * A portable, human- and machine-readable summary of an export package.
 * Included as IMPORT_MANIFEST in every export; allows independent verification
 * of the export contents without access to the TradeBooks AI database.
 */
export interface ImportManifest {
  /** Full legal name of the broker account holder. */
  client_name: string;
  /** Name of the broker (e.g. "Zerodha"). */
  broker: string;
  /** Start of the reporting period covered by this export ("YYYY-MM-DD"). */
  period_from: string;
  /** End of the reporting period covered by this export ("YYYY-MM-DD"). */
  period_to: string;
  /** Name of the accounting profile used to generate this export. */
  accounting_profile: string;
  /** Semver string of the parser that processed the source files. */
  parser_version: string;
  /** Semver string of the exporter that generated the Tally XML. */
  exporter_version: string;
  /**
   * Map of artifact filename to its checksum.
   * Key: filename (e.g. "masters.xml"), Value: checksum hex string.
   */
  checksums: Record<string, string>;
  /** ISO-8601 timestamp when this manifest was generated. */
  generated_at: string;
  /** List of artifact filenames included in this export package. */
  artifact_files: string[];
  /** Number of Tally vouchers contained in the transactions XML artifact. */
  voucher_count: number;
  /** Number of Tally ledger masters contained in the masters XML artifact. */
  ledger_count: number;
}
