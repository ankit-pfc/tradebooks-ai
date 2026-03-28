import type {
    AppBatchStatus,
    BatchDetail,
    BatchException,
    BatchFileMeta,
    BatchProcessingResult,
    BatchRecord,
    DashboardResponse,
    ExportArtifactRef,
    UploadBatchRequest,
} from '@/lib/types';
import type { CostLot } from '@/lib/types/events';

/**
 * Input used to create a new batch record.
 *
 * Kept aligned with UI/API upload request contract so repository adapters
 * can be swapped without changing service-layer callsites.
 */
export type CreateBatchInput = UploadBatchRequest;

/**
 * Adapter-facing shape for persisting uploaded file metadata plus storage key.
 *
 * `storage_path` is intentionally repository-internal and not exposed through
 * API DTOs in domain.ts.
 */
export type UploadedFilePersistenceInput = BatchFileMeta & {
    storage_path: string;
};

/**
 * Adapter-facing shape for persisting exported artifact metadata plus storage key.
 */
export type ExportArtifactPersistenceInput = ExportArtifactRef & {
    storage_path: string;
};

export interface SaveProcessingOutputInput {
    batchId: string;
    voucherCount: number;
    processingResult: BatchProcessingResult;
    exceptions: BatchException[];
}

/**
 * Storage abstraction for batch/application persistence.
 *
 * Implementations:
 * - local file store (current)
 * - Supabase/Postgres + object storage (future)
 */
export interface BatchRepository {
    createBatch(input: CreateBatchInput): Promise<BatchDetail>;
    getBatch(batchId: string): Promise<BatchDetail | null>;
    listBatches(): Promise<BatchRecord[]>;
    updateBatchStatus(
        batchId: string,
        status: AppBatchStatus,
        statusMessage: string | null,
    ): Promise<void>;

    addUploadedFiles(
        batchId: string,
        filesWithStoragePath: UploadedFilePersistenceInput[],
    ): Promise<void>;
    resolveUploadedFilePath(batchId: string, fileId: string): Promise<string | null>;

    saveProcessingOutput(input: SaveProcessingOutputInput): Promise<void>;

    saveExportArtifacts(
        batchId: string,
        artifactsWithStoragePath: ExportArtifactPersistenceInput[],
    ): Promise<void>;
    resolveArtifactPath(batchId: string, artifactId: string): Promise<string | null>;

    listExceptions(): Promise<BatchException[]>;
    buildDashboardSummary(): Promise<DashboardResponse>;

    // Multi-FY cost lot persistence
    saveClosingLots(batchId: string, snapshot: Record<string, CostLot[]>): Promise<void>;
    getClosingLots(batchId: string): Promise<Record<string, CostLot[]> | null>;
    listPriorBatches(userId: string, companyName: string): Promise<BatchRecord[]>;
}
