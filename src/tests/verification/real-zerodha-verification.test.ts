import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The temporary verifier runs at import time and writes a JSON artifact to /tmp.
import '/tmp/verify-real-zerodha.ts';

describe('real Zerodha verification', () => {
  it('writes a reconciliation artifact with no failed notes', () => {
    expect(existsSync('/tmp/verify-real-zerodha-report.json')).toBe(true);
    const report = JSON.parse(readFileSync('/tmp/verify-real-zerodha-report.json', 'utf8'));
    expect(report.report.totals.note_failures).toBe(0);
    expect(report.full_reconciliation.overall_status).not.toBe('FAILED');
    expect(report.traces.simple_buy.xml_validation.voucherSummaries.length).toBeGreaterThan(0);
    expect(report.traces.partial_fifo_sell.xml_validation.voucherSummaries.length).toBeGreaterThan(0);
    expect(report.traces.same_day_buy_sell.xml_validation.voucherSummaries.length).toBeGreaterThan(0);
  });
});
