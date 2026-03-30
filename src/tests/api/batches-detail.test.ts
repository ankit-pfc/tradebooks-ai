import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockBatchRepo } from './_helpers';

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => repo,
}));

vi.mock('@/lib/supabase/auth-guard', () => ({
    getAuthenticatedUserId: vi.fn().mockResolvedValue('test-user-id'),
}));

const { GET } = await import('@/app/api/batches/[batchId]/route');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/batches/[batchId]', () => {
    it('returns batch when found', async () => {
        const mockBatch = { id: 'b1', company_name: 'Test Co', status: 'succeeded' };
        repo.getBatch.mockResolvedValueOnce(mockBatch);

        const res = await GET(
            new Request('http://localhost/api/batches/b1'),
            { params: Promise.resolve({ batchId: 'b1' }) },
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batch).toEqual(mockBatch);
        expect(repo.getBatch).toHaveBeenCalledWith('b1');
    });

    it('returns 404 when batch not found', async () => {
        repo.getBatch.mockResolvedValueOnce(null);

        const res = await GET(
            new Request('http://localhost/api/batches/missing'),
            { params: Promise.resolve({ batchId: 'missing' }) },
        );
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toContain('missing');
    });

    it('returns 500 when repository throws', async () => {
        repo.getBatch.mockRejectedValueOnce(new Error('DB error'));

        const res = await GET(
            new Request('http://localhost/api/batches/b1'),
            { params: Promise.resolve({ batchId: 'b1' }) },
        );
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('DB error');
    });
});
