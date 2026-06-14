"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileText,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stat } from "@/components/ui/stat";
import { StatusDot } from "@/components/ui/status-dot";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { FileUploadStatus } from "@/components/upload/file-upload-status";
import { useBatchUpload, type ProcessingResult, type BatchUploadConfig } from "@/hooks/use-batch-upload";
import {
  buildTallyImportArtifactNames,
  TALLY_IMPORT_STEPS,
} from "@/lib/export/import-kit";

// ─── Types ─────────────────────────────────────────────────────────────────

type AccountingMode = "investor";

type MappingConfidence = 'saved' | 'exact' | 'alias' | 'pattern' | 'generated' | 'unmatched';
type MappingStatus = 'saved' | 'suggested' | 'needs_review' | 'missing';

interface TallyMappingCandidate {
  name: string;
  group: string;
}

interface TallyMappingPreviewRow {
  broker_symbol: string;
  security_id: string | null;
  isin: string | null;
  suggested_ledger_name: string | null;
  suggested_ledger_group: string | null;
  suggested_stock_item_name: string | null;
  base_unit: string;
  confidence: MappingConfidence;
  status: MappingStatus;
  candidates: TallyMappingCandidate[];
}

interface TallyMappingPreviewResponse {
  rows: TallyMappingPreviewRow[];
  summary: {
    total: number;
    saved: number;
    suggested: number;
    needsReview: number;
    missing: number;
  };
}

interface MappingDraft {
  tally_ledger_name: string;
  tally_ledger_group: string;
  tally_stock_item_name: string;
  base_unit: string;
  match_source: 'manual' | 'tally_alias' | 'auto_exact' | 'auto_pattern';
}

interface UploadFormData {
  accountingMode: AccountingMode;
  companyName: string;
  periodFrom: string;
  periodTo: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Indian FY options: April 1 YYYY → March 31 YYYY+1
// Covers FY 2018-19 through FY 2025-26 (current)
const FY_OPTIONS: Array<{ label: string; from: string; to: string }> = Array.from(
  { length: 8 },
  (_, i) => {
    const startYear = 2018 + i;
    const endYear = startYear + 1;
    return {
      label: `FY ${startYear}-${String(endYear).slice(-2)}`,
      from: `${startYear}-04-01`,
      to: `${endYear}-03-31`,
    };
  },
).reverse(); // most recent first

const CUSTOM_RANGE_VALUE = "custom";

function formatFYLabel(from: string, to: string): string {
  if (!from || !to) return 'Period not set';
  const sy = parseInt(from.slice(0, 4), 10);
  const ey = parseInt(to.slice(0, 4), 10);
  if (isNaN(sy) || isNaN(ey)) return 'Period not set';
  return `FY ${sy}-${String(ey).slice(-2)}`;
}

function getSelectedPeriodValue(from: string, to: string): string {
  if (!from && !to) return '|';
  const matchedFy = FY_OPTIONS.find((option) => option.from === from && option.to === to);
  return matchedFy ? `${matchedFy.from}|${matchedFy.to}` : CUSTOM_RANGE_VALUE;
}

function isValidDateRange(from: string, to: string): boolean {
  return Boolean(from && to && from < to);
}

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Step indicators ─────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Configure" },
  { num: 2, label: "Upload Files" },
  { num: 3, label: "Review Matches" },
  { num: 4, label: "Processing" },
  { num: 5, label: "Results" },
];

function StepIndicator({
  current,
  total,
}: {
  current: number;
  total: typeof STEPS;
}) {
  return (
    <div className="flex items-center gap-0">
      {total.map((step, idx) => {
        const isCompleted = current > step.num;
        const isActive = current === step.num;
        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "bg-pos text-white"
                    : isActive
                      ? "bg-primary text-white ring-4 ring-primary/20"
                      : "bg-surface-3 text-ink-3"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <span className="mono-data">{step.num}</span>
                )}
              </div>
              <span
                className={`text-xs mt-2 font-medium whitespace-nowrap ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-ink-2"
                      : "text-ink-3"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < total.length - 1 && (
              <div
                className={`w-20 sm:w-28 h-0.5 mb-5 mx-1 transition-colors ${
                  current > step.num ? "bg-pos" : "bg-hairline"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Configure ────────────────────────────────────────────────────────

const SELECT_CLASSES =
  "h-9 w-full rounded-md border border-hairline-strong bg-card px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors";

function StepConfigure({
  formData,
  onChange,
  onNext,
}: {
  formData: UploadFormData;
  onChange: (data: Partial<UploadFormData>) => void;
  onNext: () => void;
}) {
  const [customRangeActive, setCustomRangeActive] = useState(false);
  const isCustomRange = customRangeActive || getSelectedPeriodValue(formData.periodFrom, formData.periodTo) === CUSTOM_RANGE_VALUE;
  const hasPeriodError = isCustomRange && !isValidDateRange(formData.periodFrom, formData.periodTo);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">
          Import Configuration
        </h2>
        <p className="text-sm text-ink-2 mt-1">
          Set up your accounting parameters before uploading files.
        </p>
      </div>

      {/* Accounting Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-ink">
          Accounting Mode
        </Label>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <span className="text-sm font-semibold text-ink">
              Investor
            </span>
          </div>
          <p className="pl-6 text-sm text-ink-2">
            Long-term holdings, LTCG/STCG tax treatment
          </p>
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-1.5">
        <Label htmlFor="company-name" className="text-sm font-medium text-ink">
          Company Name in Tally
        </Label>
        <Input
          id="company-name"
          placeholder="e.g. Rajesh Kumar &amp; Associates"
          value={formData.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
        />
        <p className="text-xs text-ink-3">
          This name will appear in the imported Tally XML. Tally will create or use an existing company with this name — there&apos;s no validation against your Tally data.
        </p>
      </div>

      {/* Period */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-ink">
          Financial Year
        </Label>
        <select
          className={SELECT_CLASSES}
          value={customRangeActive ? CUSTOM_RANGE_VALUE : getSelectedPeriodValue(formData.periodFrom, formData.periodTo)}
          onChange={(e) => {
            if (e.target.value === CUSTOM_RANGE_VALUE) {
              setCustomRangeActive(true);
              onChange({ periodFrom: "", periodTo: "" });
              return;
            }

            setCustomRangeActive(false);
            const fy = FY_OPTIONS.find((o) => `${o.from}|${o.to}` === e.target.value);
            if (fy) onChange({ periodFrom: fy.from, periodTo: fy.to });
          }}
        >
          <option value="|">Select financial year…</option>
          {FY_OPTIONS.map((fy) => (
            <option key={fy.label} value={`${fy.from}|${fy.to}`}>
              {fy.label}
            </option>
          ))}
          <option value={CUSTOM_RANGE_VALUE}>Custom Range</option>
        </select>

        {isCustomRange && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-from" className="text-sm font-medium text-ink-2">
                From
              </Label>
              <Input
                id="period-from"
                type="date"
                value={formData.periodFrom}
                onChange={(e) => onChange({ periodFrom: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-to" className="text-sm font-medium text-ink-2">
                To
              </Label>
              <Input
                id="period-to"
                type="date"
                value={formData.periodTo}
                onChange={(e) => onChange({ periodTo: e.target.value })}
              />
            </div>
          </div>
        )}

        {hasPeriodError && (
          <p className="text-xs text-neg">
            Enter both dates and make sure the From date is earlier than the To date.
          </p>
        )}
      </div>

      <div className="pt-2">
        <Button
          onClick={onNext}
          className="w-full"
          disabled={!formData.companyName.trim() || !formData.periodFrom || !formData.periodTo || !isValidDateRange(formData.periodFrom, formData.periodTo)}
        >
          Continue to File Upload
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Upload Files ─────────────────────────────────────────────────────

const FILE_REQUIREMENTS = [
  { type: "Tradebook", status: "Required", note: "Trade-by-trade CSV from Zerodha Console" },
  { type: "Funds Statement", status: "Recommended", note: "Ledger/P&L statement for cash reconciliation" },
  { type: "Holdings", status: "Optional", note: "Current holdings snapshot for opening balance" },
  { type: "Contract Note", status: "Optional", note: "Daily contract notes for brokerage details" },
];

const STATUS_BADGE: Record<string, string> = {
  Required: "bg-neg/10 text-neg border-neg/20",
  Recommended: "bg-warn/10 text-warn border-warn/20",
  Optional: "bg-surface-2 text-ink-2 border-hairline",
};

function StepUpload({
  batchUpload,
  onBack,
  onReview,
  formData,
  onFormChange,
}: {
  batchUpload: ReturnType<typeof useBatchUpload>;
  onBack: () => void;
  onReview: () => void;
  formData: UploadFormData;
  onFormChange: (d: Partial<UploadFormData>) => void;
}) {
  const [editingFY, setEditingFY] = useState(false);
  const [customRangeActive, setCustomRangeActive] = useState(false);
  const { state } = batchUpload;
  const selectedPeriodValue = getSelectedPeriodValue(formData.periodFrom, formData.periodTo);
  const isCustomRange = customRangeActive || selectedPeriodValue === CUSTOM_RANGE_VALUE;
  const hasPeriodError = isCustomRange && !isValidDateRange(formData.periodFrom, formData.periodTo);

  const fileList = Array.from(state.files.values());
  const hasTradebook = fileList.some(
    (f) => f.detectedType === 'tradebook' && f.status === 'uploaded'
  );
  const hasInFlight = fileList.some((f) => f.status === 'pending' || f.status === 'uploading');
  const hasUploaded = fileList.some((f) => f.status === 'uploaded');
  const failedCount = fileList.filter((f) => f.status === 'failed').length;
  const canProcess =
    state.batchStatus === 'uploading' &&
    hasUploaded &&
    !hasInFlight &&
    isValidDateRange(formData.periodFrom, formData.periodTo);

  const fileListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (fileList.length === 1) {
      fileListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [fileList.length]);

  const handleFilesAdded = (newFiles: File[]) => {
    // Parallel uploads — do not await
    newFiles.forEach((f) => batchUpload.uploadFile(f));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Upload Files</h2>
        <p className="text-sm text-ink-2 mt-1">
          Upload your Zerodha export files. At minimum, a Tradebook file is required.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        {!editingFY ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-primary">
                {formatFYLabel(formData.periodFrom, formData.periodTo)}
              </span>
              <span className="text-ink-3">·</span>
              <span className="text-ink-2 capitalize">{formData.accountingMode} mode</span>
              {formData.companyName && (
                <>
                  <span className="text-ink-3">·</span>
                  <span className="text-ink-2">{formData.companyName}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingFY(true)}
              className="text-xs text-primary hover:underline shrink-0 ml-3 font-medium"
            >
              Edit period
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2">
            <select
              className="h-9 rounded-md border border-hairline-strong bg-card px-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={customRangeActive ? CUSTOM_RANGE_VALUE : selectedPeriodValue}
              onChange={(e) => {
                if (e.target.value === CUSTOM_RANGE_VALUE) {
                  setCustomRangeActive(true);
                  onFormChange({ periodFrom: '', periodTo: '' });
                  return;
                }

                setCustomRangeActive(false);
                const fy = FY_OPTIONS.find((o) => `${o.from}|${o.to}` === e.target.value);
                if (fy) {
                  onFormChange({ periodFrom: fy.from, periodTo: fy.to });
                  setEditingFY(false);
                }
              }}
            >
              <option value="|">Select financial year…</option>
              {FY_OPTIONS.map((fy) => (
                <option key={fy.label} value={`${fy.from}|${fy.to}`}>
                  {fy.label}
                </option>
              ))}
              <option value={CUSTOM_RANGE_VALUE}>Custom Range</option>
            </select>
            {isCustomRange && (
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={formData.periodFrom}
                  onChange={(e) => onFormChange({ periodFrom: e.target.value })}
                />
                <Input
                  type="date"
                  value={formData.periodTo}
                  onChange={(e) => onFormChange({ periodTo: e.target.value })}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditingFY(false)}
              className="text-xs text-ink-2 hover:text-ink font-medium"
            >
              Cancel
            </button>
          </div>
        )}
        {hasPeriodError && (
          <p className="mt-2 text-xs text-neg">
            Enter both dates and make sure the From date is earlier than the To date.
          </p>
        )}
      </div>

      {/* File requirements table */}
      <div className="rounded-xl border border-hairline overflow-hidden">
        <div className="px-4 py-3 bg-surface-2 border-b border-hairline">
          <p className="text-xs font-medium text-ink-2 uppercase tracking-wide">
            Required &amp; Recommended Files
          </p>
        </div>
        <div className="divide-y divide-hairline">
          {FILE_REQUIREMENTS.map((req) => (
            <div
              key={req.type}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-ink">{req.type}</p>
                <p className="text-xs text-ink-2 mt-0.5">{req.note}</p>
              </div>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_BADGE[req.status]}`}
              >
                {req.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dropzone — no files prop; we render our own status list below */}
      <FileDropzone
        onFilesAdded={handleFilesAdded}
        disabled={state.batchStatus !== 'uploading'}
      />

      {/* Per-file status list */}
      {fileList.length > 0 && (
        <div ref={fileListRef} className="space-y-2">
          <p className="text-xs font-medium text-ink-2 uppercase tracking-wide">
            Files (<span className="mono-data">{fileList.length}</span>)
          </p>
          <div className="space-y-2">
            {Array.from(state.files.entries()).map(([key, fs]) => (
              <FileUploadStatus
                key={key}
                fileName={fs.file.name}
                sizeBytes={fs.sizeBytes}
                status={fs.status}
                detectedType={fs.detectedType}
                errorMessage={fs.errorMessage}
                onRemove={() => batchUpload.removeFile(fs.file)}
                onRetry={() => batchUpload.retryFile(fs.file)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Failed files skip notice */}
      {failedCount > 0 && hasUploaded && !hasInFlight && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warn mt-0.5 shrink-0" />
          <p className="text-sm text-warn">
            <span className="mono-data">{failedCount}</span> file{failedCount > 1 ? 's' : ''} failed to upload and will be skipped. You can retry or remove them above.
          </p>
        </div>
      )}

      {/* Validation: tradebook required */}
      {fileList.length > 0 && !hasTradebook && hasUploaded && !hasInFlight && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warn mt-0.5 shrink-0" />
          <p className="text-sm text-warn">
            A <strong>Tradebook</strong> file is required to proceed. Please upload it from Zerodha Console → Reports → Tradebook.
          </p>
        </div>
      )}

      {/* Global batch error */}
      {state.error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-neg/30 bg-neg/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-neg mt-0.5 shrink-0" />
          <p className="text-sm text-neg">{state.error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onBack}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onReview}
          className="flex-1"
          disabled={!canProcess || !hasTradebook}
        >
          Review Tally Matches
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Review Tally Matches ────────────────────────────────────────────

const MATCH_STATUS_TONE: Record<MappingStatus, "pos" | "info" | "warn" | "neg"> = {
  saved: "pos",
  suggested: "info",
  needs_review: "warn",
  missing: "neg",
};

const LEDGER_PICKER_PAGE_SIZE = 25;
const LEDGER_PICKER_DEBOUNCE_MS = 180;

function mappingRowKey(row: Pick<TallyMappingPreviewRow, 'broker_symbol' | 'security_id' | 'isin'>): string {
  return `${row.broker_symbol}|${row.security_id ?? ''}|${row.isin ?? ''}`;
}

function normalizeLedgerSearch(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ');
}

function candidateKey(candidate: TallyMappingCandidate): string {
  return `${candidate.name}||${candidate.group}`;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

function sourceFromConfidence(confidence: MappingConfidence): MappingDraft['match_source'] {
  if (confidence === 'exact') return 'auto_exact';
  if (confidence === 'alias') return 'tally_alias';
  if (confidence === 'pattern') return 'auto_pattern';
  return 'manual';
}

function generatedLedgerFor(row: TallyMappingPreviewRow): MappingDraft {
  const name = row.suggested_ledger_name || `${row.broker_symbol}-SH`;
  return {
    tally_ledger_name: name,
    tally_ledger_group: row.suggested_ledger_group || 'INVESTMENT IN SHARES-ZERODHA',
    tally_stock_item_name: row.suggested_stock_item_name || name,
    base_unit: row.base_unit || 'NOS',
    match_source: 'manual',
  };
}

function SearchableLedgerPicker({
  rowKey,
  candidates,
  draft,
  onSelect,
  onClear,
}: {
  rowKey: string;
  candidates: TallyMappingCandidate[];
  draft: MappingDraft | undefined;
  onSelect: (candidate: TallyMappingCandidate) => void;
  onClear: () => void;
}) {
  const selectedCandidate = draft?.tally_ledger_name && draft.tally_ledger_group
    ? { name: draft.tally_ledger_name, group: draft.tally_ledger_group }
    : null;
  const selectedName = selectedCandidate?.name ?? '';
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedName);
  const [visibleLimit, setVisibleLimit] = useState(LEDGER_PICKER_PAGE_SIZE);
  const debouncedQuery = useDebouncedValue(query, LEDGER_PICKER_DEBOUNCE_MS);
  const listboxId = `tally-ledger-options-${rowKey.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const inputValue = open ? query : selectedName;

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = normalizeLedgerSearch(debouncedQuery);
    if (!normalizedQuery) return candidates;

    const queryTerms = normalizedQuery.split(' ').filter(Boolean);
    return candidates.filter((candidate) => {
      const haystack = normalizeLedgerSearch(`${candidate.name} ${candidate.group}`);
      return queryTerms.every((term) => haystack.includes(term));
    });
  }, [candidates, debouncedQuery]);

  const selectedIsInCandidates = selectedCandidate
    ? candidates.some((candidate) => candidateKey(candidate) === candidateKey(selectedCandidate))
    : false;
  const visibleCandidates = filteredCandidates.slice(0, visibleLimit);
  const hasMore = filteredCandidates.length > visibleCandidates.length;

  function handleSelect(candidate: TallyMappingCandidate) {
    onSelect(candidate);
    setQuery(candidate.name);
    setOpen(false);
  }

  return (
    <div className="w-80 max-w-full">
      <div className="relative">
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={inputValue}
          onFocus={() => {
            setQuery(selectedName);
            setVisibleLimit(LEDGER_PICKER_PAGE_SIZE);
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setVisibleLimit(LEDGER_PICKER_PAGE_SIZE);
            setOpen(true);
          }}
          className="h-9 w-full rounded-md border border-hairline-strong bg-card px-3 pr-20 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors placeholder:text-ink-3"
          placeholder="Search Tally ledger..."
        />
        {draft?.tally_ledger_name && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onClear();
              setQuery('');
              setOpen(true);
            }}
            className="absolute right-2 top-1.5 h-6 rounded-sm px-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {draft?.tally_ledger_group && (
        <p className="mt-1 text-xs text-ink-3">{draft.tally_ledger_group}</p>
      )}

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-hairline bg-card e2"
        >
          {selectedCandidate && !selectedIsInCandidates && (
            <button
              type="button"
              role="option"
              aria-selected="true"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(selectedCandidate)}
              className="flex w-full flex-col border-b border-hairline px-3 py-2 text-left text-sm hover:bg-surface-2 transition-colors"
            >
              <span className="font-medium text-ink">{selectedCandidate.name}</span>
              <span className="text-xs text-ink-3">{selectedCandidate.group}</span>
              <span className="mt-1 text-xs font-medium text-primary">Current selection</span>
            </button>
          )}

          {visibleCandidates.length > 0 ? (
            <>
              {visibleCandidates.map((candidate) => {
                const isSelected = selectedCandidate
                  ? candidateKey(candidate) === candidateKey(selectedCandidate)
                  : false;
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    key={candidateKey(candidate)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(candidate)}
                    className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-surface-2 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="font-medium text-ink">{candidate.name}</span>
                    <span className="text-xs text-ink-3">{candidate.group}</span>
                  </button>
                );
              })}
              <div className="border-t border-hairline px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-ink-3">
                    Showing <span className="mono-data">{visibleCandidates.length}</span> of <span className="mono-data">{filteredCandidates.length}</span>
                  </span>
                  {hasMore && (
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setVisibleLimit((current) => current + LEDGER_PICKER_PAGE_SIZE)}
                      className="h-7 rounded-md border border-hairline px-2.5 text-xs font-medium text-ink-2 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors"
                    >
                      Show more
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="px-3 py-4 text-sm text-ink-2">
              No ledger found. Use generated only if this should create a new Tally ledger.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepReviewTallyMatches({
  batchId,
  onBack,
  onProcess,
}: {
  batchId: string | null;
  onBack: () => void;
  onProcess: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<TallyMappingPreviewResponse | null>(null);
  const [drafts, setDrafts] = useState<Map<string, MappingDraft>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (!batchId) {
        setError('No active batch found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/batches/${batchId}/tally-mapping-preview`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to load Tally mapping preview');
        }
        if (cancelled) return;

        const nextPreview = data as TallyMappingPreviewResponse;
        const nextDrafts = new Map<string, MappingDraft>();
        for (const row of nextPreview.rows) {
          if (!row.suggested_ledger_name || !row.suggested_ledger_group) continue;
          nextDrafts.set(mappingRowKey(row), {
            tally_ledger_name: row.suggested_ledger_name,
            tally_ledger_group: row.suggested_ledger_group,
            tally_stock_item_name: row.suggested_stock_item_name || row.suggested_ledger_name,
            base_unit: row.base_unit || 'NOS',
            match_source: sourceFromConfidence(row.confidence),
          });
        }
        setPreview(nextPreview);
        setDrafts(nextDrafts);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Tally mapping preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const rows = preview?.rows ?? [];
  const unresolvedCount = rows.filter((row) => row.status !== 'saved').length;
  const allRowsMapped = rows.length > 0 && rows.every((row) => {
    const draft = drafts.get(mappingRowKey(row));
    return Boolean(
      draft?.tally_ledger_name.trim() &&
        draft.tally_ledger_group.trim() &&
        draft.tally_stock_item_name.trim(),
    );
  });

  function updateDraft(row: TallyMappingPreviewRow, patch: Partial<MappingDraft>) {
    const key = mappingRowKey(row);
    setDrafts((current) => {
      const next = new Map(current);
      const existing = next.get(key) ?? generatedLedgerFor(row);
      next.set(key, { ...existing, ...patch });
      return next;
    });
  }

  function handleCandidateSelect(row: TallyMappingPreviewRow, candidate: TallyMappingCandidate) {
    updateDraft(row, {
      tally_ledger_name: candidate.name,
      tally_ledger_group: candidate.group,
      tally_stock_item_name: candidate.name,
      match_source: 'manual',
    });
  }

  function clearCandidate(row: TallyMappingPreviewRow) {
    updateDraft(row, {
      tally_ledger_name: '',
      tally_ledger_group: '',
      tally_stock_item_name: '',
      match_source: 'manual',
    });
  }

  async function handleSaveAndProcess() {
    if (!allRowsMapped) return;
    setSaving(true);
    setError(null);
    try {
      const mappings = rows.map((row) => {
        const draft = drafts.get(mappingRowKey(row));
        if (!draft) throw new Error(`Missing mapping for ${row.broker_symbol}`);
        return {
          security_id: row.security_id,
          broker_symbol: row.broker_symbol,
          isin: row.isin,
          tally_ledger_name: draft.tally_ledger_name,
          tally_ledger_group: draft.tally_ledger_group,
          tally_stock_item_name: draft.tally_stock_item_name,
          base_unit: draft.base_unit || 'NOS',
          match_source: draft.match_source,
        };
      });

      const res = await fetch('/api/ledger-masters/security-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save Tally mappings');
      }

      await onProcess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Tally mappings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Review Tally Matches</h2>
        <p className="mt-1 text-sm text-ink-2">
          Confirm each broker security against the exact ledger name in your uploaded Tally master.
        </p>
      </div>

      {loading && (
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-neg/30 bg-neg/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-neg mt-0.5 shrink-0" />
          <p className="text-sm text-neg">{error}</p>
        </div>
      )}

      {!loading && preview && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total" value={preview.summary.total} />
            <Stat label="Saved" value={preview.summary.saved} icon={<CheckCircle2 className="h-4 w-4 text-pos" />} />
            <Stat label="Suggested" value={preview.summary.suggested} />
            <Stat label="Needs Input" value={preview.summary.needsReview + preview.summary.missing} icon={<AlertTriangle className="h-4 w-4 text-warn" />} />
          </div>

          {rows.length === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-warn mt-0.5 shrink-0" />
              <p className="text-sm text-warn">
                No traded securities were found in the uploaded files. Upload a Zerodha tradebook before continuing.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-hairline">
              <table className="min-w-full divide-y divide-hairline">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-2">Broker Security</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-2">Tally Ledger</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-2">Stock Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-2">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-ink-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline bg-card">
                  {rows.map((row) => {
                    const key = mappingRowKey(row);
                    const draft = drafts.get(key);

                    return (
                      <tr key={key} className="hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <p className="text-sm font-semibold text-ink mono-data">{row.broker_symbol}</p>
                          <p className="mt-1 text-xs text-ink-3 mono-data">{row.isin ?? row.security_id ?? '-'}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <SearchableLedgerPicker
                            rowKey={key}
                            candidates={row.candidates}
                            draft={draft}
                            onSelect={(candidate) => handleCandidateSelect(row, candidate)}
                            onClear={() => clearCandidate(row)}
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <input
                            value={draft?.tally_stock_item_name ?? ''}
                            onChange={(event) => updateDraft(row, {
                              tally_stock_item_name: event.target.value,
                              match_source: 'manual',
                            })}
                            className="h-9 w-64 rounded-md border border-hairline-strong bg-card px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors placeholder:text-ink-3"
                            placeholder="Stock item name"
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <StatusDot
                            tone={MATCH_STATUS_TONE[row.status]}
                            label={row.status.replace('_', ' ')}
                          />
                          <p className="mt-1 text-xs text-ink-3 mono-data">{row.confidence}</p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <button
                            type="button"
                            onClick={() => updateDraft(row, generatedLedgerFor(row))}
                            className="h-8 rounded-md border border-hairline bg-card px-3 text-xs font-medium text-ink-2 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                          >
                            Use generated
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {unresolvedCount > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warn/30 bg-warn/10 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-warn mt-0.5 shrink-0" />
              <p className="text-sm text-warn">
                First-time matches must be saved before processing. Saved rows will be reused in future imports.
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={saving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={handleSaveAndProcess}
          className="flex-1"
          disabled={!preview || !allRowsMapped || saving || loading}
        >
          {saving ? 'Saving mappings…' : 'Save mappings and process'}
          {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── Corporate Action declaration ─────────────────────────────────────────────

/**
 * Parse a `disposeLots (FIFO): sell quantity exceeds open lots for <id>` error
 * message into its security_id. Returns null when the error is not of the
 * expected shape (e.g. a different pipeline error).
 */
function extractSecurityIdFromDisposeError(message: string | null): string | null {
  if (!message) return null;
  const match = message.match(/exceeds open lots for ([^.\s]+)/i);
  return match ? match[1].trim() : null;
}

type CorporateActionType = 'BONUS' | 'STOCK_SPLIT' | 'RIGHTS_ISSUE' | 'MERGER_DEMERGER';

function CorporateActionForm({
  batchId,
  initialSecurityId,
  onSubmitted,
}: {
  batchId: string;
  initialSecurityId: string;
  onSubmitted: () => void;
}) {
  const [actionType, setActionType] = useState<CorporateActionType>('STOCK_SPLIT');
  const [securityId, setSecurityId] = useState(initialSecurityId);
  const [newSecurityId, setNewSecurityId] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [ratioNum, setRatioNum] = useState('');
  const [ratioDen, setRatioDen] = useState('1');
  const [costPerShare, setCostPerShare] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ratio guide per action type — shown inline to orient the user.
  const RATIO_HINTS: Record<CorporateActionType, string> = {
    BONUS: 'e.g. 1:1 bonus → numerator 2, denominator 1 (total qty doubles)',
    STOCK_SPLIT: 'e.g. 1:5 face-value split → numerator 5, denominator 1 (qty × 5)',
    RIGHTS_ISSUE: 'e.g. 1 right for every 5 held → numerator 1, denominator 5',
    MERGER_DEMERGER: 'ratio of new shares received per old share held',
  };

  const requiresNewIsin = actionType === 'MERGER_DEMERGER' || actionType === 'STOCK_SPLIT';
  const requiresCost = actionType === 'RIGHTS_ISSUE';

  const handleSubmit = async () => {
    setFormError(null);

    if (!securityId.trim() || !actionDate || !ratioNum || !ratioDen) {
      setFormError('Fill in security ID, date, and ratio.');
      return;
    }
    if (requiresCost && !costPerShare) {
      setFormError('Rights issue requires cost per share.');
      return;
    }
    if (actionType === 'MERGER_DEMERGER' && !newSecurityId.trim()) {
      setFormError('Merger requires a new security ID.');
      return;
    }

    setSubmitting(true);
    try {
      // Fetch existing actions first so we append rather than overwrite.
      // The API contract is "POST replaces the full list" — keep older
      // declarations intact when the user adds another one.
      const existingRes = await fetch(`/api/batches/${batchId}/corporate-actions`);
      const existing = existingRes.ok
        ? (await existingRes.json()).corporate_actions ?? []
        : [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newAction: Record<string, any> = {
        action_type: actionType,
        security_id: securityId.trim(),
        action_date: actionDate,
        ratio_numerator: ratioNum,
        ratio_denominator: ratioDen,
      };
      if (newSecurityId.trim()) newAction.new_security_id = newSecurityId.trim();
      if (costPerShare) newAction.cost_per_share = costPerShare;
      if (notes.trim()) newAction.notes = notes.trim();

      const res = await fetch(`/api/batches/${batchId}/corporate-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corporate_actions: [...existing, newAction] }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      onSubmitted();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save corporate action');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
      <div>
        <p className="text-sm font-semibold text-ink">
          Declare a corporate action
        </p>
        <p className="text-xs text-ink-2 mt-1">
          This scrip likely had a bonus, split, rights issue, or merger that
          changed the quantity or ISIN. Declare it and retry so the pipeline
          can migrate cost lots.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-ink-2">Action type</Label>
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value as CorporateActionType)}
          className="w-full rounded-md border border-hairline-strong bg-card px-2 py-1.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-colors"
        >
          <option value="STOCK_SPLIT">Stock split (face value change)</option>
          <option value="BONUS">Bonus issue</option>
          <option value="RIGHTS_ISSUE">Rights issue</option>
          <option value="MERGER_DEMERGER">Merger / demerger</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium text-ink-2">Security ID (old)</Label>
        <Input
          value={securityId}
          onChange={(e) => setSecurityId(e.target.value)}
          placeholder="ISIN:INE123A01036"
          className="text-sm mono-data"
        />
      </div>

      {requiresNewIsin && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-ink-2">
            New security ID {actionType === 'STOCK_SPLIT' ? '(only if ISIN changed)' : ''}
          </Label>
          <Input
            value={newSecurityId}
            onChange={(e) => setNewSecurityId(e.target.value)}
            placeholder="ISIN:INE123A01028"
            className="text-sm mono-data"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-ink-2">Action date</Label>
        <Input
          type="date"
          value={actionDate}
          onChange={(e) => setActionDate(e.target.value)}
          className="text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-ink-2">Ratio numerator</Label>
          <Input
            value={ratioNum}
            onChange={(e) => setRatioNum(e.target.value)}
            placeholder="5"
            className="text-sm mono-data"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-medium text-ink-2">Ratio denominator</Label>
          <Input
            value={ratioDen}
            onChange={(e) => setRatioDen(e.target.value)}
            placeholder="1"
            className="text-sm mono-data"
          />
        </div>
      </div>
      <p className="text-xs text-ink-3">{RATIO_HINTS[actionType]}</p>

      {requiresCost && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-ink-2">Cost per share</Label>
          <Input
            value={costPerShare}
            onChange={(e) => setCostPerShare(e.target.value)}
            placeholder="100"
            className="text-sm mono-data"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs font-medium text-ink-2">Notes (optional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. IRCTC 1:5 face value split"
          className="text-sm"
        />
      </div>

      {formError && (
        <p className="text-xs text-neg">{formError}</p>
      )}

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full"
      >
        {submitting ? 'Saving…' : 'Save and retry processing'}
      </Button>
    </div>
  );
}

// ─── Step 4: Processing ───────────────────────────────────────────────────────

function StepProcessing({
  batchStatus,
  errorMessage,
  errorCode,
  batchId,
  onRetry,
  onRetryWithStrategy,
}: {
  batchStatus: 'running' | 'failed';
  errorMessage: string | null;
  errorCode: string | null;
  batchId: string | null;
  onRetry: () => void;
  onRetryWithStrategy: (strategy: 'ASSUME_ALL_EQ_INVESTMENT' | 'HEURISTIC_SAME_DAY_FLAT_INTRADAY') => void;
}) {
  const isClassificationAmbiguous = errorCode === 'E_CLASSIFICATION_AMBIGUOUS';
  const disposeLotsSecurityId = extractSecurityIdFromDisposeError(errorMessage);
  const isDisposeLotsError = disposeLotsSecurityId !== null && batchId !== null;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink">Processing</h2>
        <p className="text-sm text-ink-2 mt-1">
          {batchStatus === 'running'
            ? 'Please wait while we process your files…'
            : 'An error occurred during processing.'}
        </p>
      </div>

      {batchStatus === 'running' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          {/* Skeleton shimmer to indicate progress */}
          <div className="space-y-3 w-full max-w-xs">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
            <Skeleton className="h-3 w-2/3 rounded-full" />
          </div>
          <p className="text-sm text-ink-2">Processing your files…</p>
          <p className="text-xs text-ink-3">This usually takes a few seconds.</p>
        </div>
      )}

      {batchStatus === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-xl border border-neg/30 bg-neg/10 px-4 py-3">
            <AlertCircle className="h-4 w-4 text-neg mt-0.5 shrink-0" />
            <p className="text-sm text-neg">{errorMessage ?? 'Processing failed. Please try again.'}</p>
          </div>

          {isClassificationAmbiguous ? (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">
                  Choose how to classify these trades
                </p>
                <p className="text-xs text-ink-2 mt-1">
                  Your tradebook doesn&apos;t carry the Zerodha product column
                  (CNC/MIS/NRML), so we&apos;ll process equity as investment for now.
                </p>
              </div>
              <Button
                onClick={() => onRetryWithStrategy('ASSUME_ALL_EQ_INVESTMENT')}
                className="w-full"
              >
                Retry as Investor — treat equity as investment
              </Button>
            </div>
          ) : isDisposeLotsError ? (
            <>
              <CorporateActionForm
                batchId={batchId!}
                initialSecurityId={disposeLotsSecurityId!}
                onSubmitted={onRetry}
              />
              <Button
                onClick={onRetry}
                variant="outline"
                className="w-full"
              >
                Retry without declaring
              </Button>
            </>
          ) : (
            <Button
              onClick={onRetry}
              className="w-full"
            >
              Try Again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step 5: Results ──────────────────────────────────────────────────────────

function StepResults({
  result,
  onStartOver,
  companyName,
  periodFrom,
  periodTo,
}: {
  result: ProcessingResult;
  onStartOver: () => void;
  companyName: string;
  periodFrom: string;
  periodTo: string;
}) {
  const router = useRouter();
  const [downloadedMasters, setDownloadedMasters] = useState(false);
  const [downloadedTransactions, setDownloadedTransactions] = useState(false);
  const hasDownloaded = downloadedMasters && downloadedTransactions;

  useEffect(() => {
    if (hasDownloaded) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDownloaded]);

  function handleNavAway(href: string) {
    if (
      !hasDownloaded &&
      !confirm(
        "Download both XML files before leaving. Import 01 masters first, then 02 transactions, so Tally receives ledgers before vouchers.",
      )
    ) return;
    router.push(href);
  }

  const { mastersFilename, transactionsFilename } = buildTallyImportArtifactNames(
    companyName,
    periodFrom,
    periodTo,
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            Import Complete — Review &amp; Download
          </h2>
          <p className="text-sm text-ink-2 mt-1">
            Review your reconciliation summary and download the output files.
          </p>
          <p className="text-xs text-ink-3 mono-data mt-0.5">Batch: {result.batchId}</p>
        </div>
        <div className="flex items-center gap-1.5 text-pos bg-pos/10 border border-pos/20 rounded-full px-3 py-1.5 shrink-0">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          <span className="text-xs font-semibold">Processed</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Trades Parsed" value={result.tradeCount} sub="from tradebook CSV" />
        <Stat label="Accounting Events" value={result.eventCount} sub="buys, sells & actions" />
        <Stat label="Vouchers" value={result.voucherCount} sub="ready for Tally" icon={<FileText className="h-4 w-4" />} />
        <Stat label="Ledgers" value={result.ledgerCount} sub="scrip / account defs" icon={<CheckCircle2 className="h-4 w-4 text-pos" />} />
      </div>

      {/* Reconciliation checks */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-2 uppercase tracking-wide">
          Reconciliation Checks
        </p>
        <p className="text-xs text-ink-3 mt-0.5 mb-1">
          Warnings are informational — your Tally XML is ready to import regardless.
        </p>
        <div className="space-y-2">
          {result.checks.map((check) => {
            const isPass = check.status === "PASSED";
            const isWarn = check.status === "WARNING";
            return (
              <div
                key={check.check_name}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                  isPass
                    ? "border-pos/20 bg-pos/5"
                    : isWarn
                      ? "border-warn/20 bg-warn/5"
                      : "border-neg/20 bg-neg/5"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isPass ? "bg-pos" : isWarn ? "bg-warn" : "bg-neg"
                }`}>
                  {isPass ? (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${
                    isPass ? "text-pos" : isWarn ? "text-warn" : "text-neg"
                  }`}>
                    {check.check_name}
                    <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full border bg-card/60 ${
                      isPass ? "border-pos/20 text-pos" : isWarn ? "border-warn/20 text-warn" : "border-neg/20 text-neg"
                    }`}>
                      {check.status}
                    </span>
                  </p>
                  <p className={`text-xs mt-0.5 ${
                    isPass ? "text-pos" : isWarn ? "text-warn" : "text-neg"
                  }`}>
                    {check.details}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downloads */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-ink-2 uppercase tracking-wide">
          Download Tally XML Files
        </p>
        <div className="rounded-xl border border-warn/20 bg-warn/5 px-4 py-4">
          <p className="text-sm font-semibold text-warn">
            Import order is mandatory for a clean Tally import.
          </p>
          <div className="mt-3 space-y-2">
            {TALLY_IMPORT_STEPS.map((step, idx) => (
              <div key={step.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warn text-[11px] font-semibold text-white mono-data">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">{step.title}</p>
                  <p className="text-xs text-ink-2">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => {
              downloadXml(result.mastersXml, mastersFilename);
              setDownloadedMasters(true);
            }}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-card px-4 py-3 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">
                Masters XML
              </p>
              <p className="text-xs text-ink-2">
                Required first: ledger definitions, groups, stock items
              </p>
            </div>
            {downloadedMasters ? (
              <span className="rounded-full border border-pos/20 bg-pos/10 px-2 py-0.5 text-xs font-semibold text-pos shrink-0">
                Downloaded
              </span>
            ) : (
              <Download className="h-4 w-4 text-ink-3 group-hover:text-primary transition-colors shrink-0" />
            )}
          </button>

          <button
            onClick={() => {
              if (!downloadedMasters) return;
              downloadXml(result.transactionsXml, transactionsFilename);
              setDownloadedTransactions(true);
            }}
            disabled={!downloadedMasters}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors group ${
              downloadedMasters
                ? "border-hairline bg-card hover:border-primary/30 hover:bg-primary/5"
                : "cursor-not-allowed border-hairline bg-surface-2 opacity-60"
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-ink-2" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink group-hover:text-primary transition-colors">
                Transactions XML
              </p>
              <p className="text-xs text-ink-2">
                {downloadedMasters
                  ? <><span className="mono-data">{result.voucherCount}</span> voucher entries ready for import</>
                  : "Available after downloading 01 masters first"}
              </p>
            </div>
            {downloadedTransactions ? (
              <span className="rounded-full border border-pos/20 bg-pos/10 px-2 py-0.5 text-xs font-semibold text-pos shrink-0">
                Downloaded
              </span>
            ) : downloadedMasters ? (
              <Download className="h-4 w-4 text-ink-3 group-hover:text-primary transition-colors shrink-0" />
            ) : (
              <X className="h-4 w-4 text-ink-3 shrink-0" />
            )}
          </button>
        </div>

        <p className="text-xs text-ink-3">
          Download both files now. The 01/02 prefixes are intentional and match the Tally import order: masters first, transactions second.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => handleNavAway('/batches')}
          className="flex-1 inline-flex h-9 items-center justify-center rounded-md border border-hairline bg-card text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          View in Batches &rarr;
        </button>
        <button
          onClick={() => handleNavAway('/dashboard')}
          className="flex-1 inline-flex h-9 items-center justify-center rounded-md border border-hairline bg-card text-sm font-medium text-ink transition-colors hover:bg-surface-2"
        >
          View Dashboard
        </button>
        <Button
          onClick={onStartOver}
          className="flex-1"
        >
          Start New Import
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<UploadFormData>({
    accountingMode: "investor",
    companyName: "",
    periodFrom: "",
    periodTo: "",
  });
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);

  const hook = useBatchUpload();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const handleFormChange = (data: Partial<UploadFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // Create batch when entering step 2
  useEffect(() => {
    if (step === 2) {
      const config: BatchUploadConfig = {
        companyName: formData.companyName,
        accountingMode: formData.accountingMode,
        periodFrom: formData.periodFrom || undefined,
        periodTo: formData.periodTo || undefined,
      };
      hook.createBatch(config);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleProcess = useCallback(async () => {
    setStep(4);
    const result = await hook.startProcessing();
    if (result) {
      setProcessingResult(result);
      setStep(5);
    }
    // If result is null, batchStatus is 'failed' and StepProcessing shows error
  }, [hook]);

  const handleRetryProcessing = useCallback(async () => {
    const result = await hook.startProcessing();
    if (result) {
      setProcessingResult(result);
      setStep(5);
    }
  }, [hook]);

  const handleRetryWithStrategy = useCallback(async (
    strategy: 'ASSUME_ALL_EQ_INVESTMENT' | 'HEURISTIC_SAME_DAY_FLAT_INTRADAY',
  ) => {
    const result = await hook.startProcessing({ classificationStrategy: strategy });
    if (result) {
      setProcessingResult(result);
      setStep(5);
    }
  }, [hook]);

  useEffect(() => {
    if (
      step === 4 &&
      hook.state.batchStatus === 'failed' &&
      hook.state.errorCode === 'E_TALLY_STOCK_MAPPING_UNRESOLVED'
    ) {
      setStep(3);
    }
  }, [hook.state.batchStatus, hook.state.errorCode, step]);

  const handleReset = () => {
    hook.reset();
    setStep(1);
    setFormData({
      accountingMode: "investor",
      companyName: "",
      periodFrom: "",
      periodTo: "",
    });
    setProcessingResult(null);
  };

  return (
    <div className="min-h-full bg-background px-6 py-6">
      {/* Page header */}
      <div className="mb-8 rounded-xl border border-hairline bg-card e1 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Upload-first workflow
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">New Import</h1>
        <p className="mt-1 text-sm text-ink-2">
          Convert Zerodha exports into reconciled, Tally-importable XML.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">Investor mode</span>
          <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">Exception-first review</span>
          <span className="rounded-full border border-hairline bg-surface-2 px-3 py-1 text-xs font-medium text-ink-2">Tally Prime / ERP 9 XML</span>
        </div>
      </div>

      <div className="mb-8 flex justify-center">
        <StepIndicator current={step} total={STEPS} />
      </div>

      <Card ref={cardRef} className="border-hairline bg-card e1">
        <CardContent className="px-8 py-8">
          {step === 1 && (
            <StepConfigure
              formData={formData}
              onChange={handleFormChange}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepUpload
              batchUpload={hook}
              onBack={() => { hook.reset(); setStep(1); }}
              onReview={() => setStep(3)}
              formData={formData}
              onFormChange={handleFormChange}
            />
          )}
          {step === 3 && (
            <StepReviewTallyMatches
              batchId={hook.state.batchId}
              onBack={() => setStep(2)}
              onProcess={handleProcess}
            />
          )}
          {step === 4 && (
            <StepProcessing
              batchStatus={hook.state.batchStatus === 'running' ? 'running' : 'failed'}
              errorMessage={hook.state.error}
              errorCode={hook.state.errorCode}
              batchId={hook.state.batchId}
              onRetry={handleRetryProcessing}
              onRetryWithStrategy={handleRetryWithStrategy}
            />
          )}
          {step === 5 && processingResult && (
            <StepResults
              result={processingResult}
              onStartOver={handleReset}
              companyName={formData.companyName}
              periodFrom={formData.periodFrom}
              periodTo={formData.periodTo}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
