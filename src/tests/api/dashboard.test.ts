import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockBatchRepo } from './_helpers';

const repo = mockBatchRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => repo,
}));

// Must import AFTER vi.mock
const { GET } = await import('@/app/api/dashboard/route');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/dashboard', () => {
    it('returns dashboard summary on success', async () => {
        const mockDashboard = {
            summary: { total_batches: 5, total_vouchers: 42, success_rate: 80, open_exceptions: 2 },
            recent_batches: [{ id: 'b1', company_name: 'Test Co', status: 'succeeded' }],
        };
        repo.buildDashboardSummary.mockResolvedValueOnce(mockDashboard);

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(mockDashboard);
    });

    it('returns 500 when repository throws', async () => {
        repo.buildDashboardSummary.mockRejectedValueOnce(new Error('DB down'));

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('DB down');
    });
});
