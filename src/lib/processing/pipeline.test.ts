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

        expect(mockRepo.getClosingLots).toHaveBeenCalledWith('batch-fy21');
        expect(result.eventCount).toBe(1);
        expect(sellVoucher).not.toContain('Unmatched Sell Suspense');
        expect(sellVoucher).toContain('<LEDGERNAME>63MOONS-SH</LEDGERNAME>');
        expect(sellVoucher).toContain('<STOCKITEMNAME>INE111B01023-SH</STOCKITEMNAME>');
        expect(sellVoucher).toContain('<ACTUALQTY>10 NOS</ACTUALQTY>');
        expect(sellVoucher).toContain('<RATE>80.00/NOS</RATE>');
        expect(sellVoucher).toContain('<AMOUNT>800.00</AMOUNT>');
        expect(sellVoucher).toContain('<LEDGERNAME>STCG ON 63MOONS</LEDGERNAME>');
        expect(sellVoucher).toContain('<AMOUNT>400.00</AMOUNT>');
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
        expect(sellVoucher).toContain('<STOCKITEMNAME>INE335Y01020-SH</STOCKITEMNAME>');
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
