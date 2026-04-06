export type AppBatchStatus =
    | 'uploading'
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'needs_review';

export type BatchFileStatus =
    | 'pending'
    | 'uploading'
    | 'uploaded'
    | 'failed'
    | 'processing'
    | 'processed';

export type BatchFileType =
    | 'tradebook'
    | 'funds_statement'
    | 'holdings'
    | 'contract_note'
    | 'taxpnl'
    | 'agts'
    | 'dividends'
    | 'unknown';

export type AppExceptionSeverity = 'error' | 'warning' | 'info';

export interface BatchFileMeta {
    id: string;
    batch_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    detected_type: BatchFileType;
    status: BatchFileStatus;
    content_hash: string | null;
    error_message: string | null;
    uploaded_at: string | null;
    created_at: string;
}

export interface BatchException {
    id: string;
    batch_id: string;
    code: string;
    severity: AppExceptionSeverity;
    message: string;
    source_refs: string[];
    created_at: string;
}

export interface ProcessingSummary {
    passed: number;
    warnings: number;
    failed: number;
    classification_summary?: {
        INVESTMENT: number;
        SPECULATIVE_BUSINESS: number;
        NON_SPECULATIVE_BUSINESS: number;
        PROFILE_DRIVEN: number;
        mtf_trades: number;
    };
}

export interface BatchProcessingResult {
    summary: ProcessingSummary;
    checks: Array<{
        check_name: string;
        status: 'PASSED' | 'FAILED' | 'WARNING';
        details: string;
    }>;
}

export interface BatchRecord {
    id: string;
    user_id: string;
    company_name: string;
    accounting_mode: 'investor' | 'trader';
    period_from: string;
    period_to: string;
    status: AppBatchStatus;
    status_message: string | null;
    file_count: number;
    voucher_count: number;
    created_at: string;
    updated_at: string;
    prior_batch_id?: string | null;
    fy_label?: string | null;
}

export interface BatchDetail extends BatchRecord {
    files: BatchFileMeta[];
    exceptions: BatchException[];
    processing_result: BatchProcessingResult | null;
}

export interface DashboardSummary {
    total_batches: number;
    total_vouchers: number;
    success_rate: number | null;
    open_exceptions: number;
}

export interface DashboardRecentBatchItem {
    id: string;
    company_name: string;
    period_from: string;
    period_to: string;
    status: AppBatchStatus;
    voucher_count: number;
    created_at: string;
    updated_at: string;
}

export interface DashboardResponse {
    summary: DashboardSummary;
    recent_batches: DashboardRecentBatchItem[];
}

export interface UploadBatchRequest {
    user_id: string;
    company_name: string;
    accounting_mode: 'investor' | 'trader';
    period_from: string;
    period_to: string;
    prior_batch_id?: string;
    fy_label?: string;
}

export interface UploadedFileSummary {
    id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    detected_type: BatchFileType;
}

export interface UploadBatchResponse {
    batch: BatchRecord;
    files: UploadedFileSummary[];
}

export interface ProcessBatchRequest {
    batch_id: string;
}

export interface ProcessBatchResponse {
    batch: BatchDetail;
}

export interface ExportBatchRequest {
    batch_id: string;
}

export interface ExportBatchResponse {
    batch_id: string;
    status: AppBatchStatus;
}

export type BatchListItem = BatchRecord;

export interface BatchListResponse {
    batches: BatchListItem[];
}

export interface BatchDetailResponse {
    batch: BatchDetail;
}

export type ExceptionListItem = BatchException;

export interface ExceptionListResponse {
    exceptions: ExceptionListItem[];
}

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------

export interface UserSettings {
    user_id: string;
    company_name: string;
    accounting_mode: 'INVESTOR' | 'TRADER';
    cost_basis_method: 'FIFO' | 'WEIGHTED_AVERAGE';
    charge_treatment: 'CAPITALIZE' | 'EXPENSE' | 'HYBRID';
    voucher_granularity: 'TRADE_LEVEL' | 'CONTRACT_NOTE_LEVEL' | 'DAILY_SUMMARY_BY_SCRIPT' | 'DAILY_SUMMARY_POOLED';
    ledger_strategy: 'SCRIPT_LEVEL' | 'POOLED';
    updated_at: string;
}
