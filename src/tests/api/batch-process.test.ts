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

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true, remaining: 9, reset: Date.now() + 3600000 }),
}));

const mockStorage = {
  upload: vi.fn(),
  download: vi.fn().mockResolvedValue(Buffer.from('file-content')),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
};
vi.mock('@/lib/storage/file-storage', () => ({
  getFileStorage: () => mockStorage,
}));

const mockRunProcessingPipeline = vi.fn();
vi.mock('@/lib/processing/pipeline', () => ({
  runProcessingPipeline: (...args: unknown[]) => mockRunProcessingPipeline(...args),
}));

const { POST } = await import('@/app/api/batches/[batchId]/process/route');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_BATCH = {
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
  prior_batch_id: null,
  files: [],
  exceptions: [],
  exports: [],
  processing_result: null,
};

const SAMPLE_FILES = [
  {
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
  },
];

const PIPELINE_OUTPUT = {
  tradeCount: 5,
  eventCount: 5,
  voucherCount: 5,
  ledgerCount: 3,
  checks: [{ check_name: 'Voucher Balance', status: 'PASSED' as const, details: 'All balanced' }],
  summary: { passed: 1, warnings: 0, failed: 0 },
  mastersXml: '<ENVELOPE><MASTERS/></ENVELOPE>',
  transactionsXml: '<ENVELOPE><VOUCHERS/></ENVELOPE>',
  mastersArtifactId: 'art-masters',
  transactionsArtifactId: 'art-transactions',
  filesSummary: [{ fileName: 'tradebook.csv', detectedType: 'tradebook' as const }],
  chargeSource: 'none' as const,
  fyLabel: 'FY 2025-26',
};

function makeRequest(batchId = 'batch-1') {
  return {
    request: new NextRequest(`http://localhost/api/batches/${batchId}/process`, { method: 'POST' }),
    params: Promise.resolve({ batchId }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.getBatch.mockResolvedValue(SAMPLE_BATCH);
  repo.getFilesByBatch.mockResolvedValue(SAMPLE_FILES);
  repo.resolveUploadedFilePath.mockResolvedValue('/storage/path/file-1');
  mockRunProcessingPipeline.mockResolvedValue(PIPELINE_OUTPUT);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/batches/[batchId]/process', () => {
  it('returns 401 when not authenticated', async () => {
    const { getAuthenticatedUserId } = await import('@/lib/supabase/auth-guard');
    vi.mocked(getAuthenticatedUserId).mockResolvedValueOnce(null);

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    expect(res.status).toBe(401);
  });

  it('returns 404 when batch does not exist', async () => {
    repo.getBatch.mockResolvedValueOnce(null);

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('Batch not found');
  });

  it('returns 403 when batch belongs to a different user', async () => {
    repo.getBatch.mockResolvedValueOnce({ ...SAMPLE_BATCH, user_id: 'other-user' });

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    expect(res.status).toBe(403);
  });

  it('returns 409 when batch has no uploaded files', async () => {
    repo.getFilesByBatch.mockResolvedValueOnce([]);

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('No files');
  });

  it('returns 409 when one or more files are not in uploaded state', async () => {
    repo.getFilesByBatch.mockResolvedValueOnce([
      { ...SAMPLE_FILES[0], status: 'uploading', file_name: 'tradebook.csv' },
    ]);

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('still uploading');
  });

  it('returns 429 when rate limited', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ success: false, remaining: 0, reset: Date.now() + 3600000 });

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    expect(res.status).toBe(429);
  });

  it('returns 200 with correct response shape on success', async () => {
    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.batchId).toBe('batch-1');
    expect(body.eventCount).toBe(5);
    expect(body.voucherCount).toBe(5);
    expect(body.ledgerCount).toBe(3);
    expect(body.checks).toBeInstanceOf(Array);
    expect(body.mastersArtifactId).toBe('art-masters');
    expect(body.transactionsArtifactId).toBe('art-transactions');
    expect(body.chargeSource).toBe('none');
  });

  it('sets batch status to running before invoking the pipeline', async () => {
    const { request, params } = makeRequest();
    await POST(request, { params });

    expect(repo.updateBatchStatus).toHaveBeenCalledWith('batch-1', 'running', null);
    expect(mockRunProcessingPipeline).toHaveBeenCalledOnce();
  });

  it('passes correct pipeline inputs derived from batch metadata', async () => {
    const { request, params } = makeRequest();
    await POST(request, { params });

    expect(mockRunProcessingPipeline).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-id',
        batchId: 'batch-1',
        companyName: 'Test Co',
        accountingMode: 'investor',
        periodFrom: '2025-04-01',
        periodTo: '2026-03-31',
      }),
    );
  });

  it('returns 500 and marks batch failed when pipeline throws', async () => {
    mockRunProcessingPipeline.mockRejectedValueOnce(new Error('No tradebook found'));

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('No tradebook found');
    expect(repo.updateBatchStatus).toHaveBeenCalledWith('batch-1', 'failed', 'No tradebook found');
  });

  it('returns 500 when resolveUploadedFilePath returns null for a file', async () => {
    repo.resolveUploadedFilePath.mockResolvedValueOnce(null);

    const { request, params } = makeRequest();
    const res = await POST(request, { params });
    expect(res.status).toBe(500);
  });
});
