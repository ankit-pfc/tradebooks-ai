import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { detectFileType } from '../../lib/parsers/zerodha/detect';
import { parseTradebook } from '../../lib/parsers/zerodha/tradebook';
import { buildCanonicalEvents } from '../../lib/engine/canonical-events';
import { CostLotTracker } from '../../lib/engine/cost-lots';
import { buildVouchers } from '../../lib/engine/voucher-builder';
import { INVESTOR_DEFAULT, TRADER_DEFAULT } from '../../lib/engine/accounting-policy';
import { collectRequiredLedgers } from '../../lib/export/ledger-masters';
import { generateFullExport } from '../../lib/export/tally-xml';

const FIXTURE_PATH = resolve(
    process.cwd(),
    'src/tests/fixtures/zerodha-tradebook-sample.csv',
);

describe('process pipeline (tradebook-only)', () => {
    const fileBuffer = readFileSync(FIXTURE_PATH);
    const fileName = 'zerodha-tradebook-sample.csv';

    it('detects tradebook file type correctly', () => {
        const detected = detectFileType(fileBuffer, fileName);
        expect(detected).toBe('tradebook');
    });

    it('rejects non-tradebook files', () => {
        const fakeBuffer = Buffer.from('Name,ISIN,Quantity,Average Price\nINFY,INE009A01021,10,1500');
        const detected = detectFileType(fakeBuffer, 'holdings-report.csv');
        expect(detected).not.toBe('tradebook');
    });

    it('runs the full pipeline in investor mode and returns valid XML', () => {
        const parsed = parseTradebook(fileBuffer, fileName);
        expect(parsed.rows.length).toBeGreaterThan(0);
        expect(parsed.metadata.row_count).toBe(parsed.rows.length);

        const batchId = 'test-batch-001';
        const fileId = 'test-file-001';
        const events = buildCanonicalEvents({ tradebookRows: parsed.rows, batchId, fileIds: { tradebook: fileId } });
        expect(events.length).toBeGreaterThan(0);

        const tracker = new CostLotTracker();
        const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);
        expect(vouchers.length).toBeGreaterThan(0);

        // All vouchers must be balanced
        for (const v of vouchers) {
            expect(v.total_debit).toBe(v.total_credit);
        }

        const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
        expect(ledgers.length).toBeGreaterThan(0);

        const { mastersXml, transactionsXml } = generateFullExport(vouchers, ledgers, 'Test Company');

        expect(mastersXml).toContain('<ENVELOPE>');
        expect(mastersXml).toContain('<LEDGER');
        expect(transactionsXml).toContain('<ENVELOPE>');
        expect(transactionsXml).toContain('<VOUCHER');
    });

    it('runs the full pipeline in trader mode', () => {
        const parsed = parseTradebook(fileBuffer, fileName);
        const events = buildCanonicalEvents({ tradebookRows: parsed.rows, batchId: 'batch-t', fileIds: { tradebook: 'file-t' } });
        const tracker = new CostLotTracker();
        const vouchers = buildVouchers(events, TRADER_DEFAULT, tracker);

        expect(vouchers.length).toBeGreaterThan(0);
        for (const v of vouchers) {
            expect(v.total_debit).toBe(v.total_credit);
        }

        const ledgers = collectRequiredLedgers(events, TRADER_DEFAULT);
        const { mastersXml, transactionsXml } = generateFullExport(vouchers, ledgers, 'Trader Co');

        expect(mastersXml).toContain('<ENVELOPE>');
        expect(transactionsXml).toContain('<VOUCHER');
    });

    it('generates correct voucher types for buy and sell trades', () => {
        const parsed = parseTradebook(fileBuffer, fileName);
        const events = buildCanonicalEvents({ tradebookRows: parsed.rows, batchId: 'batch-v', fileIds: { tradebook: 'file-v' } });
        const tracker = new CostLotTracker();
        const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);

        const types = vouchers.map((v) => v.voucher_type);
        expect(types).toContain('PURCHASE');
        expect(types).toContain('SALES');
    });

    it('produces reconciliation-ready check data', () => {
        const parsed = parseTradebook(fileBuffer, fileName);
        const events = buildCanonicalEvents({ tradebookRows: parsed.rows, batchId: 'batch-c', fileIds: { tradebook: 'file-c' } });
        const tracker = new CostLotTracker();
        const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);
        const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT);
        const { mastersXml, transactionsXml } = generateFullExport(vouchers, ledgers, 'Check Co');

        // Simulate the checks the API route performs
        const allBalanced = vouchers.every((v) => v.total_debit === v.total_credit);
        expect(allBalanced).toBe(true);

        const hasEvents = events.length > 0 && vouchers.length > 0;
        expect(hasEvents).toBe(true);

        const validXml = mastersXml.includes('<ENVELOPE>') && transactionsXml.includes('<ENVELOPE>');
        expect(validXml).toBe(true);
    });
});
