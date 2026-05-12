import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { persistTrace, loadTrace, traceStoragePath } from '../writer';
import { TRACE_SCHEMA_VERSION, type TraceBundle } from '../types';

const dataDir = mkdtempSync(join(tmpdir(), 'trace-writer-test-'));

const originalDataPath = process.env.DATA_PATH;
const originalSupabaseUrl = process.env.SUPABASE_URL;
const originalPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeEach(() => {
  process.env.DATA_PATH = dataDir;
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
});

afterEach(() => {
  if (originalDataPath === undefined) delete process.env.DATA_PATH;
  else process.env.DATA_PATH = originalDataPath;
  if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalSupabaseUrl;
  if (originalPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalPublicUrl;
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

const bundle: TraceBundle = {
  schemaVersion: TRACE_SCHEMA_VERSION,
  batchId: 'batch-xyz',
  capturedAt: '2026-05-13T00:00:00.000Z',
  inputs: {
    userId: 'u',
    companyName: 'C',
    accountingMode: 'investor',
    periodFrom: '2024-04-01',
    periodTo: '2025-03-31',
  },
  files: [],
  stages: [
    {
      name: 'parse',
      startedAt: 'a',
      finishedAt: 'b',
      durationMs: 1,
      summary: { count: 2 },
    },
  ],
  lineage: {
    eventsByFile: {},
    vouchersByEvent: {},
    voucherByExternalRef: {},
    voucherByLedger: {},
    voucherByStockItem: {},
  },
  artifacts: {},
};

describe('persistTrace + loadTrace (local storage)', () => {
  it('round-trips a bundle via gzipped JSON on the filesystem', async () => {
    const result = await persistTrace(bundle);
    expect(result.ok).toBe(true);
    expect(result.path).toBe(traceStoragePath('batch-xyz'));

    const reloaded = await loadTrace('batch-xyz');
    expect(reloaded).toEqual(bundle);
  });

  it('returns null when no trace exists for the batch', async () => {
    expect(await loadTrace('does-not-exist')).toBeNull();
  });

  it('overwrites prior trace on re-run', async () => {
    await persistTrace(bundle);
    const updated: TraceBundle = {
      ...bundle,
      stages: [...bundle.stages, { ...bundle.stages[0], name: 'second' }],
    };
    await persistTrace(updated);
    const reloaded = await loadTrace('batch-xyz');
    expect(reloaded?.stages).toHaveLength(2);
    expect(reloaded?.stages[1].name).toBe('second');
  });
});
