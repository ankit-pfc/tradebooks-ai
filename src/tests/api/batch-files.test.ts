import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
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

// Use a small MAX_FILE_SIZE so we can trigger size errors with tiny test files
vi.mock('@/lib/upload-constants', () => ({
  MAX_FILE_SIZE: 100, // 100 bytes — lets us test the limit with small content
  ALLOWED_MIME_TYPES: new Set(['text/csv', 'application/octet-stream']),
}));

const mockStorage = {
  upload: vi.fn().mockResolvedValue('/storage/path/file-1'),
  download: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
};
vi.mock('@/lib/storage/file-storage', () => ({
  getFileStorage: () => mockStorage,
}));

vi.mock('@/lib/parsers/zerodha/detect', () => ({
  detectFileType: vi.fn().mockReturnValue('tradebook'),
}));

const { POST } = await import('@/app/api/batches/[batchId]/files/route');

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
  file_count: 0,
  voucher_count: 0,
  created_at: '2025-04-01T00:00:00Z',
  updated_at: '2025-04-01T00:00:00Z',
  files: [],
  exceptions: [],
  exports: [],
  processing_result: null,
};

function makeRequest(
  file: File | null,
  batchId = 'batch-1',
  extraHeaders: Record<string, string> = {},
) {
  const form = new FormData();
  if (file) form.append('file', file);

  return {
    request: new NextRequest(`http://localhost/api/batches/${batchId}/files`, {
      method: 'POST',
      body: form,
      headers: extraHeaders,
    }),
    params: Promise.resolve({ batchId }),
  };
}

function smallFile(name = 'tradebook.csv', content = 'a,b,c\n1,2,3') {
  return new File([content], name, { type: 'text/csv' });
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.getBatch.mockResolvedValue(UPLOADING_BATCH);
  repo.addUploadedFiles.mockResolvedValue(undefined);
  repo.findDuplicateFile.mockResolvedValue(null);
  mockStorage.upload.mockResolvedValue('/storage/path/file-1');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/batches/[batchId]/files', () => {
  it('returns 401 when not authenticated', async () => {
    const { getAuthenticatedUserId } = await import('@/lib/supabase/auth-guard');
    vi.mocked(getAuthenticatedUserId).mockResolvedValueOnce(null);

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when batch does not exist', async () => {
    repo.getBatch.mockResolvedValueOnce(null);

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('Batch not found');
  });

  it('returns 403 when batch belongs to a different user', async () => {
    repo.getBatch.mockResolvedValueOnce({ ...UPLOADING_BATCH, user_id: 'other-user' });

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    expect(res.status).toBe(403);
  });

  it('returns 409 when batch is not in uploading state', async () => {
    repo.getBatch.mockResolvedValueOnce({ ...UPLOADING_BATCH, status: 'running' });

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('uploading');
  });

  it('returns 400 when no file is provided', async () => {
    const { request, params } = makeRequest(null);
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('No file');
  });

  it('returns 400 when file exceeds size limit', async () => {
    // MAX_FILE_SIZE is mocked to 100 bytes; this file is larger
    const bigContent = 'x'.repeat(200);
    const { request, params } = makeRequest(new File([bigContent], 'large.csv', { type: 'text/csv' }));
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('size limit');
  });

  it('returns 400 when X-Content-Hash does not match computed hash', async () => {
    const { request, params } = makeRequest(smallFile(), 'batch-1', {
      'X-Content-Hash': 'definitely-not-the-real-hash',
    });
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('hash mismatch');
  });

  it('returns 201 with fileId, fileName, detectedType, sizeBytes, and status on success', async () => {
    const { request, params } = makeRequest(smallFile('tradebook.csv'));
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.fileId).toBeDefined();
    expect(body.fileName).toBe('tradebook.csv');
    expect(body.detectedType).toBe('tradebook');
    expect(typeof body.sizeBytes).toBe('number');
    expect(body.status).toBe('uploaded');
  });

  it('includes duplicateWarning when findDuplicateFile returns a match in another batch', async () => {
    repo.findDuplicateFile.mockResolvedValueOnce({
      batchId: 'other-batch',
      fileName: 'tradebook.csv',
    });

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.duplicateWarning).toEqual({ batchId: 'other-batch', fileName: 'tradebook.csv' });
  });

  it('does not include duplicateWarning when dup is in the same batch', async () => {
    repo.findDuplicateFile.mockResolvedValueOnce({
      batchId: 'batch-1', // same batch — not a cross-batch duplicate
      fileName: 'tradebook.csv',
    });

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.duplicateWarning).toBeUndefined();
  });

  it('returns 201 with status failed and errorMessage when storage upload throws', async () => {
    mockStorage.upload.mockRejectedValueOnce(new Error('Bucket quota exceeded'));

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.status).toBe('failed');
    expect(body.errorMessage).toBe('Bucket quota exceeded');
    // File metadata was still persisted
    expect(repo.addUploadedFiles).toHaveBeenCalledOnce();
  });

  it('returns 500 when the repository throws unexpectedly', async () => {
    repo.addUploadedFiles.mockRejectedValueOnce(new Error('DB error'));

    const { request, params } = makeRequest(smallFile());
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB error');
  });
});
