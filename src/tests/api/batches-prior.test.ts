import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockBatchRepo } from './_helpers';

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => repo,
}));

const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: mockGetUser },
    }),
}));

const { GET } = await import('@/app/api/batches/prior/route');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/batches/prior', () => {
    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null } });

        const req = new NextRequest('http://localhost/api/batches/prior?company_name=Test');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('returns 400 when company_name is missing', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

        const req = new NextRequest('http://localhost/api/batches/prior');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('company_name');
    });

    it('returns prior batches on success', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
        const mockBatches = [{ id: 'b1', company_name: 'Test', status: 'succeeded' }];
        repo.listPriorBatches.mockResolvedValueOnce(mockBatches);

        const req = new NextRequest('http://localhost/api/batches/prior?company_name=Test');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batches).toEqual(mockBatches);
        expect(repo.listPriorBatches).toHaveBeenCalledWith('u1', 'Test');
    });

    it('returns 500 when repository throws', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
        repo.listPriorBatches.mockRejectedValueOnce(new Error('DB error'));

        const req = new NextRequest('http://localhost/api/batches/prior?company_name=Test');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('DB error');
    });
});
