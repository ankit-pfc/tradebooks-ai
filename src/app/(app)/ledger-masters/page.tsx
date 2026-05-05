"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Upload, Trash2, FileText, Search } from "lucide-react";
import { MAX_FILE_SIZE } from "@/lib/upload-constants";
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

interface LedgerEntry {
  key: string;
  name: string;
  group: string;
  source: "system" | "override" | "custom";
  created_at?: string;
}

const PAGE_SIZE = 50;

const SOURCE_BADGE_CLASS: Record<LedgerEntry["source"], string> = {
  system: "bg-gray-50 text-gray-600 border-gray-200",
  override: "bg-amber-50 text-amber-700 border-amber-200",
  custom: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const SYSTEM_LEDGER_OPTIONS = [
  { key: "", label: "Custom ledger" },
  { key: "BROKER", label: "Broker" },
  { key: "BANK", label: "Bank" },
  { key: "BROKERAGE", label: "Brokerage" },
  { key: "STT", label: "STT" },
  { key: "EXCHANGE_CHARGES", label: "Exchange Charges" },
  { key: "GST_ON_CHARGES", label: "GST on Charges" },
  { key: "STAMP_DUTY", label: "Stamp Duty" },
  { key: "DP_CHARGES", label: "DP Charges" },
  { key: "DEMAT_CHARGES", label: "Demat Charges" },
  { key: "AMC_CHARGES", label: "AMC Charges" },
  { key: "STCG_PROFIT", label: "STCG Profit" },
  { key: "LTCG_PROFIT", label: "LTCG Profit" },
  { key: "STCG_LOSS", label: "STCG Loss" },
  { key: "LTCG_LOSS", label: "LTCG Loss" },
  { key: "SPECULATIVE_PROFIT", label: "Speculative Profit" },
  { key: "SPECULATIVE_LOSS", label: "Speculative Loss" },
  { key: "DIVIDEND_INCOME", label: "Dividend Income" },
  { key: "TDS_ON_DIVIDEND", label: "TDS on Dividend" },
  { key: "TDS_ON_SECURITIES", label: "TDS on Securities" },
  { key: "OFF_MARKET_SUSPENSE", label: "Off-Market Suspense" },
];

export default function LedgerMasterPage() {
  const [ledgers, setLedgers] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedSystemKey, setSelectedSystemKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLedgers = useCallback(async () => {
    try {
      const res = await fetch("/api/ledger-masters");
      const data = await res.json();
      setLedgers(data.ledgers ?? []);
    } catch {
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large (max 50 MB)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const existingKeys = new Set(ledgers.map((l) => l.key));

    setUploading(true);
    try {
      const res = await fetch("/api/ledger-masters/upload", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      const saved: Array<{ ledger_key: string }> = data.ledgers ?? [];
      const added = saved.filter((s) => !existingKeys.has(s.ledger_key)).length;
      const updated = saved.length - added;
      toast.success(
        `Imported ${data.imported} ledger${data.imported === 1 ? "" : "s"}`,
        {
          description: `${added} new · ${updated} updated`,
        },
      );
      setSearch("");
      setPage(1);
      await fetchLedgers();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleAddLedger(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newGroup.trim()) return;

    setSaving(true);
    try {
      const key = selectedSystemKey || newName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      const res = await fetch("/api/ledger-masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledger_key: key,
          name: newName.trim(),
          parent_group: newGroup.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add ledger");
        return;
      }
      setSelectedSystemKey("");
      setNewName("");
      setNewGroup("");
      setShowAddForm(false);
      await fetchLedgers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ledgerKey: string) {
    try {
      await fetch(`/api/ledger-masters?ledger_key=${encodeURIComponent(ledgerKey)}`, {
        method: "DELETE",
      });
      await fetchLedgers();
    } catch {
      toast.error("Failed to delete");
    }
  }

  const sortedLedgers = useMemo(() => {
    return [...ledgers].sort((a, b) => {
      const aT = a.created_at ?? "";
      const bT = b.created_at ?? "";
      if (aT && bT) return bT.localeCompare(aT);
      if (aT) return -1;
      if (bT) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [ledgers]);

  const filteredLedgers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedLedgers;
    return sortedLedgers.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.group.toLowerCase().includes(q),
    );
  }, [sortedLedgers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLedgers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedLedgers = filteredLedgers.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <div className="px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ledger Master</h1>
          <p className="text-base text-gray-700 mt-1">
            Manage ledger names and groups used during Tally XML generation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-5 text-base font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? "Uploading..." : "Upload from Tally"}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 text-base font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Ledger
          </button>
        </div>
      </div>

      {/* Add Ledger Form */}
      {showAddForm && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-4">
            <form onSubmit={handleAddLedger} className="flex items-end gap-4">
              <div className="w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Override Target
                </label>
                <select
                  value={selectedSystemKey}
                  onChange={(e) => setSelectedSystemKey(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {SYSTEM_LEDGER_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ledger Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. HDFC Bank Account"
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Group
                </label>
                <input
                  type="text"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="e.g. Bank Accounts"
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-base text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      {!loading && ledgers.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or parent group…"
              className="w-full h-10 rounded-lg border border-gray-200 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <p className="text-sm text-gray-600">
            {filteredLedgers.length === ledgers.length
              ? `${ledgers.length} ledgers`
              : `${filteredLedgers.length} of ${ledgers.length} ledgers`}
          </p>
        </div>
      )}

      {/* Table */}
      <Card className="border-gray-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-gray-600">Loading ledgers...</p>
            </div>
          ) : ledgers.length === 0 ? (
            <div className="py-16">
              <div className="text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-base font-medium text-gray-900">
                    No ledgers found
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Upload a Tally export or add ledgers manually.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50/50">
                  <TableHead className="text-sm font-semibold text-gray-900 pl-6">
                    Ledger Name
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900">
                    Parent Group
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900">
                    Source
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900 pr-6 w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedLedgers.length === 0 && (
                  <TableRow className="border-gray-100">
                    <TableCell colSpan={4} className="py-12 text-center text-sm text-gray-600">
                      No ledgers match &ldquo;{search}&rdquo;.
                    </TableCell>
                  </TableRow>
                )}
                {pagedLedgers.map((ledger) => (
                  <TableRow key={ledger.key} className="border-gray-100">
                    <TableCell className="pl-6 text-base font-medium text-gray-900">
                      {ledger.name}
                    </TableCell>
                    <TableCell className="text-base text-gray-800">
                      {ledger.group}
                    </TableCell>
                    <TableCell>
                      <Badge className={SOURCE_BADGE_CLASS[ledger.source]}>
                        {ledger.source === "system"
                          ? "System"
                          : ledger.source === "override"
                            ? "Override"
                            : "Custom"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6">
                      {ledger.source !== "system" && (
                        <button
                          onClick={() => handleDelete(ledger.key)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove override"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && filteredLedgers.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredLedgers.length)} of {filteredLedgers.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
