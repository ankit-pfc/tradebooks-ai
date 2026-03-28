"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
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

const SEVERITY_BADGE_CLASS: Record<AppExceptionSeverity, string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
};

const SEVERITY_LABELS: Record<AppExceptionSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

const FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All Severities" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
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
      .catch(() => { if (!cancelled) setExceptions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [severityFilter]);

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Exceptions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review validation and reconciliation issues detected during
          processing.
        </p>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="severity-filter"
          className="text-sm font-medium text-gray-600"
        >
          Filter by severity:
        </label>
        <select
          id="severity-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
              <p className="text-sm text-gray-500">Loading exceptions...</p>
            </div>
          ) : exceptions.length === 0 ? (
            <div className="py-16">
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    No exceptions to review
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {severityFilter === "all"
                      ? "Exceptions from processed batches will appear here."
                      : `No exceptions with severity "${SEVERITY_LABELS[severityFilter as AppExceptionSeverity] ?? severityFilter}".`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50/50">
                  <TableHead className="text-xs font-medium text-gray-500 pl-6">
                    Severity
                  </TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">
                    Code
                  </TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">
                    Message
                  </TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">
                    Batch ID
                  </TableHead>
                  <TableHead className="text-xs font-medium text-gray-500">
                    Source Refs
                  </TableHead>
                  <TableHead className="text-xs font-medium text-gray-500 pr-6">
                    Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((exc) => (
                  <TableRow key={exc.id} className="border-gray-100">
                    <TableCell className="pl-6">
                      <Badge
                        className={
                          SEVERITY_BADGE_CLASS[exc.severity] ??
                          SEVERITY_BADGE_CLASS.info
                        }
                      >
                        {SEVERITY_LABELS[exc.severity] ?? exc.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-gray-700">
                      {exc.code}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-xs truncate">
                      {exc.message}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-gray-500">
                      {exc.batch_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {exc.source_refs.length > 0
                        ? exc.source_refs.join(", ")
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 pr-6">
                      {formatDate(exc.created_at)}
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
