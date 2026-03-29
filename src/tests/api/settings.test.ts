import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockSettingsRepo } from './_helpers';

const settingsRepo = mockSettingsRepo();

vi.mock('@/lib/db', () => ({
    getSettingsRepository: () => settingsRepo,
}));

const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: { getUser: mockGetUser },
    }),
}));

const { GET, PUT } = await import('@/app/api/settings/route');

beforeEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/settings', () => {
    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null } });

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('returns default settings when none saved', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
        settingsRepo.getSettings.mockResolvedValueOnce(null);

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.user_id).toBe('u1');
        expect(body.accounting_mode).toBe('INVESTOR');
        expect(body.cost_basis_method).toBe('FIFO');
    });

    it('returns saved settings', async () => {
        const saved = {
            user_id: 'u1',
            company_name: 'My Co',
            accounting_mode: 'TRADER',
            cost_basis_method: 'FIFO',
            charge_treatment: 'CAPITALIZE',
            voucher_granularity: 'TRADE_LEVEL',
            ledger_strategy: 'POOLED',
            updated_at: '2026-03-29T00:00:00Z',
        };
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
        settingsRepo.getSettings.mockResolvedValueOnce(saved);

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(saved);
    });
});

describe('PUT /api/settings', () => {
    it('returns 401 when not authenticated', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: null } });

        const req = new Request('http://localhost/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ company_name: 'Test' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await PUT(req);
        const body = await res.json();

        expect(res.status).toBe(401);
        expect(body.error).toBe('Unauthorized');
    });

    it('returns 400 for invalid accounting_mode', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

        const req = new Request('http://localhost/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ accounting_mode: 'INVALID' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await PUT(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('accounting_mode');
    });

    it('returns 400 for invalid cost_basis_method', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

        const req = new Request('http://localhost/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ cost_basis_method: 'LIFO' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await PUT(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('cost_basis_method');
    });

    it('returns 400 when no valid fields provided', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });

        const req = new Request('http://localhost/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ unknown_field: 'value' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await PUT(req);
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('No valid fields');
    });

    it('updates settings successfully', async () => {
        mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
        const merged = {
            user_id: 'u1',
            company_name: 'Updated Co',
            accounting_mode: 'TRADER',
            cost_basis_method: 'FIFO',
            charge_treatment: 'HYBRID',
            voucher_granularity: 'TRADE_LEVEL',
            ledger_strategy: 'SCRIPT_LEVEL',
            updated_at: '2026-03-29T00:00:00Z',
        };
        settingsRepo.upsertSettings.mockResolvedValueOnce(merged);

        const req = new Request('http://localhost/api/settings', {
            method: 'PUT',
            body: JSON.stringify({ company_name: 'Updated Co', accounting_mode: 'TRADER' }),
            headers: { 'Content-Type': 'application/json' },
        });
        const res = await PUT(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(merged);
        expect(settingsRepo.upsertSettings).toHaveBeenCalledWith('u1', {
            company_name: 'Updated Co',
            accounting_mode: 'TRADER',
        });
    });
});
