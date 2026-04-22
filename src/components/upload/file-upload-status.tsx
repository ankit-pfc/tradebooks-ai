'use client';

import type { BatchFileType } from '@/lib/types/domain';

// ─── Constants ───────────────────────────────────────────────────────────────

export const BATCH_FILE_TYPE_LABELS: Record<BatchFileType, string> = {
  tradebook: 'Tradebook',
  funds_statement: 'Funds Statement',
  holdings: 'Holdings',
  ledger: 'Ledger',
  contract_note: 'Contract Note',
  taxpnl: 'Tax P&L',
  pnl: 'P&L (not needed)',
  agts: 'AGTS',
  dividends: 'Dividends',
  unknown: 'Unknown',
};

export const FILE_TYPE_BADGE: Record<BatchFileType, string> = {
  tradebook: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  funds_statement: 'bg-blue-100 text-blue-700 border-blue-200',
  holdings: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ledger: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  contract_note: 'bg-violet-100 text-violet-700 border-violet-200',
  taxpnl: 'bg-orange-100 text-orange-700 border-orange-200',
  // Detected but informational only — every value in this file is already
  // derived from the tradebook + Tax P&L, so the pipeline safely skips it.
  pnl: 'bg-slate-100 text-slate-600 border-slate-200',
  agts: 'bg-pink-100 text-pink-700 border-pink-200',
  dividends: 'bg-teal-100 text-teal-700 border-teal-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FileUploadStatusProps {
  fileName: string;
  sizeBytes: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  detectedType: BatchFileType | null;
  errorMessage: string | null;
  onRemove?: () => void;
  onRetry?: () => void;
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-gray-500"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0">
      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );
}

function GreenCheckIcon() {
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    </div>
  );
}

function RedXIcon() {
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0">
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-red-600"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileUploadStatus({
  fileName,
  sizeBytes,
  status,
  detectedType,
  errorMessage,
  onRemove,
  onRetry,
}: FileUploadStatusProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
        {/* Left icon */}
        {status === 'pending' && <FileIcon />}
        {status === 'uploading' && <SpinnerIcon />}
        {status === 'uploaded' && <GreenCheckIcon />}
        {status === 'failed' && <RedXIcon />}

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate" title={fileName}>
            {fileName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{formatBytes(sizeBytes)}</span>

            {status === 'uploading' && (
              <span className="text-xs text-indigo-600 font-medium">Uploading…</span>
            )}

            {status === 'uploaded' && detectedType && (
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${FILE_TYPE_BADGE[detectedType]}`}
              >
                {BATCH_FILE_TYPE_LABELS[detectedType]}
              </span>
            )}

            {status === 'failed' && errorMessage && (
              <span
                className="text-xs text-red-600 truncate max-w-[200px]"
                title={errorMessage}
              >
                {errorMessage}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {status === 'uploaded' && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="ml-1 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        {status === 'failed' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry"
            className="shrink-0 text-xs font-medium px-3 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors"
          >
            Retry
          </button>
        )}

        {status === 'failed' && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="ml-1 w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

    </div>
  );
}
