"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, FileText, Plus } from "lucide-react";
import { TradebookChat } from "@/components/agent/tradebook-chat";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";

// ── Types ─────────────────────────────────────────────────────────────────────

type AppBatchStatus =
  | "uploading"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "needs_review";

interface BatchRecord {
  id: string;
  user_id: string;
  company_name: string;
  accounting_mode: "investor" | "trader";
  period_from: string;
  period_to: string;
  status: AppBatchStatus;
  status_message: string | null;
  file_count: number;
  voucher_count: number;
  created_at: string;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AppBatchStatus, string> = {
  uploading: "Uploading",
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  needs_review: "Needs Review",
};

const STATUS_TONE: Record<AppBatchStatus, StatusDotTone> = {
  succeeded: "pos",
  failed: "neg",
  needs_review: "warn",
  running: "info",
  queued: "neutral",
  uploading: "neutral",
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "uploading", label: "Uploading" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "needs_review", label: "Needs Review" },
];

// ── Formatters (preserved byte-for-byte) ──────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(from: string, to: string): string {
  if (!from && !to) return "—";
  return `${formatDate(from)} – ${formatDate(to)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BatchesPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Preserved: cancellation guard + response normalization
  useEffect(() => {
    let cancelled = false;
    const url =
      statusFilter === "all"
        ? "/api/batches"
        : `/api/batches?status=${statusFilter}`;
    const load = () => {
      setLoading(true);
      fetch(url)
        .then((res) => res.json())
        .then((data: { batches: BatchRecord[] } | BatchRecord[]) => {
          if (cancelled) return;
          const list = Array.isArray(data)
            ? data
            : (data as { batches: BatchRecord[] }).batches ?? [];
          if (Array.isArray(list)) {
            setBatches(list);
          } else {
            setBatches([]);
          }
        })
        .catch(() => {
          if (!cancelled) setBatches([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const selectedBatch =
    batches.find((batch) => batch.id === selectedBatchId) ?? null;

  // ── DataTable column definitions ───────────────────────────────────────────

  const columns: Column<BatchRecord>[] = [
    {
      id: "company",
      header: "Company",
      sortable: true,
      sortValue: (r) => r.company_name,
      cell: (r) => (
        <span className="font-medium text-ink">{r.company_name}</span>
      ),
    },
    {
      id: "period",
      header: "Period",
      sortable: true,
      sortValue: (r) => r.period_from,
      cell: (r) => (
        <span className="mono-data text-ink-2">
          {formatPeriod(r.period_from, r.period_to)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => (
        <StatusDot
          tone={STATUS_TONE[r.status] ?? "neutral"}
          label={STATUS_LABELS[r.status] ?? r.status}
        />
      ),
    },
    {
      id: "vouchers",
      header: "Vouchers",
      align: "right",
      sortable: true,
      sortValue: (r) => r.voucher_count,
      cell: (r) => (
        <span className="mono-data">{r.voucher_count}</span>
      ),
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (r) => r.created_at,
      cell: (r) => (
        <span className="mono-data text-ink-2">{formatDate(r.created_at)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              // Stop row click from firing (row navigates to trace)
              e.stopPropagation();
              setSelectedBatchId((current) =>
                current === r.id ? null : r.id,
              );
            }}
            aria-pressed={selectedBatchId === r.id}
            aria-label={`Ask AI about ${r.company_name}`}
            className={cn(
              buttonVariants({
                variant: selectedBatchId === r.id ? "default" : "ghost",
                size: "sm",
              }),
            )}
          >
            <Bot className="h-4 w-4" />
            Ask AI
          </button>
        </div>
      ),
    },
  ];

  // ── Empty state copy (preserved: all-vs-filtered copy) ─────────────────────

  const emptyStateNode = (
    <EmptyState
      icon={<FileText className="h-5 w-5" />}
      title={
        statusFilter === "all"
          ? "No batches yet"
          : `No batches with status "${STATUS_LABELS[statusFilter as AppBatchStatus] ?? statusFilter}"`
      }
      description={
        statusFilter === "all"
          ? "Upload your first Zerodha files to get started."
          : "Try a different filter or import new files."
      }
      action={
        statusFilter === "all" ? (
          <Link
            href="/upload"
            className={buttonVariants({ size: "sm" })}
          >
            Start your first import
          </Link>
        ) : undefined
      }
    />
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            History
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Past imports and their processing status.
          </p>
        </div>
        <Link href="/upload" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          New Import
        </Link>
      </div>

      {/* DataTable with status filter in toolbar */}
      <DataTable<BatchRecord>
        data={batches}
        columns={columns}
        getRowId={(r) => r.id}
        density="compact"
        initialSort={{ id: "created", dir: "desc" }}
        loading={loading}
        emptyState={emptyStateNode}
        onRowClick={(r) => router.push(`/dev/trace/${r.id}`)}
        toolbar={
          <div className="flex items-center gap-2">
            <label
              htmlFor="status-filter"
              className="text-xs font-medium uppercase tracking-wide text-ink-2 whitespace-nowrap"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-hairline-strong bg-card px-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Preserved: keyed TradebookChat mount with composed batchLabel */}
      {selectedBatch && (
        <div className="rounded-xl border border-hairline bg-card e1">
          <TradebookChat
            key={selectedBatch.id}
            batchId={selectedBatch.id}
            batchLabel={`${selectedBatch.company_name} · ${formatPeriod(selectedBatch.period_from, selectedBatch.period_to)} · ${STATUS_LABELS[selectedBatch.status] ?? selectedBatch.status}`}
          />
        </div>
      )}
    </div>
  );
}
