"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { FileDropzone } from "@/components/upload/file-dropzone";

// ─── Types ─────────────────────────────────────────────────────────────────

type AccountingMode = "investor" | "trader";

type FileType =
  | "Tradebook"
  | "Funds Statement"
  | "Holdings"
  | "Contract Note"
  | "Unknown";

interface UploadedFile {
  id: string;
  file: File;
  detectedType: FileType;
}

type ProcessingStatus = "pending" | "running" | "done" | "error";

interface ProcessingStep {
  id: string;
  label: string;
  status: ProcessingStatus;
}

interface PriorBatch {
  id: string;
  company_name: string;
  period_from: string;
  period_to: string;
  fy_label?: string | null;
}

interface FormData {
  accountingMode: AccountingMode;
  companyName: string;
  periodFrom: string;
  periodTo: string;
  priorBatchId: string;
}

interface ProcessingResult {
  batchId: string;
  tradeCount: number;
  eventCount: number;
  voucherCount: number;
  ledgerCount: number;
  checks: Array<{
    check_name: string;
    status: "PASSED" | "FAILED" | "WARNING";
    details: string;
  }>;
  summary: { passed: number; warnings: number; failed: number };
  mastersXml: string;
  transactionsXml: string;
  mastersArtifactId?: string;
  transactionsArtifactId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function detectFileType(filename: string): FileType {
  const lower = filename.toLowerCase();
  if (lower.includes("tradebook") || lower.includes("trade_book"))
    return "Tradebook";
  if (
    lower.includes("fund") ||
    lower.includes("ledger") ||
    lower.includes("statement")
  )
    return "Funds Statement";
  if (lower.includes("holding")) return "Holdings";
  if (lower.includes("contract") || lower.includes("note"))
    return "Contract Note";
  return "Unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const FILE_TYPE_BADGE: Record<FileType, string> = {
  Tradebook: "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Funds Statement": "bg-blue-100 text-blue-700 border-blue-200",
  Holdings: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Contract Note": "bg-violet-100 text-violet-700 border-violet-200",
  Unknown: "bg-gray-100 text-gray-600 border-gray-200",
};

const INITIAL_STEPS: ProcessingStep[] = [
  { id: "parse", label: "Parsing uploaded files", status: "pending" },
  { id: "events", label: "Building financial events", status: "pending" },
  { id: "vouchers", label: "Generating Tally vouchers", status: "pending" },
  { id: "reconcile", label: "Reconciling transactions", status: "pending" },
  { id: "xml", label: "Generating Tally XML", status: "pending" },
];

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
  formData: FormData;
  onChange: (data: Partial<FormData>) => void;
  onNext: () => void;
}) {
  const [priorBatches, setPriorBatches] = useState<PriorBatch[]>([]);
  const [loadingPrior, setLoadingPrior] = useState(false);

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
        <p className="text-base text-gray-600 mt-1">
          Set up your accounting parameters before uploading files.
        </p>
      </div>

      {/* Accounting Mode */}
      <div className="space-y-3">
        <Label className="text-base font-medium text-gray-700">
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
        <Label htmlFor="company-name" className="text-base font-medium text-gray-700">
          Tally Company Name
        </Label>
        <Input
          id="company-name"
          placeholder="e.g. Rajesh Kumar &amp; Associates"
          value={formData.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          className="border-gray-200"
        />
        <p className="text-sm text-gray-500">
          Must match exactly as configured in your Tally company.
        </p>
      </div>

      {/* Period */}
      <div className="space-y-1.5">
        <Label className="text-base font-medium text-gray-700">
          Financial Period
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="period-from" className="text-sm text-gray-600">
              From
            </Label>
            <Input
              id="period-from"
              type="date"
              value={formData.periodFrom}
              onChange={(e) => onChange({ periodFrom: e.target.value })}
              className="border-gray-200 text-base"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to" className="text-sm text-gray-600">
              To
            </Label>
            <Input
              id="period-to"
              type="date"
              value={formData.periodTo}
              onChange={(e) => onChange({ periodTo: e.target.value })}
              className="border-gray-200 text-base"
            />
          </div>
        </div>
        <p className="text-sm text-gray-500">
          Typically the Indian financial year: 01 Apr – 31 Mar.
        </p>
      </div>

      {/* Prior Batch (Opening Balances) */}
      {priorBatches.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="prior-batch" className="text-base font-medium text-gray-700">
            Opening Balances (Optional)
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
          <p className="text-sm text-gray-500">
            {loadingPrior
              ? "Loading prior batches..."
              : "Carry forward closing cost lots from a prior financial year."}
          </p>
        </div>
      )}

      <div className="pt-2">
        <Button
          onClick={onNext}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!formData.companyName.trim()}
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
  files,
  onFilesAdded,
  onRemoveFile,
  onBack,
  onNext,
}: {
  files: UploadedFile[];
  onFilesAdded: (f: File[]) => void;
  onRemoveFile: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const hasTradebook = files.some((f) => f.detectedType === "Tradebook");

  const rawFiles = files.map((uf) => uf.file);

  const handleDropzoneFileRemoved = (index: number) => {
    const targetFile = files[index];
    if (targetFile) {
      onRemoveFile(targetFile.id);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Upload Files</h2>
        <p className="text-base text-gray-600 mt-1">
          Upload your Zerodha export files. At minimum, a Tradebook file is required.
        </p>
      </div>

      {/* File requirements table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
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
                <p className="text-sm text-gray-500 mt-0.5">{req.note}</p>
              </div>
              <span
                className={`text-sm font-medium px-3 py-1.5 rounded-full border ${STATUS_BADGE[req.status]
                  }`}
              >
                {req.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Dropzone */}
      <FileDropzone
        onFilesAdded={onFilesAdded}
        files={rawFiles}
        onFileRemoved={handleDropzoneFileRemoved}
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Uploaded Files ({files.length})
          </p>
          <div className="space-y-2">
            {files.map((uf) => (
              <div
                key={uf.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
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
                    className="text-gray-600"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-900 truncate">
                    {uf.file.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatBytes(uf.file.size)}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium px-3 py-1.5 rounded-full border whitespace-nowrap ${FILE_TYPE_BADGE[uf.detectedType]
                    }`}
                >
                  {uf.detectedType}
                </span>
                <button
                  onClick={() => onRemoveFile(uf.id)}
                  className="ml-1 w-8 h-8 rounded-md flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                  aria-label="Remove file"
                >
                  <svg
                    width="14"
                    height="14"
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation message */}
      {files.length > 0 && !hasTradebook && (
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
          onClick={onNext}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          disabled={!hasTradebook}
        >
          Start Processing
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

const STEP_ICONS: Record<ProcessingStatus, React.ReactNode> = {
  pending: (
    <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
  ),
  running: (
    <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  ),
  done: (
    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </div>
  ),
};

function StepProcessing({
  steps,
  errorMessage,
}: {
  steps: ProcessingStep[];
  errorMessage: string | null;
}) {
  const doneCount = steps.filter((s) => s.status === "done").length;
  const progress = (doneCount / steps.length) * 100;
  const hasError = steps.some((s) => s.status === "error");
  const isComplete = doneCount === steps.length;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Processing</h2>
        <p className="text-base text-gray-600 mt-1">
          {isComplete
            ? "All steps completed successfully."
            : hasError
              ? "An error occurred during processing."
              : "Please wait while we process your files..."}
        </p>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="space-y-1">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-3.5 rounded-lg px-5 py-4 transition-colors ${step.status === "running"
                ? "bg-indigo-50 border border-indigo-100"
                : step.status === "done"
                  ? "bg-gray-50"
                  : "bg-white"
              }`}
          >
            {STEP_ICONS[step.status]}
            <div className="flex-1">
              <p
                className={`text-base font-medium ${step.status === "running"
                    ? "text-indigo-700"
                    : step.status === "done"
                      ? "text-gray-700"
                      : step.status === "error"
                        ? "text-red-600"
                        : "text-gray-400"
                  }`}
              >
                {step.label}
              </p>
            </div>
            <span
              className={`text-sm font-medium capitalize ${step.status === "running"
                  ? "text-indigo-500"
                  : step.status === "done"
                    ? "text-emerald-600"
                    : step.status === "error"
                      ? "text-red-500"
                      : "text-gray-300"
                }`}
            >
              {step.status === "pending" ? "Queued" : step.status}
            </span>
          </div>
        ))}
      </div>

      {hasError && errorMessage && (
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
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {!isComplete && !hasError && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="w-3 h-3 rounded-full border border-gray-300 border-t-transparent animate-spin" />
          This usually takes a few seconds.
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Results ──────────────────────────────────────────────────────────

function StepResults({
  result,
  onStartOver,
}: {
  result: ProcessingResult;
  onStartOver: () => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Import Complete
          </h2>
          <p className="text-base text-gray-600 mt-1">
            Review your reconciliation summary and download the output files.
          </p>
          <p className="text-base text-gray-600">Batch: {result.batchId}</p>
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
          { label: "Trades Parsed", value: result.tradeCount, color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
          { label: "Events Built", value: result.eventCount, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Vouchers", value: result.voucherCount, color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
          { label: "Ledgers", value: result.ledgerCount, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-lg border px-4 py-4 text-center ${item.bg}`}
          >
            <p className={`text-3xl font-bold ${item.color}`}>{item.value}</p>
            <p className={`text-sm font-medium mt-0.5 ${item.color}`}>
              {item.label}
            </p>
          </div>
        ))}
      </div>

      {/* Reconciliation checks */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Reconciliation Checks
        </p>
        <div className="space-y-2">
          {result.checks.map((check) => {
            const isPass = check.status === "PASSED";
            const isWarn = check.status === "WARNING";
            return (
              <div
                key={check.check_name}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
                  isPass
                    ? "border-emerald-200 bg-emerald-50"
                    : isWarn
                      ? "border-amber-200 bg-amber-50"
                      : "border-red-200 bg-red-50"
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  isPass ? "bg-emerald-500" : isWarn ? "bg-amber-500" : "bg-red-500"
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
                  <p className={`text-base font-semibold ${
                    isPass ? "text-emerald-700" : isWarn ? "text-amber-700" : "text-red-700"
                  }`}>
                    {check.check_name}
                    <span className="ml-2 text-sm font-medium px-3 py-1 rounded-full border bg-white/60">
                      {check.status}
                    </span>
                  </p>
                  <p className={`text-sm mt-0.5 ${
                    isPass ? "text-emerald-600" : isWarn ? "text-amber-600" : "text-red-600"
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
        <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Download Tally XML Files
        </p>
        <div className="grid grid-cols-2 gap-3">
          {result.mastersArtifactId ? (
            <a
              href={`/api/artifacts/${result.batchId}/${result.mastersArtifactId}`}
              download="tally-masters.xml"
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
                <p className="text-sm text-gray-500">
                  Ledger definitions &amp; groups ({result.ledgerCount} ledgers)
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          ) : (
            <button
              onClick={() => downloadXml(result.mastersXml, "tally-masters.xml")}
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
                <p className="text-sm text-gray-500">
                  Ledger definitions &amp; groups ({result.ledgerCount} ledgers)
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {result.transactionsArtifactId ? (
            <a
              href={`/api/artifacts/${result.batchId}/${result.transactionsArtifactId}`}
              download="tally-transactions.xml"
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
                <p className="text-sm text-gray-500">
                  {result.voucherCount} vouchers (Purchase &amp; Sales)
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          ) : (
            <button
              onClick={() => downloadXml(result.transactionsXml, "tally-transactions.xml")}
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
                <p className="text-sm text-gray-500">
                  {result.voucherCount} vouchers (Purchase &amp; Sales)
                </p>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ml-auto text-gray-500 group-hover:text-indigo-500 transition-colors shrink-0"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Link
          href="/batches"
          className="flex-1 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          View in Batches &rarr;
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          View Dashboard
        </Link>
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
  const [formData, setFormData] = useState<FormData>({
    accountingMode: "investor",
    companyName: "",
    periodFrom: "",
    periodTo: "",
    priorBatchId: "",
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [processingSteps, setProcessingSteps] =
    useState<ProcessingStep[]>(INITIAL_STEPS);
  const [processingResult, setProcessingResult] =
    useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const handleFormChange = (data: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  const handleFilesAdded = (newFiles: File[]) => {
    const mapped: UploadedFile[] = newFiles.map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      detectedType: detectFileType(f.name),
    }));
    setFiles((prev) => {
      const existing = new Set(prev.map((p) => p.file.name));
      return [...prev, ...mapped.filter((m) => !existing.has(m.file.name))];
    });
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const runProcessing = useCallback(async () => {
    setStep(3);
    setProcessingError(null);
    setProcessingSteps(INITIAL_STEPS);

    if (files.length === 0) return;

    // Animate steps as "running" sequentially for visual feedback
    const stepIds = INITIAL_STEPS.map((s) => s.id);
    const setStepStatus = (idx: number, status: ProcessingStatus) => {
      setProcessingSteps((prev) => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], status };
        return updated;
      });
    };

    // Mark first step as running
    setStepStatus(0, "running");

    try {
      const body = new globalThis.FormData();
      for (const f of files) {
        body.append("files", f.file);
      }
      body.append("companyName", formData.companyName);
      body.append("accountingMode", formData.accountingMode);
      body.append("periodFrom", formData.periodFrom);
      body.append("periodTo", formData.periodTo);
      if (formData.priorBatchId) {
        body.append("priorBatchId", formData.priorBatchId);
      }

      const res = await fetch("/api/process", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Processing failed");
      }

      // Animate all steps to done sequentially
      for (let i = 0; i < stepIds.length; i++) {
        setStepStatus(i, "done");
        if (i + 1 < stepIds.length) {
          setStepStatus(i + 1, "running");
        }
        // Brief delay between steps for visual effect
        await new Promise((r) => setTimeout(r, 200));
      }

      setProcessingResult(data as ProcessingResult);

      // Small delay before showing results
      await new Promise((r) => setTimeout(r, 300));
      setStep(4);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setProcessingError(message);

      // Mark current running step as error, leave rest pending
      setProcessingSteps((prev) => {
        const running = prev.findIndex((s) => s.status === "running");
        if (running >= 0) {
          const updated = [...prev];
          updated[running] = { ...updated[running], status: "error" };
          return updated;
        }
        return prev;
      });
    }
  }, [files, formData]);

  const handleReset = () => {
    setStep(1);
    setFiles([]);
    setFormData({
      accountingMode: "investor",
      companyName: "",
      periodFrom: "",
      periodTo: "",
      priorBatchId: "",
    });
    setProcessingSteps(INITIAL_STEPS);
    setProcessingResult(null);
    setProcessingError(null);
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

      <Card className="border-slate-200 bg-white shadow-sm">
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
              files={files}
              onFilesAdded={handleFilesAdded}
              onRemoveFile={handleRemoveFile}
              onBack={() => setStep(1)}
              onNext={runProcessing}
            />
          )}
          {step === 3 && (
            <StepProcessing steps={processingSteps} errorMessage={processingError} />
          )}
          {step === 4 && processingResult && (
            <StepResults result={processingResult} onStartOver={handleReset} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
