import type { DashboardResponse } from '@/lib/types';
import {
    addBatchFiles,
    createBatch,
    deleteFile as localDeleteFile,
    findDuplicateFile as localFindDuplicateFile,
    getBatch,
    getClosingLots as localGetClosingLots,
    getFilesByBatch as localGetFilesByBatch,
    getUploadedFilePath,
    listBatches,
    listExceptions,
    listPriorBatches as localListPriorBatches,
    saveClosingLots as localSaveClosingLots,
    saveProcessingOutcome,
    setBatchStatus,
    toPublicBatchDetail,
    updateFileStatus as localUpdateFileStatus,
} from '@/lib/db/local-store';
import type {
    BatchRepository,
    SaveProcessingOutputInput,
} from '@/lib/db/repository';
import { supabaseBatchRepository } from '@/lib/db/supabase-store';
import type { SettingsRepository } from '@/lib/db/settings-repository';
import {
    localSettingsRepository,
    supabaseSettingsRepository,
} from '@/lib/db/settings-repository';
import type { LedgerRepository } from '@/lib/db/ledger-repository';
import {
    localLedgerRepository,
    supabaseLedgerRepository,
} from '@/lib/db/ledger-repository';

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

    async listExceptions() {
        return listExceptions();
    },

    async saveClosingLots(batchId, snapshot) {
        await localSaveClosingLots(batchId, snapshot);
    },

    async getClosingLots(batchId) {
        return localGetClosingLots(batchId);
    },

    async listPriorBatches(userId, companyName) {
        return localListPriorBatches(userId, companyName);
    },

    async updateFileStatus(fileId, status, errorMessage) {
        await localUpdateFileStatus(fileId, status, errorMessage);
    },

    async getFilesByBatch(batchId) {
        return localGetFilesByBatch(batchId);
    },

    async deleteFile(batchId, fileId) {
        await localDeleteFile(batchId, fileId);
    },

    async findDuplicateFile(userId, contentHash) {
        return localFindDuplicateFile(userId, contentHash);
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
 * Returns the Supabase adapter when NEXT_PUBLIC_SUPABASE_URL is set,
 * otherwise falls back to the local file-based adapter.
 */
export function getBatchRepository(): BatchRepository {
    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return supabaseBatchRepository;
    }
    return localBatchRepository;
}

export function getSettingsRepository(): SettingsRepository {
    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return supabaseSettingsRepository;
    }
    return localSettingsRepository;
}

export function getLedgerRepository(): LedgerRepository {
    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return supabaseLedgerRepository;
    }
    return localLedgerRepository;
}
