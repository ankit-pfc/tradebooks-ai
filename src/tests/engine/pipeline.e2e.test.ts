import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildCanonicalEvents } from '../../lib/engine/canonical-events';
import { INVESTOR_DEFAULT } from '../../lib/engine/accounting-policy';
import { CostLotTracker } from '../../lib/engine/cost-lots';
import { buildVouchers } from '../../lib/engine/voucher-builder';
import { generateVouchersXml } from '../../lib/export/tally-xml';
import { parseTradebook } from '../../lib/parsers/zerodha/tradebook';
import { TradeClassificationStrategy } from '../../lib/engine/trade-classifier';

describe('tradebook pipeline e2e', () => {
    it('converts tradebook fixture into canonical events, vouchers, and tally XML', () => {
        const fixturePath = resolve(
            process.cwd(),
            'src/tests/fixtures/zerodha-tradebook-sample.csv',
        );
        const fileBuffer = readFileSync(fixturePath);

        const parsed = parseTradebook(fileBuffer, 'tradebook-sample.csv');
        const events = buildCanonicalEvents({
            tradebookRows: parsed.rows,
            batchId: 'batch-001',
            fileIds: { tradebook: 'file-tradebook-001' },
            classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
        });

        expect(events).toHaveLength(2);

        const tracker = new CostLotTracker();
        const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);

        expect(vouchers).toHaveLength(2);
        expect(vouchers[0].total_debit).toBe(vouchers[0].total_credit);
        expect(vouchers[1].total_debit).toBe(vouchers[1].total_credit);

        const xml = generateVouchersXml(vouchers, 'Demo Company');
        expect(xml).toContain('<ENVELOPE>');
        expect(xml).toContain('<VOUCHER');
        expect(xml).toContain('VCHTYPE="Purchase"');
        expect(xml).toContain('VCHTYPE="Sales"');
        expect(xml).toContain('Invoice Voucher View');
        expect(xml).toContain('INFY');
    });
});
