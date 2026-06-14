"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

type AppExceptionSeverity = "error" | "warning" | "info";

interface BatchException {
  id: string;
  batch_id: string;
  code: string;
  severity: AppExceptionSeverity;
  message: string;
  source_refs: string[];
  created_at: string;
}

// ── Severity vocabulary ───────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<AppExceptionSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

const SEVERITY_DOT_TONE: Record<AppExceptionSeverity, StatusDotTone> = {
  error: "neg",
  warning: "warn",
  info: "info",
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Severities" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Columns ───────────────────────────────────────────────────────────────────

const COLUMNS: Column<BatchException>[] = [
  {
    id: "severity",
    header: "Severity",
    sortable: true,
    sortValue: (row) => row.severity,
    cell: (row) => {
      const tone =
        SEVERITY_DOT_TONE[row.severity] ?? ("info" as StatusDotTone);
      const label = SEVERITY_LABELS[row.severity] ?? row.severity;
      return <StatusDot tone={tone} label={label} />;
    },
    width: "120px",
  },
  {
    id: "code",
    header: "Code",
    sortable: true,
    sortValue: (row) => row.code,
    cell: (row) => (
      <span className="mono-data text-ink">{row.code}</span>
    ),
    width: "140px",
  },
  {
    id: "message",
    header: "Message",
    cell: (row) => (
      <span className="text-sm text-ink max-w-xs truncate block" title={row.message}>
        {row.message}
      </span>
    ),
  },
  {
    id: "batch_id",
    header: "Batch ID",
    sortable: true,
    sortValue: (row) => row.batch_id,
    cell: (row) => (
      <span className="mono-data text-ink-2">
        {row.batch_id.slice(0, 8)}&hellip;
      </span>
    ),
    width: "120px",
  },
  {
    id: "source_refs",
    header: "Source Refs",
    cell: (row) =>
      row.source_refs.length > 0 ? (
        <span className="text-sm text-ink-2">{row.source_refs.join(", ")}</span>
      ) : (
        <span className="text-ink-3">&mdash;</span>
      ),
  },
  {
    id: "date",
    header: "Date",
    align: "right",
    sortable: true,
    sortValue: (row) => row.created_at,
    cell: (row) => (
      <span className="mono-data text-ink-2">{formatDate(row.created_at)}</span>
    ),
    width: "130px",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<BatchException[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    const url =
      severityFilter === "all"
        ? "/api/exceptions"
        : `/api/exceptions?severity=${severityFilter}`;
    fetch(url)
      .then((res) => res.json())
      .then((data: BatchException[]) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setExceptions(data);
        } else {
          setExceptions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setExceptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [severityFilter]);

  // Severity-aware empty state
  const emptyDescription =
    severityFilter === "all"
      ? "Exceptions from processed batches will appear here."
      : `No exceptions with severity “${SEVERITY_LABELS[severityFilter as AppExceptionSeverity] ?? severityFilter}”.`;

  const emptyState = (
    <EmptyState
      icon={<AlertTriangle className="h-5 w-5" />}
      title="No exceptions to review"
      description={emptyDescription}
    />
  );

  // Toolbar: severity filter via re-tokened Select
  const toolbar = (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-2">
        Severity
      </span>
      <Select
        value={severityFilter}
        onValueChange={(val) => {
          setLoading(true);
          setSeverityFilter(val as string);
        }}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FILTER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Exceptions
        </h1>
        <p className="text-sm text-ink-2 mt-1">
          Review validation and reconciliation issues detected during processing.
        </p>
      </div>

      {/* Data table */}
      <DataTable<BatchException>
        data={exceptions}
        columns={COLUMNS}
        getRowId={(r) => r.id}
        density="compact"
        initialSort={{ id: "date", dir: "desc" }}
        toolbar={toolbar}
        loading={loading}
        emptyState={emptyState}
        stickyHeader
      />
    </div>
  );
}
