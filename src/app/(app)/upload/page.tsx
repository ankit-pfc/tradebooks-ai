"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { FileUploadStatus } from "@/components/upload/file-upload-status";
import { useBatchUpload, type ProcessingResult, type BatchUploadConfig } from "@/hooks/use-batch-upload";

// ─── Types ─────────────────────────────────────────────────────────────────

type AccountingMode = "investor" | "trader";

interface PriorBatch {
  id: string;
  company_name: string;
  period_from: string;
  period_to: string;
  fy_label?: string | null;
}

interface UploadFormData {
  accountingMode: AccountingMode;
  companyName: string;
  periodFrom: string;
  periodTo: string;
  priorBatchId: string;
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

function toFilenameSafe(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function deriveFYSuffix(from: string, to: string): string {
  if (!from || !to) return '';
  const fromYear = new Date(from).getFullYear();
  const toYear = new Date(to).getFullYear();
  if (isNaN(fromYear) || isNaN(toYear)) return '';
  return `FY${fromYear}-${String(toYear).slice(2)}`;
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
  { num: 3, label: "Processing" },
  { num: 4, label: "Results" },
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
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${isCompleted
                  ? "bg-indigo-600 text-white"
                  : isActive
                    ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                    : "bg-gray-100 text-gray-400"
                  }`}
              >
                {isCompleted ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-sm mt-2 font-medium whitespace-nowrap ${isActive
                  ? "text-indigo-700"
                  : isCompleted
                    ? "text-gray-700"
                    : "text-gray-400"
                  }`}
              >
                {step.label}
              </span>
            </div>
            {idx < total.length - 1 && (
              <div
                className={`w-20 sm:w-28 h-0.5 mb-5 mx-1 transition-colors ${current > step.num ? "bg-indigo-600" : "bg-gray-200"
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
  "h-10 w-full rounded-lg border border-gray-200 bg-transparent px-2.5 py-1.5 text-base outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/20";

function StepConfigure({
  formData,
  onChange,
  onNext,
}: {
  formData: UploadFormData;
  onChange: (data: Partial<UploadFormData>) => void;
  onNext: () => void;
}) {
  const [priorBatches, setPriorBatches] = useState<PriorBatch[]>([]);
  const [loadingPrior, setLoadingPrior] = useState(false);
  const [customRangeActive, setCustomRangeActive] = useState(false);
  const isCustomRange = customRangeActive || getSelectedPeriodValue(formData.periodFrom, formData.periodTo) === CUSTOM_RANGE_VALUE;
  const hasPeriodError = isCustomRange && !isValidDateRange(formData.periodFrom, formData.periodTo);

  // Fetch prior batches when company name changes (debounced)
  useEffect(() => {
    const name = formData.companyName.trim();
    const timer = setTimeout(() => {
      if (!name) {
        setPriorBatches([]);
        return;
      }
      setLoadingPrior(true);
      fetch(`/api/batches/prior?company_name=${encodeURIComponent(name)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.batches) setPriorBatches(data.batches);
        })
        .catch(() => { /* ignore */ })
        .finally(() => setLoadingPrior(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.companyName]);

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Import Configuration
        </h2>
        <p className="text-base text-gray-700 mt-1">
          Set up your accounting parameters before uploading files.
        </p>
      </div>

      {/* Accounting Mode */}
      <div className="space-y-3">
        <Label className="text-base font-medium text-gray-800">
          Accounting Mode
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              {
                value: "investor",
                label: "Investor",
                desc: "Long-term holdings, LTCG/STCG tax treatment",
              },
              {
                value: "trader",
                label: "Trader",
                desc: "Frequent trading, business income treatment",
              },
            ] as const
          ).map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onChange({ accountingMode: mode.value })}
              className={`flex flex-col items-start rounded-lg border p-4 text-left transition-all cursor-pointer ${formData.accountingMode === mode.value
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                : "border-gray-200 bg-white hover:border-gray-300"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.accountingMode === mode.value
                    ? "border-indigo-600"
                    : "border-gray-300"
                    }`}
                >
                  {formData.accountingMode === mode.value && (
                    <div className="w-2 h-2 rounded-full bg-indigo-600" />
                  )}
                </div>
                <span className="text-base font-semibold text-gray-900">
                  {mode.label}
                </span>
              </div>
              <p className="text-sm text-gray-600 pl-6">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Company Name */}
      <div className="space-y-1.5">
        <Label htmlFor="company-name" className="text-base font-medium text-gray-800">
          Company Name in Tally
        </Label>
        <Input
          id="company-name"
          placeholder="e.g. Rajesh Kumar &amp; Associates"
          value={formData.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          className="border-gray-200"
        />
        <p className="text-sm text-gray-600">
          This name will appear in the imported Tally XML. Tally will create or use an existing company with this name — there&apos;s no validation against your Tally data.
        </p>
      </div>

      {/* Period */}
      <div className="space-y-1.5">
        <Label className="text-base font-medium text-gray-800">
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
              <Label htmlFor="period-from" className="text-sm font-medium text-gray-700">
                From
              </Label>
              <Input
                id="period-from"
                type="date"
                value={formData.periodFrom}
                onChange={(e) => onChange({ periodFrom: e.target.value })}
                className="border-gray-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-to" className="text-sm font-medium text-gray-700">
                To
              </Label>
              <Input
                id="period-to"
                type="date"
                value={formData.periodTo}
                onChange={(e) => onChange({ periodTo: e.target.value })}
                className="border-gray-200"
              />
            </div>
          </div>
        )}

        {hasPeriodError && (
          <p className="text-sm text-red-600">
            Enter both dates and make sure the From date is earlier than the To date.
          </p>
        )}
      </div>

      {/* Prior Batch (Opening Balances) */}
      {priorBatches.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="prior-batch" className="text-base font-medium text-gray-800">
            Carry Forward from Prior Period (Optional)
          </Label>
          <select
            id="prior-batch"
            className={SELECT_CLASSES}
            value={formData.priorBatchId}
            onChange={(e) => onChange({ priorBatchId: e.target.value })}
          >
            <option value="">Start fresh (no opening balances)</option>
            {priorBatches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.fy_label ? `FY ${b.fy_label}` : `${b.period_from} to ${b.period_to}`}
                {` — ${b.company_name}`}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600">
            {loadingPrior
              ? "Loading prior batches..."
              : "Select a previous batch to carry forward its closing stock positions as opening balances for this period. Use this when importing month-by-month or quarter-by-quarter so each period picks up where the last left off."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm font-medium text-gray-700">Multi-period imports</p>
          <p className="text-sm text-gray-600 mt-0.5">
            After your first completed import, you can link subsequent periods here to carry forward closing holdings automatically.
          </p>
        </div>
      )}

      <div className="pt-2">
        <Button
          onClick={onNext}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!formData.companyName.trim() || !formData.periodFrom || !formData.periodTo || !isValidDateRange(formData.periodFrom, formData.periodTo)}
        >
          Continue to File Upload
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
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
  Required: "bg-red-50 text-red-600 border-red-200",
  Recommended: "bg-amber-50 text-amber-700 border-amber-200",
  Optional: "bg-gray-50 text-gray-600 border-gray-200",
};

function StepUpload({
  batchUpload,
  onBack,
  onProcess,
  formData,
  onFormChange,
}: {
  batchUpload: ReturnType<typeof useBatchUpload>;
  onBack: () => void;
  onProcess: () => Promise<void>;
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
        <h2 className="text-xl font-bold text-gray-900">Upload Files</h2>
        <p className="text-base text-gray-700 mt-1">
          Upload your Zerodha export files. At minimum, a Tradebook file is required.
        </p>
      </div>

      {/* Configuration summary */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
        {!editingFY ? (
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-indigo-700">
                {formatFYLabel(formData.periodFrom, formData.periodTo)}
              </span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-600 capitalize">{formData.accountingMode} mode</span>
              {formData.companyName && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">{formData.companyName}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditingFY(true)}
              className="text-sm text-indigo-600 hover:underline shrink-0 ml-3"
            >
              Edit period
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2">
            <select
              className="h-9 rounded-lg border border-indigo-200 bg-white px-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                  className="h-9 border-indigo-200 bg-white text-sm"
                />
                <Input
                  type="date"
                  value={formData.periodTo}
                  onChange={(e) => onFormChange({ periodTo: e.target.value })}
                  className="h-9 border-indigo-200 bg-white text-sm"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setEditingFY(false)}
              className="text-sm text-gray-600 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
        {hasPeriodError && (
          <p className="mt-2 text-sm text-red-600">
            Enter both dates and make sure the From date is earlier than the To date.
          </p>
        )}
      </div>

      {/* File requirements table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Required &amp; Recommended Files
          </p>
        </div>
        <div className="divide-y divide-gray-100">
          {FILE_REQUIREMENTS.map((req) => (
            <div
              key={req.type}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-base font-medium text-gray-800">{req.type}</p>
                <p className="text-sm text-gray-600 mt-0.5">{req.note}</p>
              </div>
              <span
                className={`text-sm font-medium px-3 py-1.5 rounded-full border ${STATUS_BADGE[req.status]}`}
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
          <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Files ({fileList.length})
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
                duplicateWarning={fs.duplicateWarning}
                onRemove={() => batchUpload.removeFile(fs.file)}
                onRetry={() => batchUpload.retryFile(fs.file)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Failed files skip notice */}
      {failedCount > 0 && hasUploaded && !hasInFlight && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600 mt-0.5 shrink-0"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-amber-700">
            {failedCount} file{failedCount > 1 ? 's' : ''} failed to upload and will be skipped. You can retry or remove them above.
          </p>
        </div>
      )}

      {/* Validation: tradebook required */}
      {fileList.length > 0 && !hasTradebook && hasUploaded && !hasInFlight && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-600 mt-0.5 shrink-0"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm text-amber-700">
            A <strong>Tradebook</strong> file is required to proceed. Please upload it from Zerodha Console → Reports → Tradebook.
          </p>
        </div>
      )}

      {/* Global batch error */}
      {state.error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-gray-200 text-gray-700"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </Button>
        <Button
          onClick={onProcess}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!canProcess || !hasTradebook}
        >
          Process Files
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-2"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Processing ───────────────────────────────────────────────────────

function StepProcessing({
  batchStatus,
  errorMessage,
  onRetry,
}: {
  batchStatus: 'running' | 'failed';
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Processing</h2>
        <p className="text-base text-gray-700 mt-1">
          {batchStatus === 'running'
            ? 'Please wait while we process your files…'
            : 'An error occurred during processing.'}
        </p>
      </div>

      {batchStatus === 'running' && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-base text-gray-600">Processing your files…</p>
          <p className="text-sm text-gray-500">This usually takes a few seconds.</p>
        </div>
      )}

      {batchStatus === 'failed' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-500 mt-0.5 shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-sm text-red-700">{errorMessage ?? 'Processing failed. Please try again.'}</p>
          </div>
          <Button
            onClick={onRetry}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Results ──────────────────────────────────────────────────────────

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
  const [hasDownloaded, setHasDownloaded] = useState(false);

  useEffect(() => {
    if (hasDownloaded) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDownloaded]);

  function handleNavAway(href: string) {
    if (!hasDownloaded && !confirm('Download your XML files before leaving? You can also re-download anytime from the Batches page.')) return;
    router.push(href);
  }

  const fySuffix = deriveFYSuffix(periodFrom, periodTo);
  const safeCompany = toFilenameSafe(companyName);
  const mastersFilename = safeCompany && fySuffix
    ? `${safeCompany}_Ledger_Masters_${fySuffix}.xml`
    : 'tally-masters.xml';
  const transactionsFilename = safeCompany && fySuffix
    ? `${safeCompany}_Transactions_${fySuffix}.xml`
    : 'tally-transactions.xml';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Import Complete — Review &amp; Download
          </h2>
          <p className="text-base text-gray-700 mt-1">
            Review your reconciliation summary and download the output files.
          </p>
          <p className="text-base text-gray-700">Batch: {result.batchId}</p>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-semibold">Processed</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Trades Parsed", sub: "from your tradebook CSV", value: result.tradeCount, color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
          { label: "Accounting Events", sub: "buys, sells & corporate actions", value: result.eventCount, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Vouchers", sub: "ready to import into Tally", value: result.voucherCount, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
          { label: "Ledgers", sub: "scrip/account definitions", value: result.ledgerCount, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border px-4 py-4 text-center ${item.bg}`}
          >
            <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
            <p className={`text-sm font-medium mt-0.5 ${item.color}`}>
              {item.label}
            </p>
            <p className={`text-xs mt-0.5 opacity-70 ${item.color}`}>
              {item.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Reconciliation checks */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Reconciliation Checks
        </p>
        <p className="text-xs text-gray-400 mt-0.5 mb-1">
          Warnings are informational — your Tally XML is ready to import regardless.
        </p>
        <div className="space-y-2">
          {result.checks.map((check) => {
            const isPass = check.status === "PASSED";
            const isWarn = check.status === "WARNING";
            return (
              <div
                key={check.check_name}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${isPass
                  ? "border-emerald-200 bg-emerald-50"
                  : isWarn
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
                  }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isPass ? "bg-emerald-500" : isWarn ? "bg-amber-500" : "bg-red-500"
                  }`}>
                  {isPass ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-base font-semibold ${isPass ? "text-emerald-700" : isWarn ? "text-amber-700" : "text-red-700"
                    }`}>
                    {check.check_name}
                    <span className="ml-2 text-sm font-medium px-3 py-1 rounded-full border bg-white/60">
                      {check.status}
                    </span>
                  </p>
                  <p className={`text-sm mt-0.5 ${isPass ? "text-emerald-600" : isWarn ? "text-amber-600" : "text-red-600"
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
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Download Tally XML Files
        </p>
        <div className="grid grid-cols-2 gap-3">
          {result.mastersArtifactId ? (
            <a
              href={`/api/artifacts/${result.batchId}/${result.mastersArtifactId}`}
              download={mastersFilename}
              onClick={() => setHasDownloaded(true)}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
            >
              <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Masters XML
                </p>
                <p className="text-sm text-gray-600">
                  Ledger definitions &amp; groups ({result.ledgerCount} ledgers)
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          ) : (
            <button
              onClick={() => { downloadXml(result.mastersXml, mastersFilename); setHasDownloaded(true); }}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
            >
              <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Masters XML
                </p>
                <p className="text-sm text-gray-600">
                  Ledger definitions &amp; groups ({result.ledgerCount} ledgers)
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {result.transactionsArtifactId ? (
            <a
              href={`/api/artifacts/${result.batchId}/${result.transactionsArtifactId}`}
              download={transactionsFilename}
              onClick={() => setHasDownloaded(true)}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
            >
              <div className="w-11 h-11 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Transactions XML
                </p>
                <p className="text-sm text-gray-600">
                  {result.voucherCount} vouchers (Purchase &amp; Sales)
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          ) : (
            <button
              onClick={() => { downloadXml(result.transactionsXml, transactionsFilename); setHasDownloaded(true); }}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors group"
            >
              <div className="w-11 h-11 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-base font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">
                  Transactions XML
                </p>
                <p className="text-sm text-gray-600">
                  {result.voucherCount} vouchers (Purchase &amp; Sales)
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Files are also saved and re-downloadable anytime from the Batches page.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => handleNavAway('/batches')}
          className="flex-1 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          View in Batches &rarr;
        </button>
        <button
          onClick={() => handleNavAway('/dashboard')}
          className="flex-1 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          View Dashboard
        </button>
        <Button
          onClick={onStartOver}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
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
    priorBatchId: "",
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
        priorBatchId: formData.priorBatchId || undefined,
      };
      hook.createBatch(config);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleProcess = useCallback(async () => {
    setStep(3);
    const result = await hook.startProcessing();
    if (result) {
      setProcessingResult(result);
      setStep(4);
    }
    // If result is null, batchStatus is 'failed' and StepProcessing shows error
  }, [hook]);

  const handleRetryProcessing = useCallback(async () => {
    const result = await hook.startProcessing();
    if (result) {
      setProcessingResult(result);
      setStep(4);
    }
  }, [hook]);

  const handleReset = () => {
    hook.reset();
    setStep(1);
    setFormData({
      accountingMode: "investor",
      companyName: "",
      periodFrom: "",
      periodTo: "",
      priorBatchId: "",
    });
    setProcessingResult(null);
  };

  return (
    <div className="min-h-full bg-slate-50 px-6 py-8 sm:px-8">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
          Upload-first workflow
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">New Import</h1>
        <p className="mt-1 text-base text-slate-700">
          Convert Zerodha exports into reconciled, Tally-importable XML.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5">Investor / Trader mode</span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5">Exception-first review</span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5">Tally Prime / ERP 9 XML</span>
        </div>
      </div>

      <div className="mb-10 flex justify-center">
        <StepIndicator current={step} total={STEPS} />
      </div>

      <Card ref={cardRef} className="border-slate-200 bg-white shadow-sm">
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
              onProcess={handleProcess}
              formData={formData}
              onFormChange={handleFormChange}
            />
          )}
          {step === 3 && (
            <StepProcessing
              batchStatus={hook.state.batchStatus === 'running' ? 'running' : 'failed'}
              errorMessage={hook.state.error}
              onRetry={handleRetryProcessing}
            />
          )}
          {step === 4 && processingResult && (
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
