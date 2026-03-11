export type AppBatchStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'needs_review';

export type BatchFileType =
    | 'tradebook'
    | 'funds_statement'
    | 'holdings'
    | 'contract_note'
    | 'unknown';

export type AppExceptionSeverity = 'error' | 'warning' | 'info';

export interface BatchFileMeta {
    id: string;
    batch_id: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    detected_type: BatchFileType;
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
}

export interface BatchProcessingResult {
    summary: ProcessingSummary;
    checks: Array<{
        check_name: string;
        status: 'PASSED' | 'FAILED' | 'WARNING';
        details: string;
    }>;
}

export interface ExportArtifactRef {
    id: string;
    batch_id: string;
    artifact_type: 'masters_xml' | 'transactions_xml' | 'reconciliation_json';
    file_name: string;
    mime_type: string;
    created_at: string;
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
}

export interface BatchDetail extends BatchRecord {
    files: BatchFileMeta[];
    exceptions: BatchException[];
    exports: ExportArtifactRef[];
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
    artifacts: ExportArtifactRef[];
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
