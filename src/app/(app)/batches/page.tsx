"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppBatchStatus =
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

const STATUS_BADGE_CLASS: Record<AppBatchStatus, string> = {
  succeeded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  queued: "bg-gray-50 text-gray-600 border-gray-200",
  needs_review: "bg-amber-50 text-amber-700 border-amber-200",
};

const STATUS_LABELS: Record<AppBatchStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  needs_review: "Needs Review",
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "needs_review", label: "Needs Review" },
];

function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(from: string, to: string): string {
  if (!from && !to) return "\u2014";
  return `${formatDate(from)} \u2013 ${formatDate(to)}`;
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    const url =
      statusFilter === "all"
        ? "/api/batches"
        : `/api/batches?status=${statusFilter}`;
    fetch(url)
      .then((res) => res.json())
      .then((data: BatchRecord[]) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setBatches(data);
        } else {
          setBatches([]);
        }
      })
      .catch(() => { if (!cancelled) setBatches([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter]);

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Batches</h1>
          <p className="text-base text-gray-600 mt-1">
            Track upload and processing lifecycle for each import batch.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 text-base font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Import
        </Link>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="status-filter"
          className="text-base font-medium text-gray-700"
        >
          Filter by status:
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-gray-200 bg-white px-2.5 text-base text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card className="border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-gray-500">Loading batches...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="py-16">
              <div className="text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-base font-medium text-gray-700">
                    No batches found
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {statusFilter === "all"
                      ? "Upload your first Zerodha files to get started."
                      : `No batches with status "${STATUS_LABELS[statusFilter as AppBatchStatus] ?? statusFilter}".`}
                  </p>
                </div>
                {statusFilter === "all" && (
                  <Link
                    href="/upload"
                    className="mt-1 inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                  >
                    Start your first import
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50/50">
                  <TableHead className="text-sm font-semibold text-gray-700 pl-6">
                    Company Name
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700">
                    Period
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700">
                    Status
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700">
                    Vouchers
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-700 pr-6">
                    Created
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id} className="border-gray-100">
                    <TableCell className="pl-6 text-base font-medium text-gray-900">
                      {batch.company_name}
                    </TableCell>
                    <TableCell className="text-base text-gray-700">
                      {formatPeriod(batch.period_from, batch.period_to)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          STATUS_BADGE_CLASS[batch.status] ??
                          STATUS_BADGE_CLASS.queued
                        }
                      >
                        {STATUS_LABELS[batch.status] ?? batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-base font-medium text-gray-900">
                      {batch.voucher_count}
                    </TableCell>
                    <TableCell className="text-base text-gray-700 pr-6">
                      {formatDate(batch.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
