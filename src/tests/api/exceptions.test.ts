import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockBatchRepo } from './_helpers';

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => repo,
}));

vi.mock('@/lib/supabase/auth-guard', () => ({
    getAuthenticatedUserId: vi.fn().mockResolvedValue('test-user-id'),
}));

const { GET } = await import('@/app/api/exceptions/route');

const SAMPLE_EXCEPTIONS = [
    { id: 'e1', batch_id: 'b1', severity: 'error', message: 'Parse failure' },
    { id: 'e2', batch_id: 'b1', severity: 'warning', message: 'Missing field' },
    { id: 'e3', batch_id: 'b2', severity: 'error', message: 'Invalid data' },
    { id: 'e4', batch_id: 'b2', severity: 'info', message: 'Skipped row' },
];

beforeEach(() => {
    vi.clearAllMocks();
    repo.listExceptions.mockResolvedValue(SAMPLE_EXCEPTIONS);
});

describe('GET /api/exceptions', () => {
    it('returns all exceptions when no filters', async () => {
        const req = new NextRequest('http://localhost/api/exceptions');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.exceptions).toEqual(SAMPLE_EXCEPTIONS);
    });

    it('filters by severity', async () => {
        const req = new NextRequest('http://localhost/api/exceptions?severity=error');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.exceptions).toHaveLength(2);
        expect(body.exceptions.every((e: { severity: string }) => e.severity === 'error')).toBe(true);
    });

    it('filters by batch_id', async () => {
        const req = new NextRequest('http://localhost/api/exceptions?batch_id=b2');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.exceptions).toHaveLength(2);
        expect(body.exceptions.every((e: { batch_id: string }) => e.batch_id === 'b2')).toBe(true);
    });

    it('applies combined severity + batch_id filters', async () => {
        const req = new NextRequest('http://localhost/api/exceptions?severity=error&batch_id=b2');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.exceptions).toHaveLength(1);
        expect(body.exceptions[0].id).toBe('e3');
    });

    it('ignores invalid severity and returns all', async () => {
        const req = new NextRequest('http://localhost/api/exceptions?severity=bogus');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.exceptions).toEqual(SAMPLE_EXCEPTIONS);
    });

    it('returns 500 when repository throws', async () => {
        repo.listExceptions.mockRejectedValueOnce(new Error('DB error'));

        const req = new NextRequest('http://localhost/api/exceptions');
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('DB error');
    });
});
