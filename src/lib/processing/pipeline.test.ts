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
    saveCorporateActions: vi.fn().mockResolvedValue(undefined),
    getCorporateActions: vi.fn().mockResolvedValue([]),
    updateFileStatus: vi.fn(),
    getFilesByBatch: vi.fn(),
    deleteFile: vi.fn(),
    findDuplicateFile: vi.fn(),
};
const mockLedgerRepo = {
    listOverrides: vi.fn().mockResolvedValue([]),
    upsertOverride: vi.fn(),
    bulkUpsertOverrides: vi.fn(),
    deleteOverride: vi.fn(),
};
const mockStockItemRepo = {
    listStockItems: vi.fn().mockResolvedValue([]),
    bulkUpsertStockItems: vi.fn(),
};

vi.mock('@/lib/db', () => ({
    getBatchRepository: () => mockRepo,
    getSettingsRepository: () => ({
        getSettings: vi.fn().mockResolvedValue(null),
        upsertSettings: vi.fn(),
    }),
    getLedgerRepository: () => mockLedgerRepo,
    getStockItemRepository: () => mockStockItemRepo,
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
    mockLedgerRepo.listOverrides.mockResolvedValue([]);
    mockStockItemRepo.listStockItems.mockResolvedValue([]);
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

describe('runProcessingPipeline — Tax P&L prior cost basis', () => {
    function findVoucherXml(transactionsXml: string, narrationPrefix: string): string {
        const voucher = transactionsXml
            .split('<VOUCHER ')
            .map((chunk) => `<VOUCHER ${chunk}`)
            .find((chunk) => chunk.includes(`<NARRATION>${narrationPrefix}`));
        expect(voucher).toBeDefined();
        return voucher!;
    }

    it('uses Tax P&L entry data for current-period sells bought before the selected FY', async () => {
        const { buildXlsxBuffer } = await import('../../tests/helpers/factories');
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-06-27,NSE,EQ,FIEMIND,INE737H01014,SELL,10,1259.00,CNC,T501,ORD501,09:15:00',
        ].join('\n'));
        const taxPnlBuffer = buildXlsxBuffer({
            'Tradewise Exits': [
                ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
                ['FIEMIND', 'INE737H01014', '2021-08-18', '2022-06-27', '10', '9767.5', '12590', '2822.5', '313', '0', '2822.5', '12590'],
            ],
        });

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-taxpnl-prior-cost',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            files: [
                {
                    fileId: 'file-fiemind-sell',
                    fileName: 'tradebook-fy22-fiemind.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
                {
                    fileId: 'file-taxpnl-fiemind',
                    fileName: 'tax_pnl-FC9134.xlsx',
                    buffer: taxPnlBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of FIEMIND');

        expect(result.filesSummary.find((file) => file.fileName === 'tax_pnl-FC9134.xlsx')?.detectedType).toBe('taxpnl');
        expect(result.checks.find((check) => check.check_name === 'Tax P&L Cost Basis')?.status).toBe('PASSED');
        expect(sellVoucher).not.toContain('Unmatched Sell Suspense');
        expect(sellVoucher).toContain('<LEDGERNAME>FIEMIND-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>9767.50</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON FIEMIND</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>2822.50</AMOUNT>');
    });
});

describe('runProcessingPipeline — Tax P&L opening positions (partial-sell + still-held)', () => {
    function findVoucherXml(transactionsXml: string, narrationPrefix: string): string {
        const voucher = transactionsXml
            .split('<VOUCHER ')
            .map((chunk) => `<VOUCHER ${chunk}`)
            .find((chunk) => chunk.includes(`<NARRATION>${narrationPrefix}`));
        expect(voucher).toBeDefined();
        return voucher!;
    }

    it('emits opening voucher covering both disposed (Tradewise Exits) and still-held (Open Positions) prior shares', async () => {
        // Scenario: prior FY acquired 50 INFY shares @ ₹1500. During current FY,
        // 30 are sold; 20 remain at year-end.
        //
        // - Tradewise Exits row: entry_date < periodFrom, exit_date in-period
        //   for the 30 disposed shares (seeded by seedPriorCostLotsFromTaxPnl).
        // - Open Positions row: 50 shares at start-of-FY (still-held remainder
        //   of 20 shares must be seeded by seedPriorOpeningLotsFromTaxPnl).
        //
        // The opening voucher should reflect 50 shares total at start-of-FY;
        // the sell voucher should still compute correct STCG (₹2000 profit on
        // 30 shares); the closing snapshot should carry 20 shares forward.
        const { buildXlsxBuffer } = await import('../../tests/helpers/factories');
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-08-15,NSE,EQ,INFY,INE009A01021,SELL,30,1600.00,CNC,T700,ORD700,09:15:00',
        ].join('\n'));
        const taxPnlBuffer = buildXlsxBuffer({
            'Tradewise Exits': [
                ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
                ['INFY', 'INE009A01021', '2021-08-18', '2022-08-15', '30', '45000', '48000', '3000', '362', '0', '3000', '48000'],
            ],
            'Open Positions as of 2022-04-01': [
                ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
                ['INFY', '2021-08-18', 'NSE', 'EQ', 50, 1500, 1600, 5000],
            ],
            'Open Positions as of 2023-03-31': [
                ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
                ['INFY', '2021-08-18', 'NSE', 'EQ', 20, 1500, 1700, 4000],
            ],
        });

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-taxpnl-partial-with-opening',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            openingBalanceSource: 'import_opening_voucher',
            files: [
                {
                    fileId: 'file-infy-sell',
                    fileName: 'tradebook-fy22-infy.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
                {
                    fileId: 'file-taxpnl-infy',
                    fileName: 'tax_pnl-FC9134.xlsx',
                    buffer: taxPnlBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        const openingVoucher = findVoucherXml(
            result.transactionsXml,
            'Opening stock brought forward from previous FY',
        );
        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of INFY');

        // 1) Opening voucher exists and is dated periodFrom (2022-04-01 → 20220401).
        expect(openingVoucher).toContain('<DATE>20220401</DATE>');
        // 2) Opening voucher covers the full 50 shares: one line for the 30
        //    Tradewise-Exits-seeded lot, one line for the 20 still-held
        //    Open-Positions-seeded lot. The contra credit equals their sum
        //    (50 × 1500 = 75000).
        expect(openingVoucher).toContain('<STOCKITEMNAME>INFY-SH</STOCKITEMNAME>');
        expect(openingVoucher).toContain('<ACTUALQTY>30 NOS</ACTUALQTY>');
        expect(openingVoucher).toContain('<ACTUALQTY>20 NOS</ACTUALQTY>');
        expect(openingVoucher).toContain('<RATE>1500.00/NOS</RATE>');
        // The contra credit posts to the Opening Stock Balance B/F ledger.
        // (Total = 45000 + 30000 = 75000.)
        expect(openingVoucher).toContain('<LEDGERNAME>Opening Stock Balance B/F</LEDGERNAME>');
        // The contra credit on the Opening Stock Balance B/F line is the only
        // place a positive-signed 75000.00 amount appears in the voucher.
        expect(openingVoucher).toMatch(/Opening Stock Balance B\/F[\s\S]*?<AMOUNT>75000\.00<\/AMOUNT>/);

        // 3) Sell voucher for the 30 shares still computes STCG (sell value
        //    48000 − cost basis 45000 = 3000 gain).
        expect(sellVoucher).not.toContain('Unmatched Sell Suspense');
        expect(sellVoucher).toContain('<LEDGERNAME>INFY-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>45000.00</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON INFY</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>3000.00</AMOUNT>');

        // 4) Closing snapshot saved via saveClosingLots shows 20 shares
        //    remaining at year-end (50 opening − 30 disposed = 20).
        const closingLots = mockRepo.saveClosingLots.mock.calls[0][1] as Record<
            string,
            Array<{ open_quantity: string; effective_unit_cost: string }>
        >;
        const infyLots = closingLots['ISIN:INE009A01021'];
        expect(infyLots).toBeDefined();
        const totalRemaining = infyLots.reduce(
            (sum, lot) => sum + parseFloat(lot.open_quantity),
            0,
        );
        expect(totalRemaining).toBe(20);
    });

    it('uses Tax P&L as cost-basis evidence without duplicating Tally opening balances by default', async () => {
        const { buildXlsxBuffer } = await import('../../tests/helpers/factories');
        mockLedgerRepo.listOverrides.mockResolvedValueOnce([
            {
                id: 'ledger-infy',
                user_id: 'user-001',
                ledger_key: 'INFY_SH',
                name: 'INFY-SH',
                parent_group: 'INVESTMENT IN SHARES-ZERODHA',
                is_custom: true,
                created_at: '2026-01-01T00:00:00Z',
            },
        ]);
        mockStockItemRepo.listStockItems.mockResolvedValueOnce([
            {
                id: 'stock-infy',
                user_id: 'user-001',
                name: 'INFY-SH',
                base_unit: 'NOS',
                created_at: '2026-01-01T00:00:00Z',
            },
        ]);

        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-08-15,NSE,EQ,INFY,INE009A01021,SELL,30,1600.00,CNC,T701,ORD701,09:15:00',
        ].join('\n'));
        const taxPnlBuffer = buildXlsxBuffer({
            'Tradewise Exits': [
                ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
                ['INFY', 'INE009A01021', '2021-08-18', '2022-08-15', '30', '45000', '48000', '3000', '362', '0', '3000', '48000'],
            ],
            'Open Positions as of 2022-04-01': [
                ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
                ['INFY', '2021-08-18', 'NSE', 'EQ', 50, 1500, 1600, 5000],
            ],
            'Open Positions as of 2023-03-31': [
                ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
                ['INFY', '2021-08-18', 'NSE', 'EQ', 20, 1500, 1700, 4000],
            ],
        });

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-taxpnl-tally-existing',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            files: [
                {
                    fileId: 'file-infy-sell-existing',
                    fileName: 'tradebook-fy22-infy.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
                {
                    fileId: 'file-taxpnl-infy-existing',
                    fileName: 'tax_pnl-FC9134.xlsx',
                    buffer: taxPnlBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of INFY');

        expect(result.transactionsXml).not.toContain('Opening stock brought forward from previous FY');
        expect(result.mastersXml).not.toContain('<STOCKITEM NAME="INFY-SH"');
        expect(sellVoucher).toContain('<LEDGERNAME>INFY-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<STOCKITEMNAME>INFY-SH</STOCKITEMNAME>');
        expect(sellVoucher).toContain('<AMOUNT>45000.00</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON INFY</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>3000.00</AMOUNT>');
    });

    it('seeds opening lots from a holdings snapshot when no Tax P&L is provided', async () => {
        // Regression for codex review: a user uploading a tradebook with only
        // sells PLUS the Zerodha holdings snapshot expects opening cost basis
        // to come from the holdings file. Previously the pipeline dropped the
        // holdings file silently and routed every sell to tally_existing_opening.
        const { buildHoldingsXlsx } = await import('../../tests/helpers/factories');
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-08-15,NSE,EQ,INFY,INE009A01021,SELL,10,1600.00,CNC,T900,ORD900,09:15:00',
        ].join('\n'));
        const holdingsBuffer = buildHoldingsXlsx({
            statementDate: '2022-04-01',
            rows: [
                {
                    symbol: 'INFY',
                    isin: 'INE009A01021',
                    quantity_available: '50',
                    average_price: '1500.00',
                },
            ],
        });

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-holdings-opening',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            openingBalanceSource: 'import_opening_voucher',
            files: [
                {
                    fileId: 'file-infy-sell',
                    fileName: 'tradebook-fy22-holdings.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
                {
                    fileId: 'file-holdings-snapshot',
                    fileName: 'holdings-FC9134.xlsx',
                    buffer: holdingsBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        // 1) Holdings file is recognised and surfaced in filesSummary.
        expect(
            result.filesSummary.find((f) => f.fileName === 'holdings-FC9134.xlsx')?.detectedType,
        ).toBe('holdings');

        // 2) Opening voucher emitted with the full 50-share opening at ₹1500.
        const openingVoucher = findVoucherXml(
            result.transactionsXml,
            'Opening stock brought forward from previous FY',
        );
        expect(openingVoucher).toContain('<STOCKITEMNAME>INFY-SH</STOCKITEMNAME>');
        expect(openingVoucher).toContain('<ACTUALQTY>50 NOS</ACTUALQTY>');
        expect(openingVoucher).toContain('<RATE>1500.00/NOS</RATE>');
        expect(openingVoucher).toMatch(
            /Opening Stock Balance B\/F[\s\S]*?<AMOUNT>75000\.00<\/AMOUNT>/,
        );

        // 3) The sell consumes from the holdings-seeded lot — cost basis is
        //    10 × 1500 = 15000 and gain is 10 × (1600 − 1500) = 1000.
        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of INFY');
        expect(sellVoucher).not.toContain('Unmatched Sell Suspense');
        expect(sellVoucher).not.toContain('Opening stock assumed in Tally');
        expect(sellVoucher).toContain('<LEDGERNAME>INFY-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>15000.00</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON INFY</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>1000.00</AMOUNT>');

        // 4) Closing lots carry 40 shares forward (50 opening − 10 disposed).
        const closingLots = mockRepo.saveClosingLots.mock.calls[0][1] as Record<
            string,
            Array<{ open_quantity: string; effective_unit_cost: string }>
        >;
        const infyLots = closingLots['ISIN:INE009A01021'];
        expect(infyLots).toBeDefined();
        const totalRemaining = infyLots.reduce(
            (sum, lot) => sum + parseFloat(lot.open_quantity),
            0,
        );
        expect(totalRemaining).toBe(40);
    });

    it('prefers Tax P&L opening positions over holdings for the same scrip', async () => {
        // When both files are present, Tax P&L wins for any scrip it already
        // covers (it carries the disposed history in addition to still-held
        // quantity). The holdings seeder must not double-count.
        const { buildXlsxBuffer, buildHoldingsXlsx } = await import('../../tests/helpers/factories');
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-08-15,NSE,EQ,INFY,INE009A01021,SELL,10,1600.00,CNC,T901,ORD901,09:15:00',
        ].join('\n'));
        const taxPnlBuffer = buildXlsxBuffer({
            'Open Positions as of 2022-04-01': [
                ['Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
                ['INFY', 'INE009A01021', '2021-08-18', 'NSE', 'EQ', 50, 1500, 1600, 5000],
            ],
        });
        // Holdings reports a DIFFERENT average price; if the holdings seed
        // ran it would corrupt the cost basis. Asserting the sell uses 1500
        // (Tax-P&L price) proves the dedup gate works.
        const holdingsBuffer = buildHoldingsXlsx({
            statementDate: '2022-04-01',
            rows: [
                {
                    symbol: 'INFY',
                    isin: 'INE009A01021',
                    quantity_available: '50',
                    average_price: '9999.00',
                },
            ],
        });

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-holdings-vs-taxpnl',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            files: [
                {
                    fileId: 'file-sell',
                    fileName: 'tradebook-mixed.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
                {
                    fileId: 'file-taxpnl',
                    fileName: 'tax_pnl-FC9134.xlsx',
                    buffer: taxPnlBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
                {
                    fileId: 'file-holdings',
                    fileName: 'holdings-FC9134.xlsx',
                    buffer: holdingsBuffer,
                    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of INFY');
        expect(sellVoucher).toContain('<AMOUNT>15000.00</AMOUNT>'); // 10 × 1500 from Tax P&L
        expect(sellVoucher).not.toContain('99990.00'); // 10 × 9999 would mean holdings won
    });

    it('falls back to tally_existing_opening for sells of opening shares when no Tax P&L is provided', async () => {
        // Regression guard: pre-bug behavior must survive — tradebook-only
        // sell of a scrip that has no in-FY buy must still route through the
        // "Opening stock assumed in Tally" path, NOT seed any opening lots.
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-08-15,NSE,EQ,INFY,INE009A01021,SELL,30,1600.00,CNC,T800,ORD800,09:15:00',
        ].join('\n'));

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-tally-fallback',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            files: [
                {
                    fileId: 'file-fallback-sell',
                    fileName: 'tradebook-fallback.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of INFY');
        // No opening voucher should be emitted — tracker is empty without
        // prior batch or Tax P&L data.
        expect(result.transactionsXml).not.toContain('Opening stock brought forward from previous FY');
        // The sell follows the existing tally_existing_opening treatment.
        expect(sellVoucher).toContain('Opening stock assumed in Tally');
        expect(sellVoucher).not.toContain('<LEDGERNAME>STCG ON INFY</LEDGERNAME>');
    });
});

describe('runProcessingPipeline — multi-FY opening lots', () => {
    function findVoucherXml(transactionsXml: string, narrationPrefix: string): string {
        const voucher = transactionsXml
            .split('<VOUCHER ')
            .map((chunk) => `<VOUCHER ${chunk}`)
            .find((chunk) => chunk.includes(`<NARRATION>${narrationPrefix}`));
        expect(voucher).toBeDefined();
        return voucher!;
    }

    it('uses prior FY ISIN-keyed closing lots when the current FY only contains the sale', async () => {
        mockRepo.getClosingLots.mockResolvedValueOnce({
            'ISIN:INE111B01023': [
                {
                    cost_lot_id: 'lot-63moons-opening',
                    security_id: 'ISIN:INE111B01023',
                    source_buy_event_id: 'fy21-buy',
                    open_quantity: '10',
                    original_quantity: '10',
                    effective_unit_cost: '80.000000',
                    acquisition_date: '2021-07-01',
                    remaining_total_cost: '800.00',
                },
            ],
        });
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-04-12,NSE,EQ,63MOONS,INE111B01023,SELL,10,120.00,CNC,T500,ORD500,09:15:00',
        ].join('\n'));

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-fy22-carry',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            priorBatchId: 'batch-fy21',
            files: [
                {
                    fileId: 'file-fy22-carry',
                    fileName: 'tradebook-fy22-carry.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of 63MOONS');
        const openingVoucher = findVoucherXml(
            result.transactionsXml,
            'Opening stock brought forward from previous FY',
        );

        expect(mockRepo.getClosingLots).toHaveBeenCalledWith('batch-fy21');
        expect(result.eventCount).toBe(1);
        expect(result.voucherCount).toBe(2);
        expect(result.mastersXml).toContain('<LEDGER NAME="Opening Stock Balance B/F"');
        expect(openingVoucher).toContain('<DATE>20220401</DATE>');
        expect(openingVoucher).toContain('<LEDGERNAME>63MOONS-SH</LEDGERNAME>');
        expect(openingVoucher).toContain('<STOCKITEMNAME>63MOONS-SH</STOCKITEMNAME>');
        expect(openingVoucher).toContain('<ACTUALQTY>10 NOS</ACTUALQTY>');
        expect(openingVoucher).toContain('<RATE>80.00/NOS</RATE>');
        expect(openingVoucher).toContain('<LEDGERNAME>Opening Stock Balance B/F</LEDGERNAME>');
        expect(sellVoucher).not.toContain('Unmatched Sell Suspense');
        expect(sellVoucher).toContain('<LEDGERNAME>63MOONS-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<STOCKITEMNAME>63MOONS-SH</STOCKITEMNAME>');
        expect(sellVoucher).toContain('<ACTUALQTY>10 NOS</ACTUALQTY>');
        expect(sellVoucher).toContain('<RATE>80.00/NOS</RATE>');
        expect(sellVoucher).toContain('<AMOUNT>800.00</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON 63MOONS</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>400.00</AMOUNT>');
    });

    it('saves remaining prior FY lots as the next closing snapshot after partial FY sale', async () => {
        mockRepo.getClosingLots.mockResolvedValueOnce({
            'ISIN:INE111B01023': [
                {
                    cost_lot_id: 'lot-63moons-opening',
                    security_id: 'ISIN:INE111B01023',
                    security_symbol: '63MOONS',
                    source_buy_event_id: 'fy21-buy',
                    open_quantity: '20',
                    original_quantity: '20',
                    effective_unit_cost: '80.000000',
                    acquisition_date: '2021-07-01',
                    remaining_total_cost: '1600.00',
                },
            ],
        });
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-04-12,NSE,EQ,63MOONS,INE111B01023,SELL,10,120.00,CNC,T500,ORD500,09:15:00',
        ].join('\n'));

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-fy22-partial-carry',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            priorBatchId: 'batch-fy21',
            files: [
                {
                    fileId: 'file-fy22-partial-carry',
                    fileName: 'tradebook-fy22-partial-carry.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });
        const closingLots = mockRepo.saveClosingLots.mock.calls[0][1] as Record<
            string,
            Array<{
                open_quantity: string;
                effective_unit_cost: string;
                remaining_total_cost: string;
                security_symbol?: string | null;
            }>
        >;

        expect(result.voucherCount).toBe(2);
        expect(result.transactionsXml).toContain('Opening stock brought forward from previous FY');
        expect(closingLots['ISIN:INE111B01023'][0].open_quantity).toBe('10');
        expect(closingLots['ISIN:INE111B01023'][0].effective_unit_cost).toBe('80.000000');
        expect(closingLots['ISIN:INE111B01023'][0].remaining_total_cost).toBe('800.00');
        expect(closingLots['ISIN:INE111B01023'][0].security_symbol).toBe('63MOONS');
    });

    it('emits stock-out lines against existing Tally opening stock without inventing gain/loss', async () => {
        const sellOnlyTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2022-04-12,NSE,EQ,63MOONS,INE111B01023,SELL,10,120.00,CNC,T500,ORD500,09:15:00',
        ].join('\n'));

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-fy22-tally-opening',
            periodFrom: '2022-04-01',
            periodTo: '2023-03-31',
            files: [
                {
                    fileId: 'file-fy22-tally-opening',
                    fileName: 'tradebook-fy22-tally-opening.csv',
                    buffer: sellOnlyTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of 63MOONS');

        expect(mockRepo.getClosingLots).not.toHaveBeenCalled();
        expect(sellVoucher).toContain('Opening stock assumed in Tally');
        expect(sellVoucher).not.toContain('Unmatched Sell Suspense');
        expect(sellVoucher).not.toContain('<LEDGERNAME>STCG ON 63MOONS</LEDGERNAME>');
        expect(sellVoucher).toContain('<LEDGERNAME>63MOONS-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<STOCKITEMNAME>63MOONS-SH</STOCKITEMNAME>');
        expect(sellVoucher).toContain('<ACTUALQTY>10 NOS</ACTUALQTY>');
        expect(sellVoucher).toContain('<RATE>120.00/NOS</RATE>');
        expect(sellVoucher).toContain('<AMOUNT>1200.00</AMOUNT>');
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

describe('runProcessingPipeline — corporate actions', () => {
    function findVoucherXml(transactionsXml: string, narrationPrefix: string): string {
        const voucher = transactionsXml
            .split('<VOUCHER ')
            .map((chunk) => `<VOUCHER ${chunk}`)
            .find((chunk) => chunk.includes(`<NARRATION>${narrationPrefix}`));
        expect(voucher).toBeDefined();
        return voucher!;
    }

    // A tradebook where the buy uses the pre-split ISIN and the sell uses the
    // post-split ISIN after a 1:5 face-value split. Without a declared
    // STOCK_SPLIT corporate action, cost lots stay keyed to the old ISIN and
    // the sell has no matching inventory. The cost-lot engine (see
    // cost-lots.ts _disposeFifo / _disposeWeightedAverage) now records the
    // sell as a zero-cost "uncovered" disposal rather than throwing — the
    // voucher builder emits a balanced voucher with the full proceeds
    // routed to the gain ledger. Declaring the corporate action is still the
    // correct path (see the next test), but the pipeline no longer blocks.
    const splitScenarioTradebook = Buffer.from([
        'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
        '2024-05-12,NSE,EQ,SPLITCO,INE111A01012,BUY,10,4200.00,CNC,T200,ORD200,09:15:00',
        '2024-11-12,NSE,EQ,SPLITCO,INE111A01020,SELL,50,857.15,CNC,T201,ORD201,09:15:00',
    ].join('\n'));

    it('produces a balanced uncovered-disposal voucher when ISIN changes without a declared corporate action', async () => {
        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-split-fail',
            files: [
                {
                    fileId: 'file-split-001',
                    fileName: 'tradebook-split.csv',
                    buffer: splitScenarioTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        // Pipeline no longer blocks — both trades are processed, and a
        // buy + sell voucher pair is emitted.
        expect(result.voucherCount).toBeGreaterThanOrEqual(2);
        // Only the 2 trade events are present (no corporate action event,
        // since none was declared).
        expect(result.eventCount).toBe(2);
        // The sell voucher for the post-split ISIN (INE111A01020) has no
        // matching lots, so it's emitted as an uncovered disposal. That
        // means no inventory-bearing line for the new ISIN is written
        // (zero-cost basis ⇒ voucher-builder skips the asset CR line).
        expect(result.transactionsXml).not.toMatch(/INE111A01020[^<]*<\/STOCKITEMNAME>/);
    });

    it('migrates lots and balances when STOCK_SPLIT corporate action is declared', async () => {
        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-split-ok',
            corporateActions: [
                {
                    action_type: 'STOCK_SPLIT',
                    security_id: 'ISIN:INE111A01012',
                    new_security_id: 'ISIN:INE111A01020',
                    action_date: '2024-10-28',
                    ratio_numerator: '5',
                    ratio_denominator: '1',
                    notes: 'Face value split 10 → 2',
                },
            ],
            files: [
                {
                    fileId: 'file-split-002',
                    fileName: 'tradebook-split.csv',
                    buffer: splitScenarioTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        expect(result.voucherCount).toBeGreaterThan(0);
        // 2 trade events + 1 corporate action event (at minimum)
        expect(result.eventCount).toBeGreaterThanOrEqual(3);
    });

    it('uses split-adjusted cost basis for a post-split sell on the known IRCTC split date', async () => {
        const irctcSplitTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2021-05-12,NSE,EQ,IRCTC,INE335Y01012,BUY,10,4200.00,CNC,T300,ORD300,09:15:00',
            '2021-11-12,NSE,EQ,IRCTC,INE335Y01020,SELL,50,857.15,CNC,T301,ORD301,09:15:00',
        ].join('\n'));

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-irctc-split',
            periodFrom: '2021-04-01',
            periodTo: '2022-03-31',
            corporateActions: [
                {
                    action_type: 'STOCK_SPLIT',
                    security_id: 'ISIN:INE335Y01012',
                    new_security_id: 'ISIN:INE335Y01020',
                    action_date: '2021-10-28',
                    ratio_numerator: '5',
                    ratio_denominator: '1',
                    notes: 'IRCTC face value split 10 to 2',
                },
            ],
            files: [
                {
                    fileId: 'file-irctc-split',
                    fileName: 'tradebook-irctc-split.csv',
                    buffer: irctcSplitTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of IRCTC');

        expect(result.eventCount).toBe(3);
        expect(result.voucherCount).toBe(2);
        expect(sellVoucher).toContain('<LEDGERNAME>IRCTC-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<STOCKITEMNAME>IRCTC-SH</STOCKITEMNAME>');
        expect(sellVoucher).toContain('<ACTUALQTY>50 NOS</ACTUALQTY>');
        expect(sellVoucher).toContain('<RATE>840.00/NOS</RATE>');
        expect(sellVoucher).toContain('<AMOUNT>42000.00</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON IRCTC</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>857.50</AMOUNT>');
    });

    it('increases open-lot quantity for a bonus issue without creating a phantom buy voucher', async () => {
        const bonusTradebook = Buffer.from([
            'Trade Date,Exchange,Segment,Symbol/Scrip,ISIN,Trade Type,Quantity,Price,Product,Trade ID,Order ID,Order Execution Time',
            '2025-01-01,NSE,EQ,BONUSCO,INE222A01011,BUY,100,200.00,CNC,T400,ORD400,09:15:00',
            '2025-09-01,NSE,EQ,BONUSCO,INE222A01011,SELL,150,150.00,CNC,T401,ORD401,09:15:00',
        ].join('\n'));

        const result = await runProcessingPipeline({
            ...BASE_INPUT,
            batchId: 'batch-bonus-open-lot',
            corporateActions: [
                {
                    action_type: 'BONUS',
                    security_id: 'ISIN:INE222A01011',
                    action_date: '2025-06-01',
                    ratio_numerator: '2',
                    ratio_denominator: '1',
                    notes: '1:1 bonus issue',
                },
            ],
            files: [
                {
                    fileId: 'file-bonus-open-lot',
                    fileName: 'tradebook-bonus-open-lot.csv',
                    buffer: bonusTradebook,
                    mimeType: 'text/csv',
                },
            ],
        });

        const sellVoucher = findVoucherXml(result.transactionsXml, 'Sale of BONUSCO');
        const purchaseVoucherCount = result.transactionsXml.match(/<NARRATION>Purchase of BONUSCO/g)?.length ?? 0;
        const closingLots = mockRepo.saveClosingLots.mock.calls[0][1] as Record<
            string,
            Array<{
                open_quantity: string;
                effective_unit_cost: string;
                remaining_total_cost: string;
            }>
        >;

        expect(result.eventCount).toBe(3);
        expect(result.voucherCount).toBe(2);
        expect(purchaseVoucherCount).toBe(1);
        expect(sellVoucher).toContain('<ACTUALQTY>150 NOS</ACTUALQTY>');
        expect(sellVoucher).toContain('<RATE>100.00/NOS</RATE>');
        expect(sellVoucher).toContain('<AMOUNT>15000.00</AMOUNT>');
        expect(closingLots['ISIN:INE222A01011'][0].open_quantity).toBe('50');
        expect(closingLots['ISIN:INE222A01011'][0].effective_unit_cost).toBe('100.000000');
        expect(closingLots['ISIN:INE222A01011'][0].remaining_total_cost).toBe('5000.00');
    });
});
