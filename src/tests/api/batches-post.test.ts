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

vi.mock('@/lib/engine/accounting-policy', () => ({
  deriveFYLabel: vi.fn().mockReturnValue('FY 2025-26'),
}));

const { POST } = await import('@/app/api/batches/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const SAMPLE_BATCH_DETAIL = {
  id: 'batch-new',
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

beforeEach(() => {
  vi.clearAllMocks();
  repo.createBatch.mockResolvedValue(SAMPLE_BATCH_DETAIL);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/batches', () => {
  it('returns 400 when companyName is missing', async () => {
    const res = await POST(makeRequest({ accountingMode: 'investor' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('companyName');
  });

  it('returns 400 when accountingMode is missing', async () => {
    const res = await POST(makeRequest({ companyName: 'Test Co' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('accountingMode');
  });

  it('returns 400 when accountingMode has an invalid value', async () => {
    const res = await POST(makeRequest({ companyName: 'Test Co', accountingMode: 'hedge-fund' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('accountingMode');
  });

  it('returns 201 with batchId and uploading status on success', async () => {
    const res = await POST(
      makeRequest({ companyName: 'Test Co', accountingMode: 'investor' }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.batchId).toBe('batch-new');
    expect(body.status).toBe('uploading');
  });

  it('passes all fields to createBatch including optional ones', async () => {
    await POST(
      makeRequest({
        companyName: 'Test Co',
        accountingMode: 'trader',
        periodFrom: '2025-04-01',
        periodTo: '2026-03-31',
        priorBatchId: 'prior-batch-1',
      }),
    );

    expect(repo.createBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'Test Co',
        accounting_mode: 'trader',
        period_from: '2025-04-01',
        period_to: '2026-03-31',
        prior_batch_id: 'prior-batch-1',
      }),
    );
  });

  it('returns 401 when not authenticated', async () => {
    const { getAuthenticatedUserId } = await import('@/lib/supabase/auth-guard');
    vi.mocked(getAuthenticatedUserId).mockResolvedValueOnce(null);

    const res = await POST(makeRequest({ companyName: 'Test Co', accountingMode: 'investor' }));
    expect(res.status).toBe(401);
  });

  it('returns 500 when createBatch throws', async () => {
    repo.createBatch.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await POST(makeRequest({ companyName: 'Test Co', accountingMode: 'investor' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('DB connection lost');
  });
});
