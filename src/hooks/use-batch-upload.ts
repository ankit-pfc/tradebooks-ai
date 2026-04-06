'use client';

import { useReducer, useCallback, useRef, useLayoutEffect } from 'react';
import type { BatchFileType } from '@/lib/types/domain';

// ─── Exported types ──────────────────────────────────────────────────────────

export interface FileUploadState {
  fileId: string | null;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  detectedType: BatchFileType | null;
  sizeBytes: number;
  errorMessage: string | null;
  duplicateWarning: { batchId: string; fileName: string } | null;
}

export interface BatchUploadState {
  batchId: string | null;
  batchStatus: 'idle' | 'uploading' | 'running' | 'succeeded' | 'failed';
  files: Map<string, FileUploadState>; // key: `${file.name}-${file.size}`
  error: string | null;
}

export interface ProcessingResult {
  batchId: string;
  tradeCount: number;
  eventCount: number;
  voucherCount: number;
  ledgerCount: number;
  checks: Array<{
    check_name: string;
    status: 'PASSED' | 'FAILED' | 'WARNING';
    details: string;
  }>;
  summary: { passed: number; warnings: number; failed: number };
  mastersXml: string;
  transactionsXml: string;
  mastersArtifactId?: string;
  transactionsArtifactId?: string;
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

type BatchAction =
  | { type: 'BATCH_CREATED'; batchId: string }
  | { type: 'FILE_ADDED'; key: string; file: File }
  | { type: 'FILE_UPLOAD_STARTED'; key: string }
  | {
    type: 'FILE_UPLOAD_SUCCEEDED';
    key: string;
    fileId: string;
    detectedType: BatchFileType;
    sizeBytes: number;
    duplicateWarning?: { batchId: string; fileName: string };
  }
  | { type: 'FILE_UPLOAD_FAILED'; key: string; errorMessage: string }
  | { type: 'FILE_REMOVED'; key: string }
  | { type: 'PROCESSING_STARTED' }
  | { type: 'PROCESSING_SUCCEEDED' }
  | { type: 'PROCESSING_FAILED'; errorMessage: string }
  | { type: 'BATCH_ERROR'; errorMessage: string }
  | { type: 'RESET' };

const initialState: BatchUploadState = {
  batchId: null,
  batchStatus: 'idle',
  files: new Map(),
  error: null,
};

function reducer(state: BatchUploadState, action: BatchAction): BatchUploadState {
  switch (action.type) {
    case 'BATCH_CREATED':
      return { ...state, batchId: action.batchId, batchStatus: 'uploading', error: null };

    case 'FILE_ADDED': {
      // Skip if key already exists (duplicate drop)
      if (state.files.has(action.key)) return state;
      const files = new Map(state.files);
      files.set(action.key, {
        fileId: null,
        file: action.file,
        status: 'pending',
        detectedType: null,
        sizeBytes: action.file.size,
        errorMessage: null,
        duplicateWarning: null,
      });
      return { ...state, files };
    }

    case 'FILE_UPLOAD_STARTED': {
      const existing = state.files.get(action.key);
      if (!existing) return state;
      const files = new Map(state.files);
      files.set(action.key, { ...existing, status: 'uploading', errorMessage: null });
      return { ...state, files };
    }

    case 'FILE_UPLOAD_SUCCEEDED': {
      const existing = state.files.get(action.key);
      if (!existing) return state;
      const files = new Map(state.files);
      files.set(action.key, {
        ...existing,
        fileId: action.fileId,
        status: 'uploaded',
        detectedType: action.detectedType,
        sizeBytes: action.sizeBytes,
        duplicateWarning: action.duplicateWarning ?? null,
        errorMessage: null,
      });
      return { ...state, files };
    }

    case 'FILE_UPLOAD_FAILED': {
      const existing = state.files.get(action.key);
      if (!existing) return state;
      const files = new Map(state.files);
      files.set(action.key, { ...existing, status: 'failed', errorMessage: action.errorMessage });
      return { ...state, files };
    }

    case 'FILE_REMOVED': {
      const files = new Map(state.files);
      files.delete(action.key);
      return { ...state, files };
    }

    case 'PROCESSING_STARTED':
      return { ...state, batchStatus: 'running', error: null };

    case 'PROCESSING_SUCCEEDED':
      return { ...state, batchStatus: 'succeeded' };

    case 'PROCESSING_FAILED':
      return { ...state, batchStatus: 'failed', error: action.errorMessage };

    case 'BATCH_ERROR':
      return { ...state, error: action.errorMessage };

    case 'RESET':
      return { ...initialState, files: new Map() };

    default:
      return state;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function fileKey(file: File): string {
  return `${file.name}-${file.size}`;
}

async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface BatchUploadConfig {
  companyName: string;
  accountingMode: string;
  periodFrom?: string;
  periodTo?: string;
  priorBatchId?: string;
}

export type PurchaseMergeMode = 'same_rate' | 'daily_summary';

export function useBatchUpload() {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Use a ref so async callbacks always read the latest state without stale closures
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const createBatch = useCallback(async (config: BatchUploadConfig): Promise<void> => {
    // Guard: skip if batchId already set (React Strict Mode double-fire)
    if (stateRef.current.batchId !== null) return;

    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: config.companyName,
          accountingMode: config.accountingMode,
          periodFrom: config.periodFrom,
          periodTo: config.periodTo,
          ...(config.priorBatchId ? { priorBatchId: config.priorBatchId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: 'BATCH_ERROR', errorMessage: data.error ?? 'Failed to create batch' });
        return;
      }
      dispatch({ type: 'BATCH_CREATED', batchId: data.batchId });
    } catch (err) {
      dispatch({
        type: 'BATCH_ERROR',
        errorMessage: err instanceof Error ? err.message : 'Failed to create batch',
      });
    }
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<void> => {
    const key = fileKey(file);

    // Guard: if no batchId, we can't upload
    const batchId = stateRef.current.batchId;
    if (!batchId) {
      dispatch({ type: 'FILE_ADDED', key, file });
      dispatch({ type: 'FILE_UPLOAD_FAILED', key, errorMessage: 'No active batch — create a batch first' });
      return;
    }

    dispatch({ type: 'FILE_ADDED', key, file });
    dispatch({ type: 'FILE_UPLOAD_STARTED', key });

    try {
      const hash = await computeHash(file);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/batches/${batchId}/files`, {
        method: 'POST',
        headers: { 'X-Content-Hash': hash },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.status === 'failed') {
        dispatch({
          type: 'FILE_UPLOAD_FAILED',
          key,
          errorMessage: data.errorMessage ?? data.error ?? 'Upload failed',
        });
        return;
      }

      dispatch({
        type: 'FILE_UPLOAD_SUCCEEDED',
        key,
        fileId: data.fileId,
        detectedType: data.detectedType as BatchFileType,
        sizeBytes: data.sizeBytes,
        duplicateWarning: data.duplicateWarning,
      });
    } catch (err) {
      dispatch({
        type: 'FILE_UPLOAD_FAILED',
        key,
        errorMessage: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  }, []);

  const removeFile = useCallback(async (file: File): Promise<void> => {
    const key = fileKey(file);
    const current = stateRef.current;
    const fileState = current.files.get(key);

    // If file was never successfully uploaded, just remove from state
    if (!fileState?.fileId || !current.batchId) {
      dispatch({ type: 'FILE_REMOVED', key });
      return;
    }

    // Best-effort delete — remove from state regardless of API response
    try {
      await fetch(`/api/batches/${current.batchId}/files/${fileState.fileId}`, {
        method: 'DELETE',
      });
    } catch {
      // Ignore errors — file is removed from UI state either way
    }
    dispatch({ type: 'FILE_REMOVED', key });
  }, []);

  const retryFile = useCallback(async (file: File): Promise<void> => {
    const key = fileKey(file);
    const batchId = stateRef.current.batchId;

    if (!batchId) {
      dispatch({ type: 'FILE_UPLOAD_FAILED', key, errorMessage: 'No active batch' });
      return;
    }

    dispatch({ type: 'FILE_UPLOAD_STARTED', key }); // resets errorMessage, sets uploading

    try {
      const hash = await computeHash(file);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/batches/${batchId}/files`, {
        method: 'POST',
        headers: { 'X-Content-Hash': hash },
        body: formData,
      });
      const data = await res.json();

      if (!res.ok || data.status === 'failed') {
        dispatch({
          type: 'FILE_UPLOAD_FAILED',
          key,
          errorMessage: data.errorMessage ?? data.error ?? 'Upload failed',
        });
        return;
      }

      dispatch({
        type: 'FILE_UPLOAD_SUCCEEDED',
        key,
        fileId: data.fileId,
        detectedType: data.detectedType as BatchFileType,
        sizeBytes: data.sizeBytes,
        duplicateWarning: data.duplicateWarning,
      });
    } catch (err) {
      dispatch({
        type: 'FILE_UPLOAD_FAILED',
        key,
        errorMessage: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  }, []);

  const startProcessing = useCallback(async (): Promise<ProcessingResult | null> => {
    const { batchId, batchStatus } = stateRef.current;
    if (!batchId || batchStatus !== 'uploading') return null;

    dispatch({ type: 'PROCESSING_STARTED' });

    try {
      const res = await fetch(`/api/batches/${batchId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseMergeMode: 'same_rate' }),
      });
      const data = await res.json();

      if (!res.ok) {
        dispatch({
          type: 'PROCESSING_FAILED',
          errorMessage: data.error ?? 'Processing failed',
        });
        return null;
      }

      dispatch({ type: 'PROCESSING_SUCCEEDED' });
      return data as ProcessingResult;
    } catch (err) {
      dispatch({
        type: 'PROCESSING_FAILED',
        errorMessage: err instanceof Error ? err.message : 'Processing failed',
      });
      return null;
    }
  }, []);

  const reset = useCallback((): void => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, createBatch, uploadFile, removeFile, retryFile, startProcessing, reset };
}
