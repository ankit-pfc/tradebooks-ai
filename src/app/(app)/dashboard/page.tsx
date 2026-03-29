"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

const STATUS_BADGE: Record<string, string> = {
  succeeded: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  queued: "bg-gray-50 text-gray-600 border-gray-200",
  needs_review: "bg-amber-50 text-amber-700 border-amber-200",
};

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

  const stats = [
    {
      title: "Total Batches",
      value: summary ? String(summary.total_batches) : "0",
      description: "Import batches created",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-indigo-600"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      title: "Vouchers Generated",
      value: summary ? String(summary.total_vouchers) : "0",
      description: "Tally-ready vouchers",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-600"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      title: "Success Rate",
      value:
        summary && summary.success_rate !== null
          ? `${Math.round(summary.success_rate)}%`
          : "—",
      description: "Reconciliation pass rate",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-blue-600"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      title: "Exceptions",
      value: summary ? String(summary.open_exceptions) : "0",
      description: "Items requiring review",
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-amber-600"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-10 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-base text-gray-600 mt-1.5">
            Welcome to TradeBooks AI — your broker-to-Tally accounting bridge.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 text-base font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          New Import
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-gray-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold text-gray-700">
                {stat.title}
              </CardTitle>
              <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600 mt-1.5">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Batches */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900">
              Recent Import Batches
            </CardTitle>
            <p className="text-base text-gray-600 mt-1">
              Your latest Zerodha data imports and their status.
            </p>
          </div>
          <Link
            href="/batches"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 bg-gray-50/50">
                <TableHead className="text-sm font-semibold text-gray-700 pl-6">
                  Company
                </TableHead>
                <TableHead className="text-sm font-semibold text-gray-700">
                  Date
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
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-16 text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-gray-400"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-medium text-gray-700">
                          No import batches yet
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Upload your first Zerodha files to get started.
                        </p>
                      </div>
                      <Link
                        href="/upload"
                        className="mt-2 inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                      >
                        Start your first import
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id} className="border-gray-100">
                    <TableCell className="pl-6 text-base font-medium text-gray-900">
                      {batch.company_name}
                    </TableCell>
                    <TableCell className="text-base text-gray-700">
                      {formatDate(batch.created_at)}
                    </TableCell>
                    <TableCell className="text-base text-gray-700">
                      {formatPeriod(batch.period_from, batch.period_to)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm font-medium px-3 py-1.5 rounded-full border capitalize ${
                          STATUS_BADGE[batch.status] ?? STATUS_BADGE.queued
                        }`}
                      >
                        {batch.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-base font-medium text-gray-900">
                      {batch.voucher_count}
                    </TableCell>
                    <TableCell className="pr-6">
                      <Link
                        href="/upload"
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        New Import
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Guide */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            step: "01",
            title: "Configure & Upload",
            desc: "Set your accounting mode (Investor/Trader), then upload Zerodha exports — tradebook, funds statement, and holdings.",
            color: "bg-indigo-50 text-indigo-700 border-indigo-100",
          },
          {
            step: "02",
            title: "Auto-Processing",
            desc: "TradeBooks AI parses your files, builds financial events, generates voucher entries, and runs reconciliation checks.",
            color: "bg-blue-50 text-blue-700 border-blue-100",
          },
          {
            step: "03",
            title: "Download & Import",
            desc: "Download Tally-ready XML files — Masters and Transactions — and import them directly into your Tally company.",
            color: "bg-emerald-50 text-emerald-700 border-emerald-100",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-lg border border-gray-200 bg-white p-6"
          >
            <div
              className={`inline-flex items-center justify-center w-10 h-10 rounded-md text-sm font-bold mb-3 border ${item.color}`}
            >
              {item.step}
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1.5">
              {item.title}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
