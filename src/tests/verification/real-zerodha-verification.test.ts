import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The temporary verifier runs at import time and writes a JSON artifact to /tmp.
import '/tmp/verify-real-zerodha.ts';

describe('real Zerodha verification', () => {
  it('writes a reconciliation artifact that reflects the real validation failure', () => {
    expect(existsSync('/tmp/verify-real-zerodha-report.json')).toBe(true);
    const report = JSON.parse(readFileSync('/tmp/verify-real-zerodha-report.json', 'utf8'));
    expect(report.pipeline_status).toBe('validation_failed');
    expect(report.validation_error.code).toBe('E_NEGATIVE_CONTRACT_NOTE_CHARGE');
    expect(report.report.totals.note_failures).toBeGreaterThan(0);
    expect(report.traces).toBeNull();
    expect(report.samples).toBeNull();
  });
});
