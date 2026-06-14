"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  List,
  FileText,
  Activity,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Inbox,
} from "lucide-react";

import { Stat } from "@/components/ui/stat";
import { StatusDot } from "@/components/ui/status-dot";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardSummary {
  total_batches: number;
  total_vouchers: number;
  success_rate: number | null;
  open_exceptions: number;
}

interface RecentBatch {
  id: string;
  company_name: string;
  period_from: string;
  period_to: string;
  status: string;
  voucher_count: number;
  created_at: string;
}

interface DashboardData {
  summary: DashboardSummary;
  recent_batches: RecentBatch[];
}

// ── Status → StatusDot tone mapping ───────────────────────────────────────────

type StatusTone = "pos" | "neg" | "warn" | "info" | "neutral";

const STATUS_TONE: Record<string, StatusTone> = {
  succeeded: "pos",
  failed: "neg",
  needs_review: "warn",
  running: "info",
  queued: "info",
};

function getStatusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? STATUS_TONE.queued;
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Formatters (en-IN, preserved byte-for-byte in behavior) ───────────────────

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

// ── Quick-start steps (static content) ────────────────────────────────────────

const QUICK_STEPS = [
  {
    step: "01",
    title: "Configure & Upload",
    desc: "Set your accounting mode (Investor/Trader), then upload Zerodha exports — tradebook, funds statement, and holdings.",
  },
  {
    step: "02",
    title: "Auto-Processing",
    desc: "TradeBooks AI parses your files, builds financial events, generates voucher entries, and runs reconciliation checks.",
  },
  {
    step: "03",
    title: "Download & Import",
    desc: "Download Tally-ready XML files — Masters and Transactions — and import them directly into your Tally company.",
  },
] as const;

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, []);

  const summary = data?.summary;
  const batches = data?.recent_batches ?? [];

  // Hero strip derivation — from existing data only, no fabrication
  const openExceptions = summary?.open_exceptions ?? 0;
  const latestBatch = batches[0] ?? null;
  const latestPeriodLabel = latestBatch
    ? formatPeriod(latestBatch.period_from, latestBatch.period_to)
    : null;

  // ── DataTable columns ──────────────────────────────────────────────────────

  const columns: Column<RecentBatch>[] = [
    {
      id: "company",
      header: "Company",
      cell: (row) => (
        <span className="text-sm font-medium text-ink">{row.company_name}</span>
      ),
      sortable: true,
      sortValue: (row) => row.company_name,
    },
    {
      id: "date",
      header: "Date",
      cell: (row) => (
        <span className="mono-data text-sm text-ink-2">
          {formatDate(row.created_at)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.created_at,
    },
    {
      id: "period",
      header: "Period",
      cell: (row) => (
        <span className="mono-data text-sm text-ink-2">
          {formatPeriod(row.period_from, row.period_to)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <StatusDot
          tone={getStatusTone(row.status)}
          label={formatStatusLabel(row.status)}
        />
      ),
      sortable: true,
      sortValue: (row) => row.status,
    },
    {
      id: "vouchers",
      header: "Vouchers",
      align: "right",
      cell: (row) => (
        <span
          className={
            row.voucher_count === 0 ? "text-ink-3" : "text-ink"
          }
        >
          {row.voucher_count}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.voucher_count,
    },
    {
      id: "actions",
      header: "Actions",
      cell: () => (
        <Link
          href="/upload"
          className="text-sm font-medium text-cyan hover:underline transition-colors"
        >
          New Import
        </Link>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-8 py-8 space-y-8">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Dashboard
          </h1>
          <p className="text-sm text-ink-2 mt-1">
            Welcome to TradeBooks AI — your broker-to-Tally accounting bridge.
          </p>
        </div>
        <Link href="/upload" className={cn(buttonVariants({ size: "lg" }))}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          New Import
        </Link>
      </div>

      {/* ── Hero strip — "is everything OK?" ────────────────────────────────── */}
      {data === null ? (
        <div className="rounded-xl border border-hairline bg-card e1 px-5 py-4">
          <Skeleton className="h-5 w-72" />
        </div>
      ) : openExceptions === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-card e1 px-5 py-4">
          <CheckCircle2
            className="h-5 w-5 text-pos shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-ink">
            All books reconciled · 0 exceptions to review
            {latestPeriodLabel && (
              <span className="text-ink-2 font-normal">
                {" "}
                · latest period{" "}
                <span className="mono-data">{latestPeriodLabel}</span>
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-hairline bg-card e1 px-5 py-4">
          <AlertTriangle
            className="h-5 w-5 text-warn shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-ink">
            <Link href="/batches" className="text-warn hover:underline">
              <span className="mono-data">{openExceptions}</span>{" "}
              {openExceptions === 1 ? "exception needs" : "exceptions need"}{" "}
              review
            </Link>
            {latestPeriodLabel && (
              <span className="text-ink-2 font-normal">
                {" "}
                · latest period{" "}
                <span className="mono-data">{latestPeriodLabel}</span>
              </span>
            )}
          </p>
        </div>
      )}

      {/* ── KPI stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data === null ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-hairline bg-card e1 p-5 flex flex-col gap-3"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </>
        ) : (
          <>
            <Stat
              label="Total Batches"
              value={summary?.total_batches ?? 0}
              sub="Import batches created"
              icon={<List className="h-4 w-4" />}
            />
            <Stat
              label="Vouchers Generated"
              value={summary?.total_vouchers ?? 0}
              sub="Tally-ready vouchers"
              icon={<FileText className="h-4 w-4" />}
            />
            <Stat
              label="Success Rate"
              value={
                summary && summary.success_rate !== null
                  ? `${Math.round(summary.success_rate)}%`
                  : "—"
              }
              sub="Reconciliation pass rate"
              icon={<Activity className="h-4 w-4" />}
            />
            <Stat
              label="Exceptions"
              value={summary?.open_exceptions ?? 0}
              sub="Items requiring review"
              icon={
                <AlertTriangle
                  className={
                    (summary?.open_exceptions ?? 0) > 0
                      ? "h-4 w-4 text-warn"
                      : "h-4 w-4"
                  }
                />
              }
              className={
                (summary?.open_exceptions ?? 0) > 0
                  ? "[&_.mono-data]:text-warn"
                  : undefined
              }
            />
          </>
        )}
      </div>

      {/* ── Recent Import Batches ────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Recent Import Batches
            </h2>
            <p className="text-sm text-ink-2">
              Your latest Zerodha data imports and their status.
            </p>
          </div>
          <Link
            href="/batches"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            View all
          </Link>
        </div>

        <DataTable<RecentBatch>
          data={batches}
          columns={columns}
          getRowId={(r) => r.id}
          density="comfortable"
          loading={data === null}
          initialSort={{ id: "date", dir: "desc" }}
          emptyState={
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No import batches yet"
              description="Upload your first Zerodha files to get started."
              action={
                <Link href="/upload" className={cn(buttonVariants())}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Start your first import
                </Link>
              }
            />
          }
        />
      </div>

      {/* ── Quick-start guide (demoted, neutral styling) ─────────────────────── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold text-ink">
            How it works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {QUICK_STEPS.map((item) => (
              <div key={item.step} className="flex gap-4">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 border border-hairline"
                  aria-hidden="true"
                >
                  <span className="mono-data text-xs font-semibold text-ink-2">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-ink-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
