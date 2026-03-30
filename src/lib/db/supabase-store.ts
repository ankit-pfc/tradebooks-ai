import type { DashboardResponse } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import type {
    BatchRepository,
    ExportArtifactPersistenceInput,
    SaveProcessingOutputInput,
    UploadedFilePersistenceInput,
} from '@/lib/db/repository';
import type {
    AppBatchStatus,
    BatchDetail,
    BatchException,
    BatchFileMeta,
    BatchFileStatus,
    BatchProcessingResult,
    BatchRecord,
    ExportArtifactRef,
} from '@/lib/types';
import type { CostLot } from '@/lib/types/events';

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour
const DASHBOARD_RECENT_LIMIT = 10;

/* -------------------------------------------------------------------------- */
/*  Row → domain type mappers                                                 */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBatchRecord(row: any): BatchRecord {
    return {
        id: row.id,
        user_id: row.user_id,
        company_name: row.company_name,
        accounting_mode: row.accounting_mode,
        period_from: row.period_from,
        period_to: row.period_to,
        status: row.status as AppBatchStatus,
        status_message: row.status_message ?? null,
        file_count: row.file_count,
        voucher_count: row.voucher_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToFileMeta(row: any): BatchFileMeta {
    return {
        id: row.id,
        batch_id: row.batch_id,
        file_name: row.file_name,
        mime_type: row.mime_type,
        size_bytes: row.size_bytes,
        detected_type: row.detected_type,
        status: (row.status ?? 'uploaded') as BatchFileStatus,
        content_hash: row.content_hash ?? null,
        error_message: row.error_message ?? null,
        uploaded_at: row.uploaded_at ?? null,
        created_at: row.created_at,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToException(row: any): BatchException {
    return {
        id: row.id,
        batch_id: row.batch_id,
        code: row.code,
        severity: row.severity,
        message: row.message,
        source_refs: row.source_refs ?? [],
        created_at: row.created_at,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToArtifact(row: any): ExportArtifactRef {
    return {
        id: row.id,
        batch_id: row.batch_id,
        artifact_type: row.artifact_type,
        file_name: row.file_name,
        mime_type: row.mime_type,
        created_at: row.created_at,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProcessingResult(row: any): BatchProcessingResult {
    return {
        summary: row.summary,
        checks: row.checks,
    };
}

/* -------------------------------------------------------------------------- */
/*  Supabase BatchRepository implementation                                   */
/* -------------------------------------------------------------------------- */

export const supabaseBatchRepository: BatchRepository = {
    async createBatch(input) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batches')
            .insert({
                user_id: input.user_id,
                company_name: input.company_name,
                accounting_mode: input.accounting_mode,
                period_from: input.period_from,
                period_to: input.period_to,
                prior_batch_id: input.prior_batch_id ?? null,
                fy_label: input.fy_label ?? null,
                status: 'uploading',
            })
            .select()
            .single();

        if (error) throw new Error(`createBatch failed: ${error.message}`);

        return {
            ...rowToBatchRecord(data),
            files: [],
            exceptions: [],
            exports: [],
            processing_result: null,
        };
    },

    async getBatch(batchId) {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from('batches')
            .select(
                '*, batch_files(*), batch_exceptions(*), batch_processing_results(*), export_artifacts(*)',
            )
            .eq('id', batchId)
            .single();

        if (error || !data) return null;

        const processingRow = data.batch_processing_results?.[0] ?? null;

        const detail: BatchDetail = {
            ...rowToBatchRecord(data),
            files: (data.batch_files ?? []).map(rowToFileMeta),
            exceptions: (data.batch_exceptions ?? []).map(rowToException),
            exports: (data.export_artifacts ?? []).map(rowToArtifact),
            processing_result: processingRow
                ? rowToProcessingResult(processingRow)
                : null,
        };
        return detail;
    },

    async listBatches() {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batches')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`listBatches failed: ${error.message}`);
        return (data ?? []).map(rowToBatchRecord);
    },

    async updateBatchStatus(batchId, status, statusMessage) {
        const supabase = await createClient();
        const { error } = await supabase
            .from('batches')
            .update({
                status,
                status_message: statusMessage,
                updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);

        if (error) throw new Error(`updateBatchStatus failed: ${error.message}`);
    },

    async addUploadedFiles(batchId, filesWithStoragePath) {
        const supabase = await createClient();
        const rows = filesWithStoragePath.map((f: UploadedFilePersistenceInput) => ({
            id: f.id,
            batch_id: batchId,
            file_name: f.file_name,
            mime_type: f.mime_type,
            size_bytes: f.size_bytes,
            detected_type: f.detected_type,
            storage_path: f.storage_path,
            status: f.status,
            content_hash: f.content_hash ?? null,
            error_message: f.error_message ?? null,
            uploaded_at: f.uploaded_at ?? null,
        }));

        const { error: insertError } = await supabase
            .from('batch_files')
            .insert(rows);
        if (insertError) throw new Error(`addUploadedFiles insert failed: ${insertError.message}`);

        // Update file_count on the parent batch
        const { count } = await supabase
            .from('batch_files')
            .select('*', { count: 'exact', head: true })
            .eq('batch_id', batchId);

        await supabase
            .from('batches')
            .update({
                file_count: count ?? 0,
                updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);
    },

    async resolveUploadedFilePath(batchId, fileId) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batch_files')
            .select('storage_path')
            .eq('id', fileId)
            .eq('batch_id', batchId)
            .single();

        if (error || !data) return null;

        return data.storage_path;
    },

    async saveProcessingOutput(input: SaveProcessingOutputInput) {
        const supabase = await createClient();

        // Insert processing result
        const { error: resultError } = await supabase
            .from('batch_processing_results')
            .insert({
                batch_id: input.batchId,
                summary: input.processingResult.summary,
                checks: input.processingResult.checks,
            });
        if (resultError) throw new Error(`saveProcessingOutput result failed: ${resultError.message}`);

        // Insert exceptions
        if (input.exceptions.length > 0) {
            const exceptionRows = input.exceptions.map((e) => ({
                batch_id: input.batchId,
                code: e.code,
                severity: e.severity,
                message: e.message,
                source_refs: e.source_refs,
            }));
            const { error: excError } = await supabase
                .from('batch_exceptions')
                .insert(exceptionRows);
            if (excError) throw new Error(`saveProcessingOutput exceptions failed: ${excError.message}`);
        }

        // Update batch status and voucher count
        const hasErrors = input.exceptions.some((e) => e.severity === 'error');
        await supabase
            .from('batches')
            .update({
                voucher_count: input.voucherCount,
                status: hasErrors ? 'needs_review' : 'succeeded',
                status_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', input.batchId);
    },

    async saveExportArtifacts(batchId, artifactsWithStoragePath) {
        const supabase = await createClient();
        const rows = artifactsWithStoragePath.map((a: ExportArtifactPersistenceInput) => ({
            id: a.id,
            batch_id: batchId,
            artifact_type: a.artifact_type,
            file_name: a.file_name,
            mime_type: a.mime_type,
            storage_path: a.storage_path,
        }));

        const { error } = await supabase
            .from('export_artifacts')
            .insert(rows);
        if (error) throw new Error(`saveExportArtifacts failed: ${error.message}`);

        await supabase
            .from('batches')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', batchId);
    },

    async resolveArtifactPath(batchId, artifactId) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('export_artifacts')
            .select('storage_path')
            .eq('id', artifactId)
            .eq('batch_id', batchId)
            .single();

        if (error || !data) return null;

        const { data: signedData } = await supabase.storage
            .from('uploads')
            .createSignedUrl(data.storage_path, SIGNED_URL_EXPIRY_SECONDS);

        return signedData?.signedUrl ?? null;
    },

    async listExceptions() {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batch_exceptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`listExceptions failed: ${error.message}`);
        return (data ?? []).map(rowToException);
    },

    async saveClosingLots(batchId: string, snapshot: Record<string, CostLot[]>) {
        const supabase = await createClient();
        const { error } = await supabase
            .from('batches')
            .update({
                closing_lots_snapshot: snapshot,
                updated_at: new Date().toISOString(),
            })
            .eq('id', batchId);

        if (error) throw new Error(`saveClosingLots failed: ${error.message}`);
    },

    async getClosingLots(batchId: string): Promise<Record<string, CostLot[]> | null> {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batches')
            .select('closing_lots_snapshot')
            .eq('id', batchId)
            .single();

        if (error || !data) return null;
        return data.closing_lots_snapshot as Record<string, CostLot[]> | null;
    },

    async listPriorBatches(userId: string, companyName: string): Promise<BatchRecord[]> {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batches')
            .select('*')
            .eq('user_id', userId)
            .eq('company_name', companyName)
            .eq('status', 'succeeded')
            .order('period_to', { ascending: false });

        if (error) throw new Error(`listPriorBatches failed: ${error.message}`);
        return (data ?? []).map(rowToBatchRecord);
    },

    async updateFileStatus(fileId, status, errorMessage) {
        const supabase = await createClient();
        const { error } = await supabase
            .from('batch_files')
            .update({
                status,
                error_message: errorMessage ?? null,
                ...(status === 'uploaded' ? { uploaded_at: new Date().toISOString() } : {}),
            })
            .eq('id', fileId);
        if (error) throw new Error(`updateFileStatus failed: ${error.message}`);
    },

    async getFilesByBatch(batchId) {
        const supabase = await createClient();
        const { data, error } = await supabase
            .from('batch_files')
            .select('*')
            .eq('batch_id', batchId)
            .order('created_at', { ascending: true });
        if (error) throw new Error(`getFilesByBatch failed: ${error.message}`);
        return (data ?? []).map(rowToFileMeta);
    },

    async deleteFile(batchId, fileId) {
        const supabase = await createClient();
        const { error } = await supabase
            .from('batch_files')
            .delete()
            .eq('id', fileId)
            .eq('batch_id', batchId);
        if (error) throw new Error(`deleteFile failed: ${error.message}`);
    },

    async findDuplicateFile(userId, contentHash) {
        const supabase = await createClient();
        // Join via batches to scope to this user's files
        const { data, error } = await supabase
            .from('batch_files')
            .select('batch_id, file_name, batches!inner(user_id)')
            .eq('content_hash', contentHash)
            .eq('batches.user_id', userId)
            .limit(1)
            .single();

        if (error || !data) return null;
        return { batchId: data.batch_id, fileName: data.file_name };
    },

    async buildDashboardSummary(): Promise<DashboardResponse> {
        const supabase = await createClient();

        const { data: batches, error: batchError } = await supabase
            .from('batches')
            .select('*')
            .order('created_at', { ascending: false });

        if (batchError) throw new Error(`buildDashboardSummary failed: ${batchError.message}`);

        const { count: openExceptions } = await supabase
            .from('batch_exceptions')
            .select('*', { count: 'exact', head: true });

        const allBatches = batches ?? [];
        const totalBatches = allBatches.length;
        const succeededBatches = allBatches.filter((b) => b.status === 'succeeded').length;
        const totalVouchers = allBatches.reduce(
            (sum: number, b: { voucher_count: number }) => sum + b.voucher_count,
            0,
        );

        const recentBatches = allBatches
            .slice(0, DASHBOARD_RECENT_LIMIT)
            .map((b) => ({
                id: b.id,
                company_name: b.company_name,
                period_from: b.period_from,
                period_to: b.period_to,
                status: b.status as AppBatchStatus,
                voucher_count: b.voucher_count,
                created_at: b.created_at,
                updated_at: b.updated_at,
            }));

        return {
            summary: {
                total_batches: totalBatches,
                total_vouchers: totalVouchers,
                success_rate: totalBatches > 0
                    ? (succeededBatches / totalBatches) * 100
                    : null,
                open_exceptions: openExceptions ?? 0,
            },
            recent_batches: recentBatches,
        };
    },
};
