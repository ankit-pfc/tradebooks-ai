/**
 * broker.ts
 * Types for broker accounts, import batches, uploaded files, and raw row data.
 */

/** The type of legal entity that owns the broker account. */
export type AccountType = 'individual' | 'proprietorship' | 'company' | 'huf';

/** Parse/processing lifecycle status for an import batch. */
export type BatchStatus =
  | 'pending'
  | 'parsing'
  | 'processing'
  | 'reconciling'
  | 'ready'
  | 'exported'
  | 'failed';

/** Category of file detected during upload. */
export type DetectedFileType =
  | 'tradebook'
  | 'funds_statement'
  | 'holdings'
  | 'contract_note';

/** Parsing lifecycle status for an individual uploaded file. */
export type ParseStatus = 'pending' | 'parsing' | 'parsed' | 'failed';

/**
 * A broker account linked to a tenant, representing a single client-broker relationship.
 * One tenant may have multiple broker accounts (e.g. Zerodha equity + commodity).
 */
export interface BrokerAccount {
  broker_account_id: string;
  tenant_id: string;
  /** Display name of the broker (e.g. "Zerodha", "ICICI Direct"). */
  broker_name: string;
  /** Full legal name of the account holder. */
  client_name: string;
  /** Permanent Account Number of the account holder. */
  client_pan: string;
  /** Broker-assigned client code, e.g. Zerodha UCC. */
  zerodha_client_code: string | null;
  /** Legal entity type of the account holder. */
  account_type: AccountType;
}

/**
 * A batch of one or more uploaded files covering a specific date range
 * that will be parsed, processed, and exported together.
 */
export interface ImportBatch {
  import_batch_id: string;
  tenant_id: string;
  broker_account_id: string;
  /** Current lifecycle stage of the batch. */
  batch_status: BatchStatus;
  /** Inclusive start of the reporting period (ISO date string, e.g. "2024-04-01"). */
  date_from: string;
  /** Inclusive end of the reporting period (ISO date string). */
  date_to: string;
  /** Reference to the accounting profile used for this batch. */
  accounting_profile_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Metadata for a single file uploaded as part of an import batch.
 * One batch may contain multiple files (e.g. tradebook + contract notes).
 */
export interface UploadedFile {
  uploaded_file_id: string;
  import_batch_id: string;
  /** Original filename as provided by the user. */
  file_name: string;
  /** File category inferred by the parser. */
  detected_file_type: DetectedFileType | null;
  /** MIME type or extension declared by the uploader. */
  original_file_type: string | null;
  /** SHA-256 or similar checksum of the file contents for deduplication. */
  checksum: string;
  /** Semver string of the parser that processed this file. */
  parser_version: string | null;
  parse_status: ParseStatus;
  /** Version string identifying the broker's export format (e.g. "zerodha-tradebook-v2"). */
  source_format_version: string | null;
  /** Number of data rows successfully read from the file. */
  row_count: number | null;
  created_at: string;
}

/**
 * A single row read from an uploaded broker file, stored in both raw and parsed form.
 * Enables auditability and re-parsing without re-uploading the original file.
 */
export interface RawBrokerRow {
  raw_row_id: string;
  uploaded_file_id: string;
  /** 1-based row number within the source file. */
  row_number: number;
  /** Original key-value pairs exactly as read from the file headers. */
  raw_payload: Record<string, string>;
  /** Structured object produced by the parser for this row. Type varies by file category. */
  parsed_payload: unknown;
  /**
   * Parser confidence score for this row (0 = unrecognised, 1 = fully matched).
   * Rows below a threshold may be flagged for manual review.
   */
  parse_confidence: number;
}
