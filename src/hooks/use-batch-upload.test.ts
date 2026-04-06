// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchUpload, fileKey } from './use-batch-upload';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(() => {
  // Web Crypto is not available in jsdom — mock it
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    },
    writable: true,
    configurable: true,
  });
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(name = 'tradebook.csv', content = 'data') {
  return new File([content], name, { type: 'text/csv' });
}

function makeFetchMock(...responses: Array<{ ok: boolean; body: unknown }>) {
  const fetchMock = vi.fn();
  responses.forEach(({ ok, body }) => {
    fetchMock.mockResolvedValueOnce({
      ok,
      json: async () => body,
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const DEFAULT_CONFIG = {
  companyName: 'Test Co',
  accountingMode: 'investor',
  periodFrom: '2024-04-01',
  periodTo: '2025-03-31',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useBatchUpload', () => {
  it('createBatch sets batchId and batchStatus to uploading', async () => {
    makeFetchMock({ ok: true, body: { batchId: 'batch-001', status: 'uploading' } });

    const { result } = renderHook(() => useBatchUpload());

    await act(async () => {
      await result.current.createBatch(DEFAULT_CONFIG);
    });

    expect(result.current.state.batchId).toBe('batch-001');
    expect(result.current.state.batchStatus).toBe('uploading');
    expect(result.current.state.error).toBeNull();
  });

  it('uploadFile transitions file to uploaded on success', async () => {
    const file = makeFile('tradebook.csv');
    const key = fileKey(file);

    makeFetchMock(
      { ok: true, body: { batchId: 'b1', status: 'uploading' } },
      {
        ok: true,
        body: {
          fileId: 'f1',
          fileName: 'tradebook.csv',
          detectedType: 'tradebook',
          sizeBytes: file.size,
          status: 'uploaded',
        },
      }
    );

    const { result } = renderHook(() => useBatchUpload());

    // Separate act() calls so React flushes state (and stateRef) between operations
    await act(async () => {
      await result.current.createBatch(DEFAULT_CONFIG);
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    const fileState = result.current.state.files.get(key);
    expect(fileState?.status).toBe('uploaded');
    expect(fileState?.fileId).toBe('f1');
    expect(fileState?.detectedType).toBe('tradebook');
  });

  it('uploadFile sets status to failed when response returns status: failed', async () => {
    const file = makeFile('bad.csv');
    const key = fileKey(file);

    makeFetchMock(
      { ok: true, body: { batchId: 'b1', status: 'uploading' } },
      { ok: true, body: { status: 'failed', errorMessage: 'Hash mismatch' } }
    );

    const { result } = renderHook(() => useBatchUpload());

    await act(async () => {
      await result.current.createBatch(DEFAULT_CONFIG);
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    const fileState = result.current.state.files.get(key);
    expect(fileState?.status).toBe('failed');
    expect(fileState?.errorMessage).toBe('Hash mismatch');
  });

  it('removeFile removes the file from state map', async () => {
    const file = makeFile('tradebook.csv');
    const key = fileKey(file);

    makeFetchMock(
      { ok: true, body: { batchId: 'b1', status: 'uploading' } },
      {
        ok: true,
        body: { fileId: 'f1', fileName: 'tradebook.csv', detectedType: 'tradebook', sizeBytes: file.size, status: 'uploaded' },
      },
      { ok: true, body: {} } // DELETE response
    );

    const { result } = renderHook(() => useBatchUpload());

    await act(async () => {
      await result.current.createBatch(DEFAULT_CONFIG);
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(result.current.state.files.has(key)).toBe(true);

    await act(async () => {
      await result.current.removeFile(file);
    });

    expect(result.current.state.files.has(key)).toBe(false);
  });

  it('startProcessing transitions batchStatus to succeeded and returns result', async () => {
    const processingResult = {
      batchId: 'b1',
      tradeCount: 10,
      eventCount: 20,
      voucherCount: 5,
      ledgerCount: 8,
      checks: [],
      summary: { passed: 3, warnings: 0, failed: 0 },
      mastersXml: '<xml/>',
      transactionsXml: '<xml/>',
    };

    const file = makeFile('tradebook.csv');
    makeFetchMock(
      { ok: true, body: { batchId: 'b1', status: 'uploading' } },
      {
        ok: true,
        body: { fileId: 'f1', detectedType: 'tradebook', sizeBytes: file.size, status: 'uploaded' },
      },
      { ok: true, body: processingResult }
    );

    const { result } = renderHook(() => useBatchUpload());

    await act(async () => {
      await result.current.createBatch(DEFAULT_CONFIG);
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    let returnedResult: unknown;
    await act(async () => {
      returnedResult = await result.current.startProcessing();
    });

    expect(result.current.state.batchStatus).toBe('succeeded');
    expect(returnedResult).toMatchObject({ batchId: 'b1', tradeCount: 10 });
    expect(fetch).toHaveBeenLastCalledWith('/api/batches/b1/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ purchaseMergeMode: 'same_rate' }),
    });
  });

  it('startProcessing sets batchStatus to failed on server error', async () => {
    const file = makeFile('tradebook.csv');
    makeFetchMock(
      { ok: true, body: { batchId: 'b1', status: 'uploading' } },
      {
        ok: true,
        body: { fileId: 'f1', detectedType: 'tradebook', sizeBytes: file.size, status: 'uploaded' },
      },
      { ok: false, body: { error: 'Pipeline error' } }
    );

    const { result } = renderHook(() => useBatchUpload());

    await act(async () => {
      await result.current.createBatch(DEFAULT_CONFIG);
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    await act(async () => {
      await result.current.startProcessing();
    });

    expect(result.current.state.batchStatus).toBe('failed');
    expect(result.current.state.error).toBe('Pipeline error');
  });
});
