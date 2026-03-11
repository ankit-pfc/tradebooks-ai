import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const stats = [
  {
    title: "Total Batches",
    value: "0",
    description: "Import batches created",
    icon: (
      <svg
        width="20"
        height="20"
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
    value: "0",
    description: "Tally-ready vouchers",
    icon: (
      <svg
        width="20"
        height="20"
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
    value: "—",
    description: "Reconciliation pass rate",
    icon: (
      <svg
        width="20"
        height="20"
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
    value: "0",
    description: "Items requiring review",
    icon: (
      <svg
        width="20"
        height="20"
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

export default function DashboardPage() {
  return (
    <div className="px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome to TradeBooks AI — your broker-to-Tally accounting bridge.
          </p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Link href="/upload">
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
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            New Import
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-gray-200">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Batches */}
      <Card className="border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-base font-semibold text-gray-900">
              Recent Import Batches
            </CardTitle>
            <p className="text-sm text-gray-500 mt-0.5">
              Your latest Zerodha data imports and their status.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="text-gray-600 border-gray-200"
          >
            <Link href="/batches">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-200 bg-gray-50/50">
                <TableHead className="text-xs font-medium text-gray-500 pl-6">
                  Batch ID
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500">
                  Date
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500">
                  Period
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500">
                  Vouchers
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 pr-6">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                      <p className="text-sm font-medium text-gray-700">
                        No import batches yet
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Upload your first Zerodha files to get started.
                      </p>
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Link href="/upload">Start your first import</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Guide */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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
            className="rounded-lg border border-gray-200 bg-white p-5"
          >
            <div
              className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold mb-3 border ${item.color}`}
            >
              {item.step}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {item.title}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
