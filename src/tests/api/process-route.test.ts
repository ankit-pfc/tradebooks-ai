import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { mockBatchRepo, mockSettingsRepo } from './_helpers';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const batchRepo = mockBatchRepo();
const settingsRepo = mockSettingsRepo();

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => batchRepo,
    getSettingsRepository: () => settingsRepo,
    getLedgerRepository: () => ({
        listOverrides: vi.fn().mockResolvedValue([]),
        upsertOverride: vi.fn(),
        bulkUpsertOverrides: vi.fn(),
        deleteOverride: vi.fn(),
    }),
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } }),
        },
    }),
}));

vi.mock('@/lib/rate-limit', () => ({
    rateLimit: vi.fn().mockReturnValue({ success: true, remaining: 99, reset: Date.now() + 3600000 }),
}));

vi.mock('@/lib/storage/file-storage', () => ({
    getFileStorage: () => ({
        upload: vi.fn().mockResolvedValue('/mock/storage/path'),
        download: vi.fn(),
        delete: vi.fn(),
        getSignedUrl: vi.fn(),
    }),
}));

const mockDetectFileType = vi.fn();
vi.mock('@/lib/parsers/zerodha/detect', () => ({
    detectFileType: (...args: unknown[]) => mockDetectFileType(...args),
}));

const mockParseTradebook = vi.fn();
vi.mock('@/lib/parsers/zerodha/tradebook', () => ({
    parseTradebook: (...args: unknown[]) => mockParseTradebook(...args),
}));

const mockParseContractNotes = vi.fn();
vi.mock('@/lib/parsers/zerodha/contract-notes', () => ({
    parseContractNotes: (...args: unknown[]) => mockParseContractNotes(...args),
}));

vi.mock('@/lib/parsers/zerodha/funds-statement', () => ({
    parseFundsStatement: vi.fn(),
}));

vi.mock('@/lib/parsers/zerodha/dividends', () => ({
    parseDividends: vi.fn(),
}));

const mockBuildCanonicalEvents = vi.fn();
const mockPairContractNoteData = vi.fn();
vi.mock('@/lib/engine/canonical-events', () => ({
    buildCanonicalEvents: (...args: unknown[]) => mockBuildCanonicalEvents(...args),
    pairContractNoteData: (...args: unknown[]) => mockPairContractNoteData(...args),
}));

const mockBuildVouchers = vi.fn();
vi.mock('@/lib/engine/voucher-builder', () => ({
    buildVouchers: (...args: unknown[]) => mockBuildVouchers(...args),
}));

vi.mock('@/lib/engine/voucher-merger', () => ({
    mergePurchaseVouchers: (vouchers: unknown[]) => vouchers,
    disambiguateVoucherNumbers: (vouchers: unknown[]) => vouchers,
}));

vi.mock('@/lib/engine/cost-lots', () => ({
    CostLotTracker: class {
        toJSON() { return { lots: {} }; }
        static fromJSON() { return new this(); }
    },
}));

vi.mock('@/lib/engine/accounting-policy', () => ({
    INVESTOR_DEFAULT: { mode: 'INVESTOR' },
    TRADER_DEFAULT: { mode: 'TRADER' },
    getDefaultTallyProfile: () => ({ customGroups: [] }),
    deriveFYLabel: () => 'FY 2025-26',
    buildProfileFromSettings: () => ({ mode: 'INVESTOR' }),
    AccountingMode: { INVESTOR: 'INVESTOR', TRADER: 'TRADER' },
}));

vi.mock('@/lib/types/accounting', () => ({
    AccountingMode: { INVESTOR: 'INVESTOR', TRADER: 'TRADER' },
}));

const mockCollectRequiredLedgers = vi.fn();
vi.mock('@/lib/export/ledger-masters', () => ({
    collectRequiredLedgers: (...args: unknown[]) => mockCollectRequiredLedgers(...args),
}));

const mockGenerateFullExport = vi.fn();
vi.mock('@/lib/export/tally-xml', () => ({
    generateFullExport: (...args: unknown[]) => mockGenerateFullExport(...args),
}));

const mockMatchTrades = vi.fn();
vi.mock('@/lib/engine/trade-matcher', () => ({
    matchTrades: (...args: unknown[]) => mockMatchTrades(...args),
}));

const { POST } = await import('@/app/api/process/route');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(fields: Record<string, string | File>): FormData {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
        form.append(k, v);
    }
    return form;
}

function makeRequest(form: FormData): NextRequest {
    return new NextRequest('http://localhost/api/process', {
        method: 'POST',
        body: form,
    });
}

const TRADEBOOK_METADATA = {
    date_range: { from: '2025-04-15', to: '2025-04-15' },
    row_count: 1,
    parser_version: '1.0.0',
};

const CN_METADATA = { date_range: { from: '2025-04-15', to: '2025-04-15' } };

function setupContractNote() {
    mockParseContractNotes.mockReturnValue({
        trades: [],
        charges: { trade_date: '2025-04-15' },
        tradesPerSheet: [],
        metadata: CN_METADATA,
    });
    mockPairContractNoteData.mockReturnValue([
        { trades: [], charges: { trade_date: '2025-04-15' } },
    ]);
}

function setupHappyPath() {
    const sampleRow = {
        symbol: 'INFY',
        isin: 'INE009A01021',
        trade_date: '2025-04-15',
        exchange: 'NSE',
        segment: 'EQ',
        trade_type: 'buy',
        quantity: 10,
        price: '1500.00',
        trade_id: 'T1',
        order_id: 'O1',
    };

    mockDetectFileType.mockReturnValue('tradebook');
    mockParseTradebook.mockReturnValue({
        rows: [sampleRow],
        metadata: TRADEBOOK_METADATA,
    });
    mockBuildCanonicalEvents.mockReturnValue([
        { id: 'ev1', type: 'EQUITY_BUY', symbol: 'INFY' },
    ]);
    mockBuildVouchers.mockReturnValue([
        { voucher_draft_id: 'v1', voucher_type: 'PURCHASE', total_debit: 15000, total_credit: 15000 },
    ]);
    mockCollectRequiredLedgers.mockReturnValue([
        { name: 'INFY', group: 'Investments' },
    ]);
    mockGenerateFullExport.mockReturnValue({
        mastersXml: '<ENVELOPE><LEDGER></LEDGER></ENVELOPE>',
        transactionsXml: '<ENVELOPE><VOUCHER></VOUCHER></ENVELOPE>',
    });

    batchRepo.createBatch.mockResolvedValue({
        id: 'batch-123',
        company_name: 'Test Co',
        status: 'uploading',
        files: [],
        exceptions: [],
        exports: [],
        processing_result: null,
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

describe('POST /api/process', () => {
    it('returns 400 when companyName is missing', async () => {
        const form = makeFormData({ accountingMode: 'investor' });
        form.append('files', new File(['data'], 'test.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('companyName');
    });

    it('returns 400 when accountingMode is missing', async () => {
        const form = makeFormData({ companyName: 'Test Co' });
        form.append('files', new File(['data'], 'test.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('accountingMode');
    });

    it('returns 400 when no files are attached', async () => {
        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
        });

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('file');
    });

    it('returns 500 when no recognizable file is detected', async () => {
        // Provide periods so the route doesn't fail on period resolution,
        // letting the pipeline throw the "no processable file" error instead.
        mockDetectFileType.mockReturnValue('unknown');
        mockBuildCanonicalEvents.mockReturnValue([]);
        batchRepo.createBatch.mockResolvedValue({
            id: 'batch-123', company_name: 'Test Co', status: 'uploading',
            files: [], exceptions: [], exports: [], processing_result: null,
        });

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
            periodFrom: '2025-04-01',
            periodTo: '2026-03-31',
        });
        form.append('files', new File(['data'], 'random.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        // Pipeline throws a plain Error → route returns 500
        expect(res.status).toBe(500);
        expect(body.error).toContain('No tradebook');
    });

    it('processes a tradebook file successfully', async () => {
        setupHappyPath();

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
            periodFrom: '2025-04-01',
            periodTo: '2026-03-31',
        });
        form.append('files', new File(['csv,data'], 'tradebook.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.batchId).toBe('batch-123');
        expect(body.tradeCount).toBe(1);
        expect(body.eventCount).toBe(1);
        expect(body.voucherCount).toBe(1);
        expect(body.ledgerCount).toBe(1);
        expect(body.checks).toBeInstanceOf(Array);
        expect(body.mastersXml).toContain('<ENVELOPE>');
        expect(body.transactionsXml).toContain('<ENVELOPE>');
        expect(body.chargeSource).toBe('none');
        expect(body.classificationSummary).toBeDefined();

        // Verify persistence calls
        expect(batchRepo.createBatch).toHaveBeenCalledOnce();
        expect(batchRepo.addUploadedFiles).toHaveBeenCalledOnce();
        expect(batchRepo.updateBatchStatus).toHaveBeenCalledWith('batch-123', 'succeeded', 'Processing complete');
        expect(batchRepo.saveProcessingOutput).toHaveBeenCalledOnce();
    });

    it('accepts a single file via the "file" field (backward compat)', async () => {
        setupHappyPath();

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
            periodFrom: '2025-04-01',
            periodTo: '2026-03-31',
        });
        form.append('file', new File(['csv,data'], 'tradebook.csv'));

        const res = await POST(makeRequest(form));
        expect(res.status).toBe(200);
    });

    it('returns 500 when an engine function throws', async () => {
        mockDetectFileType.mockReturnValue('tradebook');
        mockParseTradebook.mockImplementation(() => {
            throw new Error('Parse failed');
        });

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
            periodFrom: '2025-04-01',
            periodTo: '2026-03-31',
        });
        form.append('files', new File(['bad data'], 'tradebook.csv'));

        batchRepo.createBatch.mockResolvedValue({
            id: 'batch-123', company_name: 'Test Co', status: 'uploading',
            files: [], exceptions: [], exports: [], processing_result: null,
        });

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('Parse failed');
    });
});

// ---------------------------------------------------------------------------
// Trade Match check
// ---------------------------------------------------------------------------

describe('Trade Match check', () => {
    // With periods provided, detectFileType is called only in uploadedFileMeta loop
    // (once per file) + pipeline (once per file) = 2 times per file for 2 files = 4 total.
    function makeTradeAndCNForm() {
        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
            periodFrom: '2025-04-01',
            periodTo: '2026-03-31',
        });
        form.append('files', new File(['csv,data'], 'tradebook.csv'));
        form.append('files', new File(['cn data'], 'contract-note.xlsx'));
        return form;
    }

    it('is absent when only a tradebook is uploaded (no CN file)', async () => {
        setupHappyPath();

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
            periodFrom: '2025-04-01',
            periodTo: '2026-03-31',
        });
        form.append('files', new File(['csv,data'], 'tradebook.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(200);
        const tradeMatchCheck = body.checks.find((c: { check_name: string }) => c.check_name === 'Trade Match');
        expect(tradeMatchCheck).toBeUndefined();
    });

    it('shows PASSED when all tradebook trades match contract note entries', async () => {
        setupHappyPath();
        setupContractNote();
        // Called in uploadedFileMeta loop (2×) + pipeline (2×) = 4 calls total
        mockDetectFileType
            .mockReturnValueOnce('tradebook')
            .mockReturnValueOnce('contract_note')
            .mockReturnValueOnce('tradebook')
            .mockReturnValueOnce('contract_note');
        mockMatchTrades.mockReturnValue({
            matched: [{ trade_id: 'T1' }],
            unmatchedTradebook: [],
            unmatchedContractNote: [],
        });

        const res = await POST(makeRequest(makeTradeAndCNForm()));
        const body = await res.json();

        expect(res.status).toBe(200);
        const check = body.checks.find((c: { check_name: string }) => c.check_name === 'Trade Match');
        expect(check.status).toBe('PASSED');
        expect(check.details).toContain('All 1 tradebook trades matched to contract note entries');
    });

    it('shows WARNING (not FAILED) when contract note has no trade rows', async () => {
        setupHappyPath();
        setupContractNote();
        mockDetectFileType
            .mockReturnValueOnce('tradebook')
            .mockReturnValueOnce('contract_note')
            .mockReturnValueOnce('tradebook')
            .mockReturnValueOnce('contract_note');
        mockMatchTrades.mockReturnValue({
            matched: [],
            unmatchedTradebook: [{ trade_id: 'T1' }, { trade_id: 'T2' }],
            unmatchedContractNote: [],
        });

        const res = await POST(makeRequest(makeTradeAndCNForm()));
        const body = await res.json();

        expect(res.status).toBe(200);
        const check = body.checks.find((c: { check_name: string }) => c.check_name === 'Trade Match');
        expect(check.status).toBe('WARNING');
        expect(check.details).toContain('Contract note had no individual trade entries');
        expect(check.details).toContain('2 tradebook trades were processed as-is');
    });

    it('shows WARNING with match rate when partial match', async () => {
        setupHappyPath();
        setupContractNote();
        mockDetectFileType
            .mockReturnValueOnce('tradebook')
            .mockReturnValueOnce('contract_note')
            .mockReturnValueOnce('tradebook')
            .mockReturnValueOnce('contract_note');
        mockMatchTrades.mockReturnValue({
            matched: [{ trade_id: 'T1' }],
            unmatchedTradebook: [{ trade_id: 'T2' }, { trade_id: 'T3' }],
            unmatchedContractNote: [{ trade_id: 'CN1' }],
        });

        const res = await POST(makeRequest(makeTradeAndCNForm()));
        const body = await res.json();

        expect(res.status).toBe(200);
        const check = body.checks.find((c: { check_name: string }) => c.check_name === 'Trade Match');
        expect(check.status).toBe('WARNING');
        expect(check.details).toContain('33%');
        expect(check.details).toContain('Tally XML is unaffected');
    });
});
