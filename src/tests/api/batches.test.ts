import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockBatchRepo } from './_helpers';

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => repo,
}));

const { GET } = await import('@/app/api/batches/route');

const SAMPLE_BATCHES = [
    { id: 'b1', company_name: 'Co A', status: 'succeeded' },
    { id: 'b2', company_name: 'Co B', status: 'failed' },
    { id: 'b3', company_name: 'Co C', status: 'succeeded' },
];

beforeEach(() => {
    vi.clearAllMocks();
    repo.listBatches.mockResolvedValue(SAMPLE_BATCHES);
});

describe('GET /api/batches', () => {
    it('returns all batches when no status filter', async () => {
        const req = new NextRequest('http://localhost/api/batches');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batches).toEqual(SAMPLE_BATCHES);
    });

    it('filters by valid status param', async () => {
        const req = new NextRequest('http://localhost/api/batches?status=succeeded');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batches).toHaveLength(2);
        expect(body.batches.every((b: { status: string }) => b.status === 'succeeded')).toBe(true);
    });

    it('returns all batches for invalid status param', async () => {
        const req = new NextRequest('http://localhost/api/batches?status=bogus');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batches).toEqual(SAMPLE_BATCHES);
    });

    it('returns 500 when repository throws', async () => {
        repo.listBatches.mockRejectedValueOnce(new Error('DB error'));

        const req = new NextRequest('http://localhost/api/batches');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('DB error');
    });
});
