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
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
    }),
}));

vi.mock('node:fs/promises', () => ({
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db/local-store', () => ({
    getUploadsDir: () => '/tmp/test-uploads',
    getArtifactsDir: () => '/tmp/test-artifacts',
}));

const mockDetectFileType = vi.fn();
vi.mock('@/lib/parsers/zerodha/detect', () => ({
    detectFileType: (...args: unknown[]) => mockDetectFileType(...args),
}));

const mockParseTradebook = vi.fn();
vi.mock('@/lib/parsers/zerodha/tradebook', () => ({
    parseTradebook: (...args: unknown[]) => mockParseTradebook(...args),
}));

vi.mock('@/lib/parsers/zerodha/contract-notes', () => ({
    parseContractNotes: vi.fn(),
}));

vi.mock('@/lib/parsers/zerodha/funds-statement', () => ({
    parseFundsStatement: vi.fn(),
}));

vi.mock('@/lib/parsers/zerodha/dividends', () => ({
    parseDividends: vi.fn(),
}));

const mockBuildCanonicalEvents = vi.fn();
vi.mock('@/lib/engine/canonical-events', () => ({
    buildCanonicalEvents: (...args: unknown[]) => mockBuildCanonicalEvents(...args),
    pairContractNoteData: vi.fn(),
}));

const mockBuildVouchers = vi.fn();
vi.mock('@/lib/engine/voucher-builder', () => ({
    buildVouchers: (...args: unknown[]) => mockBuildVouchers(...args),
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

vi.mock('@/lib/engine/trade-matcher', () => ({
    matchTrades: vi.fn(),
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
        metadata: { row_count: 1, parser_version: '1.0.0', date_range: { from: '2025-04-15', to: '2025-04-15' } },
    });
    mockBuildCanonicalEvents.mockReturnValue([
        { id: 'ev1', type: 'EQUITY_BUY', symbol: 'INFY' },
    ]);
    mockBuildVouchers.mockReturnValue([
        { id: 'v1', voucher_type: 'PURCHASE', total_debit: 15000, total_credit: 15000 },
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
        status: 'queued',
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

    it('returns 400 when no recognizable file is detected', async () => {
        mockDetectFileType.mockReturnValue('unknown');

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
        });
        form.append('files', new File(['data'], 'random.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('No tradebook');
    });

    it('processes a tradebook file successfully', async () => {
        setupHappyPath();

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
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

        // Verify persistence calls
        expect(batchRepo.createBatch).toHaveBeenCalledOnce();
        expect(batchRepo.addUploadedFiles).toHaveBeenCalledOnce();
        expect(batchRepo.saveExportArtifacts).toHaveBeenCalledOnce();
        expect(batchRepo.updateBatchStatus).toHaveBeenCalledWith('batch-123', 'succeeded', 'Processing complete');
        expect(batchRepo.saveProcessingOutput).toHaveBeenCalledOnce();
    });

    it('accepts a single file via the "file" field (backward compat)', async () => {
        setupHappyPath();

        const form = makeFormData({
            companyName: 'Test Co',
            accountingMode: 'investor',
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
        });
        form.append('files', new File(['bad data'], 'tradebook.csv'));

        const res = await POST(makeRequest(form));
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe('Parse failed');
    });
});
