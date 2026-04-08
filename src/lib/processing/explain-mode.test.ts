import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { explainSingleTradePath } from './explain-mode';
import { TradeClassificationStrategy } from '@/lib/engine/trade-classifier';

const TRADEBOOK_FIXTURE = resolve(
  process.cwd(),
  'src/tests/fixtures/zerodha-tradebook-sample.csv',
);

describe('explainSingleTradePath', () => {
  it('produces deterministic snapshots for a tradebook fixture', () => {
    const buffer = readFileSync(TRADEBOOK_FIXTURE);
    const first = explainSingleTradePath({
      tradebookBuffer: buffer,
      tradebookFileName: 'zerodha-tradebook-sample.csv',
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
      batchId: 'explain-batch',
      companyName: 'Explain Co',
    });
    const second = explainSingleTradePath({
      tradebookBuffer: buffer,
      tradebookFileName: 'zerodha-tradebook-sample.csv',
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
      batchId: 'explain-batch',
      companyName: 'Explain Co',
    });

    expect(first.snapshots.totals.event_count).toBeGreaterThan(0);
    expect(first.snapshots.totals.voucher_count).toBeGreaterThan(0);
    expect(first.snapshots.xml.masters_preview).toContain('<ENVELOPE>');
    expect(first.snapshots.xml.transactions_preview).toContain('<ENVELOPE>');
    expect(first.snapshots.canonical_events.first_trade_event).toBeTruthy();
    expect(first.snapshots.canonical_events.first_trade_event).toEqual(
      second.snapshots.canonical_events.first_trade_event,
    );

    writeFileSync('/tmp/tradebooks-explain-sample.json', JSON.stringify(first, null, 2), 'utf-8');
  });
});
