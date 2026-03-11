import type { DashboardResponse } from '@/lib/types';
import {
    addBatchFiles,
    createBatch,
    getArtifactPath,
    getBatch,
    getUploadedFilePath,
    listBatches,
    listExceptions,
    saveExportArtifacts,
    saveProcessingOutcome,
    setBatchStatus,
    toPublicBatchDetail,
} from '@/lib/db/local-store';
import type {
    BatchRepository,
    SaveProcessingOutputInput,
} from '@/lib/db/repository';

const LOCAL_RECENT_BATCHES_LIMIT = 10;

const localBatchRepository: BatchRepository = {
    async createBatch(input) {
        const batch = await createBatch(input);
        return toPublicBatchDetail(batch);
    },

    async getBatch(batchId) {
        const batch = await getBatch(batchId);
        return batch ? toPublicBatchDetail(batch) : null;
    },

    async listBatches() {
        return listBatches();
    },

    async updateBatchStatus(batchId, status, statusMessage) {
        await setBatchStatus(batchId, status, statusMessage);
    },

    async addUploadedFiles(batchId, filesWithStoragePath) {
        await addBatchFiles(batchId, filesWithStoragePath);
    },

    async resolveUploadedFilePath(batchId, fileId) {
        return getUploadedFilePath(batchId, fileId);
    },

    async saveProcessingOutput(input: SaveProcessingOutputInput) {
        await saveProcessingOutcome(input);
    },

    async saveExportArtifacts(batchId, artifactsWithStoragePath) {
        await saveExportArtifacts(batchId, artifactsWithStoragePath);
    },

    async resolveArtifactPath(batchId, artifactId) {
        return getArtifactPath(batchId, artifactId);
    },

    async listExceptions() {
        return listExceptions();
    },

    async buildDashboardSummary(): Promise<DashboardResponse> {
        const batches = await listBatches();
        const exceptions = await listExceptions();

        const totalBatches = batches.length;
        const succeededBatches = batches.filter((b) => b.status === 'succeeded').length;
        const totalVouchers = batches.reduce((sum, b) => sum + b.voucher_count, 0);

        const recentBatches = [...batches]
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, LOCAL_RECENT_BATCHES_LIMIT)
            .map((batch) => ({
                id: batch.id,
                company_name: batch.company_name,
                period_from: batch.period_from,
                period_to: batch.period_to,
                status: batch.status,
                voucher_count: batch.voucher_count,
                created_at: batch.created_at,
                updated_at: batch.updated_at,
            }));

        return {
            summary: {
                total_batches: totalBatches,
                total_vouchers: totalVouchers,
                success_rate: totalBatches > 0 ? (succeededBatches / totalBatches) * 100 : null,
                open_exceptions: exceptions.length,
            },
            recent_batches: recentBatches,
        };
    },
};

/**
 * Composition boundary for repository selection.
 *
 * Default is local adapter for local-first development.
 * Future phases can branch this by env/config to return a Supabase adapter.
 */
export function getBatchRepository(): BatchRepository {
    return localBatchRepository;
}
