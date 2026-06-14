'use client';

import { File, Check, X, Loader2 } from 'lucide-react';
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

// Per-type badges keep visual distinction via surface-3 tints + text-ink-2 with a
// subtle left border accent. We use only token-compatible opacity modifiers.
export const FILE_TYPE_BADGE: Record<BatchFileType, string> = {
  tradebook:      'bg-primary/10 text-primary border-primary/20',
  funds_statement:'bg-info/10 text-info border-info/20',
  holdings:       'bg-pos/10 text-pos border-pos/20',
  ledger:         'bg-cyan/10 text-cyan border-cyan/20',
  contract_note:  'bg-warn/10 text-warn border-warn/20',
  taxpnl:         'bg-warn/15 text-warn border-warn/25',
  // Detected but informational only — pipeline safely skips it.
  pnl:            'bg-surface-3 text-ink-2 border-hairline',
  agts:           'bg-neg/10 text-neg border-neg/20',
  dividends:      'bg-pos/15 text-pos border-pos/25',
  unknown:        'bg-surface-2 text-ink-3 border-hairline',
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
    <div className="w-10 h-10 rounded-md bg-surface-2 flex items-center justify-center shrink-0">
      <File className="h-4 w-4 text-ink-3" />
    </div>
  );
}

function SpinnerIcon() {
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0">
      <Loader2 className="h-5 w-5 text-info animate-spin" />
    </div>
  );
}

function GreenCheckIcon() {
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0">
      <div className="w-8 h-8 rounded-full bg-pos/10 flex items-center justify-center">
        <Check className="h-4 w-4 text-pos" strokeWidth={2.5} />
      </div>
    </div>
  );
}

function RedXIcon() {
  return (
    <div className="w-10 h-10 flex items-center justify-center shrink-0">
      <div className="w-8 h-8 rounded-full bg-neg/10 flex items-center justify-center">
        <X className="h-4 w-4 text-neg" strokeWidth={2.5} />
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
    <div className="rounded-xl border border-hairline bg-card px-4 py-3 space-y-1.5">
      <div className="flex items-center gap-3">
        {/* Left icon */}
        {status === 'pending' && <FileIcon />}
        {status === 'uploading' && <SpinnerIcon />}
        {status === 'uploaded' && <GreenCheckIcon />}
        {status === 'failed' && <RedXIcon />}

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate" title={fileName}>
            {fileName}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-ink-3 mono-data">{formatBytes(sizeBytes)}</span>

            {status === 'uploading' && (
              <span className="text-xs text-info font-medium">Uploading…</span>
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
                className="text-xs text-neg truncate max-w-[200px]"
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
            className="ml-1 w-7 h-7 rounded-md flex items-center justify-center text-ink-3 hover:text-neg hover:bg-neg/10 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {status === 'failed' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            aria-label="Retry"
            className="shrink-0 text-xs font-medium px-3 py-1 rounded-md bg-neg/10 text-neg hover:bg-neg/20 border border-neg/20 transition-colors"
          >
            Retry
          </button>
        )}

        {status === 'failed' && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="ml-1 w-7 h-7 rounded-md flex items-center justify-center text-ink-3 hover:text-neg hover:bg-neg/10 transition-colors shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

    </div>
  );
}
