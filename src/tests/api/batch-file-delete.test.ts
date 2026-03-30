import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockBatchRepo } from './_helpers';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
  getBatchRepository: () => repo,
}));

vi.mock('@/lib/supabase/auth-guard', () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue('test-user-id'),
}));

const mockStorage = {
  upload: vi.fn(),
  download: vi.fn(),
  delete: vi.fn().mockResolvedValue(undefined),
  getSignedUrl: vi.fn(),
};
vi.mock('@/lib/storage/file-storage', () => ({
  getFileStorage: () => mockStorage,
}));

const { DELETE } = await import('@/app/api/batches/[batchId]/files/[fileId]/route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UPLOADING_BATCH = {
  id: 'batch-1',
  user_id: 'test-user-id',
  company_name: 'Test Co',
  accounting_mode: 'investor' as const,
  period_from: '2025-04-01',
  period_to: '2026-03-31',
  status: 'uploading' as const,
  status_message: null,
  file_count: 1,
  voucher_count: 0,
  created_at: '2025-04-01T00:00:00Z',
  updated_at: '2025-04-01T00:00:00Z',
  files: [],
  exceptions: [],
  exports: [],
  processing_result: null,
};

const SAMPLE_FILE = {
  id: 'file-1',
  batch_id: 'batch-1',
  file_name: 'tradebook.csv',
  mime_type: 'text/csv',
  size_bytes: 1024,
  detected_type: 'tradebook' as const,
  status: 'uploaded' as const,
  content_hash: null,
  error_message: null,
  uploaded_at: '2025-04-01T00:00:00Z',
  created_at: '2025-04-01T00:00:00Z',
};

function makeParams(batchId = 'batch-1', fileId = 'file-1') {
  return {
    request: new Request(`http://localhost/api/batches/${batchId}/files/${fileId}`, {
      method: 'DELETE',
    }),
    params: Promise.resolve({ batchId, fileId }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.getBatch.mockResolvedValue(UPLOADING_BATCH);
  repo.getFilesByBatch.mockResolvedValue([SAMPLE_FILE]);
  repo.resolveUploadedFilePath.mockResolvedValue('/storage/path/file-1');
  repo.deleteFile.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DELETE /api/batches/[batchId]/files/[fileId]', () => {
  it('returns 401 when not authenticated', async () => {
    const { getAuthenticatedUserId } = await import('@/lib/supabase/auth-guard');
    vi.mocked(getAuthenticatedUserId).mockResolvedValueOnce(null);

    const { request, params } = makeParams();
    const res = await DELETE(request, { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when batch does not exist', async () => {
    repo.getBatch.mockResolvedValueOnce(null);

    const { request, params } = makeParams();
    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('Batch not found');
  });

  it('returns 403 when batch belongs to a different user', async () => {
    repo.getBatch.mockResolvedValueOnce({ ...UPLOADING_BATCH, user_id: 'other-user' });

    const { request, params } = makeParams();
    const res = await DELETE(request, { params });
    expect(res.status).toBe(403);
  });

  it('returns 409 when batch is not in uploading state', async () => {
    repo.getBatch.mockResolvedValueOnce({ ...UPLOADING_BATCH, status: 'running' });

    const { request, params } = makeParams();
    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('uploading');
  });

  it('returns 404 when file does not exist in the batch', async () => {
    repo.getFilesByBatch.mockResolvedValueOnce([]); // no files

    const { request, params } = makeParams('batch-1', 'nonexistent-file');
    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('File not found');
  });

  it('returns 204 on successful deletion', async () => {
    const { request, params } = makeParams();
    const res = await DELETE(request, { params });

    expect(res.status).toBe(204);
    expect(repo.deleteFile).toHaveBeenCalledWith('batch-1', 'file-1');
  });

  it('deletes the file from storage when storage path is available', async () => {
    const { request, params } = makeParams();
    await DELETE(request, { params });

    expect(mockStorage.delete).toHaveBeenCalledWith('/storage/path/file-1');
  });

  it('returns 204 even when storage.delete throws (best-effort)', async () => {
    mockStorage.delete.mockRejectedValueOnce(new Error('Storage unavailable'));

    const { request, params } = makeParams();
    const res = await DELETE(request, { params });

    expect(res.status).toBe(204);
    expect(repo.deleteFile).toHaveBeenCalledOnce();
  });

  it('returns 500 when repo.deleteFile throws unexpectedly', async () => {
    repo.deleteFile.mockRejectedValueOnce(new Error('DB error'));

    const { request, params } = makeParams();
    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });
});
