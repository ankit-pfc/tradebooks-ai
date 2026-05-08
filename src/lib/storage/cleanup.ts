import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import type { BatchRepository } from '@/lib/db/repository';
import type { FileStorage } from '@/lib/storage/file-storage';

const DEFAULT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CleanupResult {
  cleaned: number;
  errors: string[];
}

/**
 * Marks batches stuck in `uploading` state for longer than `thresholdMs` as
 * `failed` and best-effort removes their storage files.
 */
export async function cleanupOrphanBatches(options?: {
  thresholdMs?: number;
  repo?: BatchRepository;
  storage?: FileStorage;
}): Promise<CleanupResult> {
  const thresholdMs = options?.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const repo = options?.repo ?? getBatchRepository();
  const storage = options?.storage ?? getFileStorage();

  const batches = await repo.listBatches();
  const now = Date.now();

  const staleBatches = batches.filter(
    (b) =>
      b.status === 'uploading' &&
      now - new Date(b.created_at).getTime() > thresholdMs,
  );

  let cleaned = 0;
  const errors: string[] = [];

  for (const batch of staleBatches) {
    try {
      const files = await repo.getFilesByBatch(batch.id);
      for (const file of files) {
        const storagePath = await repo.resolveUploadedFilePath(batch.id, file.id);
        if (storagePath) {
          await storage.delete(storagePath).catch(() => undefined);
        }
      }

      await repo.updateBatchStatus(batch.id, 'failed', 'Upload timed out after 24 hours');
      cleaned++;
    } catch (err) {
      errors.push(
        `Failed to clean batch ${batch.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { cleaned, errors };
}

export interface DeleteBatchUploadsResult {
  deleted: number;
  errors: string[];
}

/**
 * Best-effort deletes all uploaded source files for a batch from storage.
 * Intended to be called after a batch reaches `succeeded` so source CSV/XML
 * blobs (which have already been parsed into vouchers/ledgers) don't accumulate.
 *
 * Storage delete failures are recorded in `errors` but never thrown — the
 * caller's processing run must not be reported as failed because of cleanup.
 * The DB row in `batch_files` is preserved so historical metadata (filename,
 * hash, size) remains queryable; only the binary in object storage is removed.
 */
export async function deleteBatchUploads(
  batchId: string,
  options?: {
    repo?: BatchRepository;
    storage?: FileStorage;
  },
): Promise<DeleteBatchUploadsResult> {
  const repo = options?.repo ?? getBatchRepository();
  const storage = options?.storage ?? getFileStorage();

  const files = await repo.getFilesByBatch(batchId);
  let deleted = 0;
  const errors: string[] = [];

  for (const file of files) {
    const storagePath = await repo.resolveUploadedFilePath(batchId, file.id);
    if (!storagePath) continue;
    try {
      await storage.delete(storagePath);
      deleted++;
    } catch (err) {
      errors.push(
        `Failed to delete ${storagePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { deleted, errors };
}
