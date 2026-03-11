/**
 * reconciliation.ts
 * Types for reconciliation runs and exception cases.
 * Reconciliation validates parsed data against broker-provided summaries
 * (e.g. contract note totals, closing holdings) before vouchers are exported.
 */

/**
 * Overall status of a reconciliation run.
 * - PENDING: scheduled but not yet started.
 * - RUNNING: actively executing checks.
 * - PASSED: all checks passed with no errors.
 * - FAILED: one or more ERROR-severity exceptions were raised.
 * - WARNING: run completed but WARNING-severity issues were found.
 */
export enum ReconciliationStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  WARNING = 'WARNING',
}

/**
 * Severity level of a reconciliation exception.
 * - ERROR: blocks export; must be resolved before proceeding.
 * - WARNING: export can proceed but the issue should be reviewed.
 * - INFO: informational observation, no action required.
 */
export enum ExceptionSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

/**
 * Categorised exception types raised during reconciliation.
 * Each type maps to a specific validation rule in the reconciliation engine.
 */
export enum ExceptionType {
  /** A trade exists in the tradebook but no matching contract note was found. */
  MISSING_CONTRACT_NOTE = 'MISSING_CONTRACT_NOTE',
  /** Computed closing holdings do not match the broker-provided holdings snapshot. */
  HOLDINGS_MISMATCH = 'HOLDINGS_MISMATCH',
  /** A corporate action (bonus, split, merger) was detected but is not yet handled. */
  UNSUPPORTED_CORPORATE_ACTION = 'UNSUPPORTED_CORPORATE_ACTION',
  /** An off-market transfer was detected that requires manual voucher entry. */
  OFF_MARKET_TRANSFER = 'OFF_MARKET_TRANSFER',
  /** An auction settlement event was found; requires special accounting treatment. */
  AUCTION_EVENT = 'AUCTION_EVENT',
  /** A charge type in the broker data does not map to any known EventType. */
  UNKNOWN_CHARGE = 'UNKNOWN_CHARGE',
  /** Computed quantity for a security went negative, indicating a data gap. */
  NEGATIVE_QUANTITY = 'NEGATIVE_QUANTITY',
  /** The import batch does not cover a complete period (missing leading/trailing dates). */
  INCOMPLETE_DATE_RANGE = 'INCOMPLETE_DATE_RANGE',
  /** Uploaded file schema does not match any supported parser version. */
  IMPORT_SCHEMA_MISMATCH = 'IMPORT_SCHEMA_MISMATCH',
  /** This date range or set of files appears to have been imported before. */
  DUPLICATE_IMPORT = 'DUPLICATE_IMPORT',
}

/**
 * Current resolution state of an exception case.
 * - OPEN: raised, not yet actioned.
 * - ACKNOWLEDGED: a user has seen and acknowledged the exception.
 * - RESOLVED: the underlying issue has been corrected.
 * - IGNORED: deliberately bypassed (e.g. known broker data quirk).
 */
export enum ResolutionStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  IGNORED = 'IGNORED',
}

/** Summary metrics produced at the end of a reconciliation run. */
export interface ReconciliationSummary {
  /** Whether total traded value matches between tradebook and contract notes. */
  trade_total_match: boolean;
  /** Whether total charges match between tradebook and contract notes. */
  charge_total_match: boolean;
  /** Whether computed closing holdings match the broker's holdings snapshot. */
  holdings_match: boolean;
  /** Number of mismatched values found across all checks. */
  mismatch_count: number;
  /** Number of warning-severity exceptions raised. */
  warning_count: number;
}

/**
 * A single execution of the reconciliation engine against an import batch.
 * One batch can have multiple runs (e.g. after re-uploads or manual corrections).
 */
export interface ReconciliationRun {
  reconciliation_run_id: string;
  import_batch_id: string;
  /** Overall outcome of this run. */
  run_status: ReconciliationStatus;
  /** Aggregated pass/fail metrics produced by the run. */
  summary: ReconciliationSummary;
  created_at: string;
}

/**
 * An individual exception raised during reconciliation.
 * Exceptions are the primary mechanism for surfacing data quality issues to users.
 * They must be resolved (or explicitly ignored) before the batch can be exported.
 */
export interface ExceptionCase {
  exception_case_id: string;
  import_batch_id: string;
  /** Categorised type of exception for filtering and routing. */
  exception_type: ExceptionType;
  /** How critical this exception is. ERROR blocks export; WARNING does not. */
  severity: ExceptionSeverity;
  /**
   * IDs of the source records (raw rows, canonical events, etc.)
   * that contributed to this exception.
   */
  source_refs: string[];
  /** Human-readable explanation of the exception suitable for display in the UI. */
  description: string;
  /** Current resolution state. */
  resolution_status: ResolutionStatus;
  /** User or team member assigned to resolve this exception. Null if unassigned. */
  assigned_to: string | null;
  /** Free-text note recorded when the exception was resolved or ignored. */
  resolution_note: string | null;
  created_at: string;
}
