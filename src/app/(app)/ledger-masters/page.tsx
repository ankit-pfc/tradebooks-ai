"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Plus, Upload, Trash2, FileText } from "lucide-react";
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
}

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

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ledger-masters/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Upload failed");
        return;
      }
      await fetchLedgers();
    } catch {
      alert("Upload failed");
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
        alert(data.error ?? "Failed to add ledger");
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
      alert("Failed to delete");
    }
  }

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
                {ledgers.map((ledger) => (
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
    </div>
  );
}
