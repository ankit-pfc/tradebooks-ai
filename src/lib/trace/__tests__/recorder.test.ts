import { describe, expect, it } from 'vitest';
import { TraceRecorder, isTraceEnabled } from '../recorder';

const baseInputs = {
  userId: 'u1',
  companyName: 'Acme Co',
  accountingMode: 'investor' as const,
  periodFrom: '2024-04-01',
  periodTo: '2025-03-31',
};

describe('isTraceEnabled', () => {
  it('returns true only when TRACE_PIPELINE is set to 1 or true', () => {
    const original = process.env.TRACE_PIPELINE;
    try {
      process.env.TRACE_PIPELINE = '';
      expect(isTraceEnabled()).toBe(false);
      process.env.TRACE_PIPELINE = '1';
      expect(isTraceEnabled()).toBe(true);
      process.env.TRACE_PIPELINE = 'true';
      expect(isTraceEnabled()).toBe(true);
      process.env.TRACE_PIPELINE = '0';
      expect(isTraceEnabled()).toBe(false);
    } finally {
      if (original === undefined) delete process.env.TRACE_PIPELINE;
      else process.env.TRACE_PIPELINE = original;
    }
  });
});

describe('TraceRecorder', () => {
  it('records stages with durations and summaries', () => {
    const r = new TraceRecorder('batch-1', baseInputs);
    r.stage('parse', () => ({
      files: [{ fileId: 'f1' }, { fileId: 'f2' }],
      tradebookRows: [{ x: 1 }, { x: 2 }, { x: 3 }],
    }));
    const bundle = r.toBundle();
    expect(bundle.stages).toHaveLength(1);
    expect(bundle.stages[0].name).toBe('parse');
    expect(bundle.stages[0].summary).toMatchObject({
      files_count: 2,
      tradebookRows_count: 3,
    });
    expect(bundle.stages[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('attaches file metadata with sha256', () => {
    const r = new TraceRecorder('b', baseInputs);
    r.attachFile({
      fileId: 'f1',
      fileName: 'tradebook.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('hello world'),
      detectedType: 'tradebook',
    });
    const bundle = r.toBundle();
    expect(bundle.files).toHaveLength(1);
    expect(bundle.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.files[0].sizeBytes).toBe(11);
  });

  it('builds reverse lineage indices for events and vouchers', () => {
    const r = new TraceRecorder('b', baseInputs);
    r.indexEvents([
      { event_id: 'e1', source_file_id: 'f1' },
      { event_id: 'e2', source_file_id: 'f1' },
      { event_id: 'e3', source_file_id: 'f2' },
    ]);
    r.indexVouchers([
      {
        voucher_draft_id: 'v1',
        external_reference: 'REF-100',
        source_event_ids: ['e1', 'e2'],
        lines: [
          { ledger_name: 'SBI Investment', stock_item_name: 'SBI-SH' },
          { ledger_name: 'Brokerage', stock_item_name: null },
        ],
      },
    ]);
    const { lineage } = r.toBundle();
    expect(lineage.eventsByFile).toEqual({ f1: ['e1', 'e2'], f2: ['e3'] });
    expect(lineage.voucherByExternalRef['REF-100']).toBe('v1');
    expect(lineage.vouchersByEvent['e1']).toEqual(['v1']);
    expect(lineage.vouchersByEvent['e2']).toEqual(['v1']);
    expect(lineage.voucherByLedger['SBI Investment']).toEqual(['v1']);
    expect(lineage.voucherByStockItem['SBI-SH']).toEqual(['v1']);
    expect(lineage.voucherByStockItem['Brokerage']).toBeUndefined();
  });

  it('records errors from rejected promises and plain values', () => {
    const r = new TraceRecorder('b', baseInputs);
    r.recordError(new Error('boom'));
    expect(r.toBundle().error?.message).toBe('boom');

    const r2 = new TraceRecorder('b', baseInputs);
    r2.recordError('string failure');
    expect(r2.toBundle().error?.message).toBe('string failure');
  });

  it('attaches artifacts and outputs', () => {
    const r = new TraceRecorder('b', baseInputs);
    r.attachArtifact('mastersXml', '<ENVELOPE>x</ENVELOPE>');
    r.recordOutputs({ tradeCount: 5, voucherCount: 4 });
    const b = r.toBundle();
    expect(b.artifacts.mastersXml).toContain('<ENVELOPE>');
    expect(b.outputs).toEqual({ tradeCount: 5, voucherCount: 4 });
  });

  it('supports stageAsync with awaited side effects', async () => {
    const r = new TraceRecorder('b', baseInputs);
    await r.stageAsync('async-step', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return { value: 42 };
    });
    expect(r.toBundle().stages[0].summary.value).toBe(42);
  });
});
