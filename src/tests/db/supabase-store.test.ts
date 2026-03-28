import { describe, it, expect, vi, beforeEach } from 'vitest';

/* -------------------------------------------------------------------------- */
/*  Mock the Supabase server client                                           */
/* -------------------------------------------------------------------------- */

function buildChain() {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockReturnValue(chain);
    return chain;
}

let fromChain = buildChain();

const mockFrom = vi.fn().mockImplementation(() => fromChain);
const mockGetUser = vi.fn();
const mockCreateSignedUrl = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn().mockImplementation(async () => ({
        from: mockFrom,
        auth: { getUser: mockGetUser },
        storage: {
            from: () => ({
                createSignedUrl: mockCreateSignedUrl,
            }),
        },
    })),
}));

// Import after mocking
import { supabaseBatchRepository } from '../../lib/db/supabase-store';

describe('supabaseBatchRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fromChain = buildChain();
        mockFrom.mockImplementation(() => fromChain);
    });

    describe('createBatch', () => {
        it('inserts into the batches table and returns a BatchDetail', async () => {
            const now = new Date().toISOString();
            const mockBatch = {
                id: '123',
                user_id: 'user-1',
                company_name: 'Test Corp',
                accounting_mode: 'investor',
                period_from: '2025-04-01',
                period_to: '2026-03-31',
                status: 'queued',
                status_message: null,
                file_count: 0,
                voucher_count: 0,
                created_at: now,
                updated_at: now,
            };

            fromChain.single.mockResolvedValue({ data: mockBatch, error: null });

            const result = await supabaseBatchRepository.createBatch({
                user_id: 'user-1',
                company_name: 'Test Corp',
                accounting_mode: 'investor',
                period_from: '2025-04-01',
                period_to: '2026-03-31',
            });

            expect(mockFrom).toHaveBeenCalledWith('batches');
            expect(result.id).toBe('123');
            expect(result.company_name).toBe('Test Corp');
            expect(result.files).toEqual([]);
            expect(result.exceptions).toEqual([]);
            expect(result.exports).toEqual([]);
            expect(result.processing_result).toBeNull();
        });

        it('throws on insert error', async () => {
            fromChain.single.mockResolvedValue({
                data: null,
                error: { message: 'insert failed' },
            });

            await expect(
                supabaseBatchRepository.createBatch({
                    user_id: 'user-1',
                    company_name: 'Fail Corp',
                    accounting_mode: 'trader',
                    period_from: '2025-04-01',
                    period_to: '2026-03-31',
                }),
            ).rejects.toThrow('createBatch failed');
        });
    });

    describe('getBatch', () => {
        it('returns null when batch not found', async () => {
            fromChain.single.mockResolvedValue({
                data: null,
                error: { message: 'not found' },
            });

            const result = await supabaseBatchRepository.getBatch('nonexistent');
            expect(result).toBeNull();
        });

        it('returns a full BatchDetail with related data', async () => {
            const mockData = {
                id: '123',
                user_id: 'user-1',
                company_name: 'Test Corp',
                accounting_mode: 'investor',
                period_from: '2025-04-01',
                period_to: '2026-03-31',
                status: 'succeeded',
                status_message: null,
                file_count: 1,
                voucher_count: 5,
                created_at: '2025-01-01T00:00:00Z',
                updated_at: '2025-01-01T00:00:00Z',
                batch_files: [
                    {
                        id: 'f1',
                        batch_id: '123',
                        file_name: 'trade.csv',
                        mime_type: 'text/csv',
                        size_bytes: 1024,
                        detected_type: 'tradebook',
                        created_at: '2025-01-01T00:00:00Z',
                    },
                ],
                batch_exceptions: [],
                batch_processing_results: [
                    {
                        summary: { passed: 5, warnings: 0, failed: 0 },
                        checks: [{ check_name: 'test', status: 'PASSED', details: 'ok' }],
                    },
                ],
                export_artifacts: [],
            };

            fromChain.single.mockResolvedValue({ data: mockData, error: null });

            const result = await supabaseBatchRepository.getBatch('123');
            expect(result).not.toBeNull();
            expect(result!.files).toHaveLength(1);
            expect(result!.processing_result?.summary.passed).toBe(5);
        });
    });

    describe('listBatches', () => {
        it('returns mapped batch records', async () => {
            fromChain.order.mockResolvedValue({
                data: [
                    {
                        id: '1',
                        user_id: 'u1',
                        company_name: 'A',
                        accounting_mode: 'investor',
                        period_from: '2025-04-01',
                        period_to: '2026-03-31',
                        status: 'queued',
                        status_message: null,
                        file_count: 0,
                        voucher_count: 0,
                        created_at: '2025-01-01',
                        updated_at: '2025-01-01',
                    },
                ],
                error: null,
            });

            const result = await supabaseBatchRepository.listBatches();
            expect(result).toHaveLength(1);
            expect(result[0].company_name).toBe('A');
        });
    });

    describe('resolveUploadedFilePath', () => {
        it('returns a signed URL for the file', async () => {
            fromChain.single.mockResolvedValue({
                data: { storage_path: 'user-1/file.csv' },
                error: null,
            });
            mockCreateSignedUrl.mockResolvedValue({
                data: { signedUrl: 'https://example.com/signed' },
            });

            const result = await supabaseBatchRepository.resolveUploadedFilePath('batch-1', 'file-1');
            expect(result).toBe('https://example.com/signed');
        });

        it('returns null when file not found', async () => {
            fromChain.single.mockResolvedValue({
                data: null,
                error: { message: 'not found' },
            });

            const result = await supabaseBatchRepository.resolveUploadedFilePath('batch-1', 'missing');
            expect(result).toBeNull();
        });
    });
});
