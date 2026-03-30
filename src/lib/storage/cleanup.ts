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
