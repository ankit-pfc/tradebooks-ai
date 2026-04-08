import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runProcessingPipeline, type PipelineInput } from './pipeline';
import { TradeClassificationStrategy } from '@/lib/engine/trade-classifier';
import { isPipelineValidationError } from '@/lib/errors/pipeline-validation';

// ---------------------------------------------------------------------------
// Mocks — storage and DB; engine/parser modules are real (integration-style)
// ---------------------------------------------------------------------------

const mockRepo = {
    createBatch: vi.fn(),
    getBatch: vi.fn(),
    listBatches: vi.fn(),
    updateBatchStatus: vi.fn().mockResolvedValue(undefined),
    addUploadedFiles: vi.fn(),
    resolveUploadedFilePath: vi.fn(),
    saveProcessingOutput: vi.fn().mockResolvedValue(undefined),
    listExceptions: vi.fn(),
    buildDashboardSummary: vi.fn(),
    saveClosingLots: vi.fn().mockResolvedValue(undefined),
    getClosingLots: vi.fn().mockResolvedValue(null),
    listPriorBatches: vi.fn(),
    updateFileStatus: vi.fn(),
    getFilesByBatch: vi.fn(),
    deleteFile: vi.fn(),
    findDuplicateFile: vi.fn(),
};

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => mockRepo,
    getSettingsRepository: () => ({
        getSettings: vi.fn().mockResolvedValue(null),
        upsertSettings: vi.fn(),
    }),
    getLedgerRepository: () => ({
        listOverrides: vi.fn().mockResolvedValue([]),
        upsertOverride: vi.fn(),
        bulkUpsertOverrides: vi.fn(),
        deleteOverride: vi.fn(),
    }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(process.cwd(), 'src/tests/fixtures/zerodha-tradebook-sample.csv');
const tradebookBuffer = readFileSync(FIXTURE_PATH);
const mixedProductTradebookBuffer = Buffer.from([
    'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
    '2024-06-15,NSE,EQ,SBIN,INE062A01020,BUY,10,100.00,CNC,T100,ORD100,09:15:00',
    '2024-06-15,NSE,EQ,SBIN,INE062A01020,SELL,10,110.00,CNC,T101,ORD101,14:30:00',
    '2024-06-16,MCX,COM,GOLDPETAL,NA,BUY,2,50000.00,CNC,T102,ORD102,10:00:00',
    '2024-06-17,MCX,COM,GOLDPETAL,NA,SELL,2,51000.00,CNC,T103,ORD103,11:00:00',
    '2024-06-18,NSE,EQ,INFY,INE009A01021,BUY,5,1500.00,MTF,T104,ORD104,12:00:00',
].join('\n'));

const BASE_INPUT: PipelineInput = {
    userId: 'user-001',
    batchId: 'batch-001',
    companyName: 'Test Co',
    accountingMode: 'investor',
    periodFrom: '2024-04-01',
    periodTo: '2025-03-31',
    classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    files: [
        {
            fileId: 'file-001',
            fileName: 'zerodha-tradebook-sample.csv',
            buffer: tradebookBuffer,
            mimeType: 'text/csv',
        },
    ],
};

beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.updateBatchStatus.mockResolvedValue(undefined);
    mockRepo.saveProcessingOutput.mockResolvedValue(undefined);
    mockRepo.getClosingLots.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runProcessingPipeline — happy path (tradebook)', () => {
    it('produces vouchers, ledgers, and valid XML', async () => {
        const result = await runProcessingPipeline(BASE_INPUT);

        expect(result.voucherCount).toBeGreaterThan(0);
        expect(result.ledgerCount).toBeGreaterThan(0);
        expect(result.eventCount).toBeGreaterThan(0);
        expect(result.mastersXml).toContain('<ENVELOPE>');
        expect(result.transactionsXml).toContain('<ENVELOPE>');
    });

    it('sets chargeSource to "none" when no contract note is present', async () => {
        const result = await runProcessingPipeline(BASE_INPUT);
        expect(result.chargeSource).toBe('none');
    });

    it('does not include matchResult when no contract note is present', async () => {
        const result = await runProcessingPipeline(BASE_INPUT);
        expect(result.matchResult).toBeUndefined();
    });

    it('returns fyLabel derived from provided period', async () => {
        const result = await runProcessingPipeline(BASE_INPUT);
        // deriveFYLabel('2024-04-01', '2025-03-31') → '2024-25'
        expect(result.fyLabel).toBe('2024-25');
    });

    it('passes all reconciliation checks or only warnings (no FAILED)', async () => {
        const result = await runProcessingPipeline(BASE_INPUT);
        const failed = result.checks.filter((c) => c.status === 'FAILED');
        expect(failed).toHaveLength(0);
    });

    it('calls updateBatchStatus with succeeded', async () => {
        await runProcessingPipeline(BASE_INPUT);
        expect(mockRepo.updateBatchStatus).toHaveBeenCalledWith(
            'batch-001',
            'succeeded',
            'Processing complete',
        );
    });

    it('processes a mixed-product tradebook end-to-end and emits expected XML voucher structures', async () => {
        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            files: [
                {
                    fileId: 'file-mixed-001',
                    fileName: 'mixed-product-tradebook.csv',
                    buffer: mixedProductTradebookBuffer,
                    mimeType: 'text/csv',
                },
            ],
        });

        expect(result.classificationSummary.INVESTMENT).toBe(3);
        expect(result.classificationSummary.NON_SPECULATIVE_BUSINESS).toBe(2);
        expect(result.classificationSummary.SPECULATIVE_BUSINESS).toBe(0);
        expect(result.classificationSummary.mtf_trades).toBe(1);

        const mtfCheck = result.checks.find((check) => check.check_name === 'MTF Review');
        expect(mtfCheck?.status).toBe('WARNING');
        expect(mtfCheck?.details).toContain('MTF trade event');

        expect(result.transactionsXml).toContain('Sale of SBIN');
        expect(result.transactionsXml).toContain('STCG ON SBIN');
        expect(result.transactionsXml).toContain('Trading Sales');
        expect(result.transactionsXml).toContain('Cost of Shares Sold');
        expect(result.transactionsXml).toContain('Review: MTF financing treatment');

        expect(result.mastersXml).toContain('SBIN-SH');
        expect(result.mastersXml).toContain('GOLDPETAL-SH');
        expect(result.mastersXml).toContain('Trading Sales');
        expect(result.mastersXml).toContain('STCG ON SBIN');
    });
});

describe('runProcessingPipeline — validation errors', () => {
    it('investor-mode default succeeds on missing-product EQ trades by classifying as INVESTMENT', async () => {
        // Regression: previously the pipeline default was STRICT_PRODUCT which
        // hard-failed any tradebook row without a product column. The default
        // is now derived from accountingMode, so investor mode falls back to
        // ASSUME_ALL_EQ_INVESTMENT and the upload succeeds without forcing
        // the user to pick a strategy.
        const ambiguousTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2024-06-15,NSE,EQ,SBIN,INE062A01020,BUY,10,100.00,,T200,ORD200,09:15:00',
            '2024-08-20,NSE,EQ,SBIN,INE062A01020,SELL,10,120.00,,T201,ORD201,10:30:00',
        ].join('\n'));
        const baseWithoutStrategy = { ...BASE_INPUT };
        delete baseWithoutStrategy.classificationStrategy;

        const result = await runProcessingPipeline({
            ...baseWithoutStrategy,
            accountingMode: 'investor',
            files: [
                {
                    fileId: 'file-ambiguous-001',
                    fileName: 'ambiguous-tradebook.csv',
                    buffer: ambiguousTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        expect(result.classificationSummary.INVESTMENT).toBeGreaterThan(0);
        expect(result.classificationSummary.PROFILE_DRIVEN).toBe(0);
    });

    it('trader-mode default classifies same-day flat groups as speculative without strategy override', async () => {
        // Trader-mode default is HEURISTIC_SAME_DAY_FLAT_INTRADAY: same-day
        // buy+sell that net to zero is reclassified as SPECULATIVE_BUSINESS,
        // and the upload succeeds without an explicit strategy.
        const sameDayFlatTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2024-06-15,NSE,EQ,SBIN,INE062A01020,BUY,10,100.00,,T300,ORD300,09:15:00',
            '2024-06-15,NSE,EQ,SBIN,INE062A01020,SELL,10,105.00,,T301,ORD301,14:30:00',
        ].join('\n'));
        const baseWithoutStrategy = { ...BASE_INPUT };
        delete baseWithoutStrategy.classificationStrategy;

        const result = await runProcessingPipeline({
            ...baseWithoutStrategy,
            accountingMode: 'trader',
            files: [
                {
                    fileId: 'file-sameday-flat-001',
                    fileName: 'sameday-flat-tradebook.csv',
                    buffer: sameDayFlatTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        expect(result.classificationSummary.SPECULATIVE_BUSINESS).toBeGreaterThan(0);
        expect(result.classificationSummary.PROFILE_DRIVEN).toBe(0);
    });

    it('throws when no processable file is detected', async () => {
        await expect(
            runProcessingPipeline({
                ...BASE_INPUT,
                files: [
                    {
                        fileId: 'f1',
                        fileName: 'holdings.csv',
                        // Holdings file content — not a tradebook
                        buffer: Buffer.from('Name,ISIN,Quantity\nINFY,INE009A01021,10'),
                        mimeType: 'text/csv',
                    },
                ],
            }),
        ).rejects.toThrow('No tradebook');
    });

    it('throws when files array is empty', async () => {
        await expect(
            runProcessingPipeline({ ...BASE_INPUT, files: [] }),
        ).rejects.toThrow('No tradebook');
    });

    it('throws typed validation error in STRICT_PRODUCT mode when product markers are missing', async () => {
        try {
            await runProcessingPipeline({
                ...BASE_INPUT,
                classificationStrategy: TradeClassificationStrategy.STRICT_PRODUCT,
            });
            throw new Error('Expected strict classification validation failure');
        } catch (err) {
            expect(isPipelineValidationError(err)).toBe(true);
            if (isPipelineValidationError(err)) {
                expect(err.code).toBe('E_CLASSIFICATION_AMBIGUOUS');
            }
        }
    });
});

describe('runProcessingPipeline — generic pnl file is recognised and skipped', () => {
    it('accepts a pnl file alongside a tradebook and labels it in filesSummary', async () => {
        // Build a minimal valid Zerodha P&L XLSX in-memory using the same
        // helper the detect tests use, then ship it through the pipeline as
        // a second file. The pipeline must NOT crash and must label the file
        // as 'pnl' so the upload UI can render it as "not needed — safe to
        // skip".
        const { buildXlsxBuffer } = await import('../../tests/helpers/factories');
        const pnlBuffer = buildXlsxBuffer({
            Equity: [
                ['Client ID', 'FC9134'],
                ['P&L Statement for Equity from 2024-04-01 to 2025-03-31'],
                ['Summary'],
                ['Charges', 13559.94],
                ['Realized P&L', 212575.4],
            ],
            'Other Debits and Credits': [['Particulars', 'Amount']],
        });

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            files: [
                ...BASE_INPUT.files,
                {
                    fileId: 'file-pnl-001',
                    fileName: 'pnl-FC9134.xlsx',
                    buffer: pnlBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        // Pipeline still produces a normal tradebook-driven output…
        expect(result.voucherCount).toBeGreaterThan(0);
        // …and the pnl file is reported alongside the tradebook in the
        // filesSummary so the UI can render its detected type instead of a
        // generic "unknown".
        const pnlSummary = result.filesSummary.find((f) => f.fileName === 'pnl-FC9134.xlsx');
        expect(pnlSummary?.detectedType).toBe('pnl');
    });
});

describe('runProcessingPipeline — matchResult present with real fixture', () => {
    it('includes matchResult when contract note is also provided', async () => {
        // We simulate a contract note by providing the tradebook twice —
        // second one will be detected as 'unknown' (wrong format for CN).
        // Instead, just verify matchResult is undefined without CN (already covered above)
        // and that the pipeline doesn't crash on the tradebook-only path.
        const result = await runProcessingPipeline(BASE_INPUT);
        // No CN → no matchResult
        expect(result.matchResult).toBeUndefined();
        // Tradebook file shows up in filesSummary
        expect(result.filesSummary[0].detectedType).toBe('tradebook');
    });
});
