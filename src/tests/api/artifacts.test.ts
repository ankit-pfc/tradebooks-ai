import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockBatchRepo } from './_helpers';

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => repo,
}));

vi.mock('@/lib/supabase/auth-guard', () => ({
    getAuthenticatedUserId: vi.fn().mockResolvedValue('test-user-id'),
}));

vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
}));

const { readFile } = await import('node:fs/promises');
const mockReadFile = vi.mocked(readFile);

const { GET } = await import('@/app/api/artifacts/[batchId]/[artifactId]/route');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/artifacts/[batchId]/[artifactId]', () => {
    it('returns file content with correct headers for XML', async () => {
        repo.resolveArtifactPath.mockResolvedValueOnce('/data/batches/b1/masters.xml');
        mockReadFile.mockResolvedValueOnce('<ENVELOPE></ENVELOPE>');

        const res = await GET(
            new Request('http://localhost/api/artifacts/b1/masters'),
            { params: Promise.resolve({ batchId: 'b1', artifactId: 'masters' }) },
        );

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/xml');
        expect(res.headers.get('Content-Disposition')).toContain('masters.xml');
        const text = await res.text();
        expect(text).toBe('<ENVELOPE></ENVELOPE>');
    });

    it('returns file content with correct headers for JSON', async () => {
        repo.resolveArtifactPath.mockResolvedValueOnce('/data/batches/b1/report.json');
        mockReadFile.mockResolvedValueOnce('{"key":"value"}');

        const res = await GET(
            new Request('http://localhost/api/artifacts/b1/report'),
            { params: Promise.resolve({ batchId: 'b1', artifactId: 'report' }) },
        );

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('returns 404 when artifact not found', async () => {
        repo.resolveArtifactPath.mockResolvedValueOnce(null);

        const res = await GET(
            new Request('http://localhost/api/artifacts/b1/missing'),
            { params: Promise.resolve({ batchId: 'b1', artifactId: 'missing' }) },
        );
        const body = await res.json();

        expect(res.status).toBe(404);
        expect(body.error).toContain('missing');
    });

    it('redirects to signed URL when path is a URL (Supabase mode)', async () => {
        const signedUrl = 'https://xyz.supabase.co/storage/v1/object/sign/exports/batch/masters.xml?token=abc';
        repo.resolveArtifactPath.mockResolvedValueOnce(signedUrl);

        const res = await GET(
            new Request('http://localhost/api/artifacts/b1/masters'),
            { params: Promise.resolve({ batchId: 'b1', artifactId: 'masters' }) },
        );

        expect(res.status).toBe(307);
        expect(res.headers.get('Location')).toBe(signedUrl);
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns 500 when file read fails', async () => {
        repo.resolveArtifactPath.mockResolvedValueOnce('/data/batches/b1/masters.xml');
        mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

        const res = await GET(
            new Request('http://localhost/api/artifacts/b1/masters'),
            { params: Promise.resolve({ batchId: 'b1', artifactId: 'masters' }) },
        );
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('ENOENT');
    });
});
