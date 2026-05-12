/**
 * Pipeline trace bundle — used pre-GA to reproduce undesired Tally output
 * back to the originating file / parsed row / canonical event / voucher.
 *
 * This module is intentionally throwaway: when the platform reaches code
 * freeze the entire `src/lib/trace/` directory and the `/dev/trace/*` route
 * can be deleted in a single PR. No DB schema depends on it.
 *
 * Gate: `TRACE_PIPELINE=1`. When unset every recorder call is a no-op.
 */

export const TRACE_SCHEMA_VERSION = 1;

export interface TraceStage {
  name: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: Record<string, unknown>;
  diagnostics?: string[];
  data?: Record<string, unknown>;
}

export interface TraceFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  detectedType: string;
}

export interface TraceLineage {
  /** Map fileId -> event_ids that were derived from that file. */
  eventsByFile: Record<string, string[]>;
  /** Map event_id -> voucher_draft_id(s) that posted this event. */
  vouchersByEvent: Record<string, string[]>;
  /** Map external_reference (Tally VOUCHERNUMBER) -> voucher_draft_id. */
  voucherByExternalRef: Record<string, string>;
  /** Map ledger_name -> voucher_draft_id(s) that reference it. */
  voucherByLedger: Record<string, string[]>;
  /** Map stock_item_name -> voucher_draft_id(s) that reference it. */
  voucherByStockItem: Record<string, string[]>;
}

export interface TraceBundle {
  schemaVersion: typeof TRACE_SCHEMA_VERSION;
  batchId: string;
  capturedAt: string;
  inputs: {
    userId: string;
    companyName: string;
    accountingMode: 'investor' | 'trader';
    periodFrom: string;
    periodTo: string;
    priorBatchId?: string;
    classificationStrategy?: string;
    purchaseMergeMode?: string;
  };
  files: TraceFile[];
  stages: TraceStage[];
  outputs?: Record<string, unknown>;
  error?: { message: string; code?: string; stack?: string };
  lineage: TraceLineage;
  artifacts: {
    events?: unknown[];
    vouchers?: unknown[];
    ledgers?: unknown[];
    stockItems?: unknown[];
    mastersXml?: string;
    transactionsXml?: string;
    parsed?: Record<string, unknown>;
  };
}
