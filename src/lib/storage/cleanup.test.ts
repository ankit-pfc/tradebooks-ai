import { describe, it, expect, vi } from 'vitest';
import type { BatchRepository } from '@/lib/db/repository';
import type { FileStorage } from '@/lib/storage/file-storage';
import { cleanupOrphanBatches } from './cleanup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRepo(): { [K in keyof BatchRepository]: ReturnType<typeof vi.fn> } {
  return {
    createBatch: vi.fn(),
    getBatch: vi.fn(),
    listBatches: vi.fn().mockResolvedValue([]),
    updateBatchStatus: vi.fn().mockResolvedValue(undefined),
    addUploadedFiles: vi.fn(),
    resolveUploadedFilePath: vi.fn().mockResolvedValue(null),
    saveProcessingOutput: vi.fn(),
    listExceptions: vi.fn(),
    buildDashboardSummary: vi.fn(),
    saveClosingLots: vi.fn(),
    getClosingLots: vi.fn(),
    listPriorBatches: vi.fn(),
    updateFileStatus: vi.fn(),
    getFilesByBatch: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn(),
    findDuplicateFile: vi.fn(),
  };
}

function makeStorage(): { [K in keyof FileStorage]: ReturnType<typeof vi.fn> } {
  return {
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn(),
  };
}

const STALE_TS = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25h ago
const FRESH_TS = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();  //  1h ago

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1',
    user_id: 'user-1',
    company_name: 'Test Co',
    accounting_mode: 'investor' as const,
    period_from: '2025-04-01',
    period_to: '2026-03-31',
    status: 'uploading' as const,
    status_message: null,
    file_count: 0,
    voucher_count: 0,
    created_at: STALE_TS,
    updated_at: STALE_TS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cleanupOrphanBatches', () => {
  it('returns cleaned=0 and no errors when no batches exist', async () => {
    const result = await cleanupOrphanBatches({ repo: makeRepo(), storage: makeStorage() });
    expect(result).toEqual({ cleaned: 0, errors: [] });
  });

  it('skips batches not in uploading state', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([
      makeBatch({ id: 'b1', status: 'succeeded' }),
      makeBatch({ id: 'b2', status: 'failed' }),
      makeBatch({ id: 'b3', status: 'running' }),
    ]);

    const result = await cleanupOrphanBatches({ repo, storage: makeStorage() });

    expect(result.cleaned).toBe(0);
    expect(repo.updateBatchStatus).not.toHaveBeenCalled();
  });

  it('skips uploading batches younger than the threshold', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([makeBatch({ created_at: FRESH_TS })]);

    const result = await cleanupOrphanBatches({ repo, storage: makeStorage() });

    expect(result.cleaned).toBe(0);
    expect(repo.updateBatchStatus).not.toHaveBeenCalled();
  });

  it('marks a stale uploading batch as failed with timeout message', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([makeBatch()]);

    const result = await cleanupOrphanBatches({ repo, storage: makeStorage() });

    expect(result.cleaned).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(repo.updateBatchStatus).toHaveBeenCalledWith(
      'batch-1',
      'failed',
      'Upload timed out after 24 hours',
    );
  });

  it('deletes uploaded files from storage before marking the batch failed', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([makeBatch()]);
    repo.getFilesByBatch.mockResolvedValue([{ id: 'file-1' }]);
    repo.resolveUploadedFilePath.mockResolvedValue('/storage/path/file-1');
    const storage = makeStorage();

    await cleanupOrphanBatches({ repo, storage });

    expect(storage.delete).toHaveBeenCalledWith('/storage/path/file-1');
  });

  it('skips storage delete when resolveUploadedFilePath returns null', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([makeBatch()]);
    repo.getFilesByBatch.mockResolvedValue([{ id: 'file-1' }]);
    repo.resolveUploadedFilePath.mockResolvedValue(null);
    const storage = makeStorage();

    await cleanupOrphanBatches({ repo, storage });

    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.updateBatchStatus).toHaveBeenCalledOnce();
  });

  it('swallows storage.delete errors and still marks the batch failed', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([makeBatch()]);
    repo.getFilesByBatch.mockResolvedValue([{ id: 'file-1' }]);
    repo.resolveUploadedFilePath.mockResolvedValue('/storage/path/file-1');
    const storage = makeStorage();
    storage.delete.mockRejectedValue(new Error('S3 unavailable'));

    const result = await cleanupOrphanBatches({ repo, storage });

    expect(result.cleaned).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(repo.updateBatchStatus).toHaveBeenCalledOnce();
  });

  it('records an error and does not increment cleaned when updateBatchStatus throws', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([makeBatch()]);
    repo.updateBatchStatus.mockRejectedValue(new Error('DB write failed'));

    const result = await cleanupOrphanBatches({ repo, storage: makeStorage() });

    expect(result.cleaned).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('batch-1');
    expect(result.errors[0]).toContain('DB write failed');
  });

  it('respects a custom thresholdMs', async () => {
    const repo = makeRepo();
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    repo.listBatches.mockResolvedValue([makeBatch({ created_at: twoHoursAgo })]);

    // 2h-old batch is NOT stale under the default 24h threshold
    const resultDefault = await cleanupOrphanBatches({ repo, storage: makeStorage() });
    expect(resultDefault.cleaned).toBe(0);

    // But IS stale under a 1h threshold
    const resultCustom = await cleanupOrphanBatches({
      repo,
      storage: makeStorage(),
      thresholdMs: 60 * 60 * 1000,
    });
    expect(resultCustom.cleaned).toBe(1);
  });

  it('processes multiple stale batches and returns the correct count', async () => {
    const repo = makeRepo();
    repo.listBatches.mockResolvedValue([
      makeBatch({ id: 'b1' }),
      makeBatch({ id: 'b2' }),
      makeBatch({ id: 'b3', status: 'succeeded' }), // skipped
    ]);

    const result = await cleanupOrphanBatches({ repo, storage: makeStorage() });

    expect(result.cleaned).toBe(2);
    expect(repo.updateBatchStatus).toHaveBeenCalledTimes(2);
  });
});
