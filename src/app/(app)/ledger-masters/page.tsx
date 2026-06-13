"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Check, Pencil, Plus, Upload, Trash2, FileText, Search, X } from "lucide-react";
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
}

interface SecurityMappingEntry {
  id: string;
  security_id: string | null;
  broker_symbol: string;
  isin: string | null;
  tally_ledger_name: string;
  tally_ledger_group: string;
  tally_stock_item_name: string;
  base_unit: string;
  match_source: string;
}

const PAGE_SIZE = 20;

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
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgersLoading, setLedgersLoading] = useState(true);
  const [securityMappings, setSecurityMappings] = useState<SecurityMappingEntry[]>([]);
  const [mappingTotal, setMappingTotal] = useState(0);
  const [mappingSearch, setMappingSearch] = useState("");
  const [mappingPage, setMappingPage] = useState(0);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showMappingForm, setShowMappingForm] = useState(false);
  const [selectedSystemKey, setSelectedSystemKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [editingLedgerKey, setEditingLedgerKey] = useState<string | null>(null);
  const [editLedgerName, setEditLedgerName] = useState("");
  const [editLedgerGroup, setEditLedgerGroup] = useState("");
  const [savingLedgerKey, setSavingLedgerKey] = useState<string | null>(null);
  const [mappingSymbol, setMappingSymbol] = useState("");
  const [mappingIsin, setMappingIsin] = useState("");
  const [mappingLedger, setMappingLedger] = useState("");
  const [mappingGroup, setMappingGroup] = useState("INVESTMENT IN SHARES-ZERODHA");
  const [mappingStockItem, setMappingStockItem] = useState("");
  const [mappingUnit, setMappingUnit] = useState("NOS");
  const [saving, setSaving] = useState(false);
  const [savingMapping, setSavingMapping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLedgers = useCallback(async (page: number, search: string) => {
    setLedgersLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/ledger-masters?${params.toString()}`);
      const data = await res.json();
      setLedgers(data.ledgers ?? []);
      setLedgerTotal(data.total ?? 0);
    } catch {
      setLedgers([]);
      setLedgerTotal(0);
    } finally {
      setLedgersLoading(false);
    }
  }, []);

  const fetchMappings = useCallback(async (page: number, search: string) => {
    setMappingsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/ledger-masters/security-mappings?${params.toString()}`);
      const data = await res.json();
      setSecurityMappings(data.mappings ?? []);
      setMappingTotal(data.total ?? 0);
    } catch {
      setSecurityMappings([]);
      setMappingTotal(0);
    } finally {
      setMappingsLoading(false);
    }
  }, []);

  // Debounced search — also drives the initial load. Resets to the first page.
  useEffect(() => {
    const t = setTimeout(() => {
      setLedgerPage(0);
      fetchLedgers(0, ledgerSearch);
    }, 300);
    return () => clearTimeout(t);
  }, [ledgerSearch, fetchLedgers]);

  useEffect(() => {
    const t = setTimeout(() => {
      setMappingPage(0);
      fetchMappings(0, mappingSearch);
    }, 300);
    return () => clearTimeout(t);
  }, [mappingSearch, fetchMappings]);

  function changeLedgerPage(next: number) {
    setLedgerPage(next);
    fetchLedgers(next, ledgerSearch);
  }

  function changeMappingPage(next: number) {
    setMappingPage(next);
    fetchMappings(next, mappingSearch);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File too large (max 50 MB)");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const res = await fetch("/api/ledger-masters/upload", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Upload failed");
        return;
      }
      await Promise.all([
        fetchLedgers(ledgerPage, ledgerSearch),
        fetchMappings(mappingPage, mappingSearch),
      ]);
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
      await fetchLedgers(ledgerPage, ledgerSearch);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!mappingSymbol.trim() || !mappingLedger.trim() || !mappingGroup.trim() || !mappingStockItem.trim()) {
      return;
    }

    setSavingMapping(true);
    try {
      const securityId = mappingIsin.trim() ? `ISIN:${mappingIsin.trim().toUpperCase()}` : undefined;
      const res = await fetch("/api/ledger-masters/security-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          security_id: securityId,
          broker_symbol: mappingSymbol.trim(),
          isin: mappingIsin.trim(),
          tally_ledger_name: mappingLedger.trim(),
          tally_ledger_group: mappingGroup.trim(),
          tally_stock_item_name: mappingStockItem.trim(),
          base_unit: mappingUnit.trim() || "NOS",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to save mapping");
        return;
      }
      setMappingSymbol("");
      setMappingIsin("");
      setMappingLedger("");
      setMappingGroup("INVESTMENT IN SHARES-ZERODHA");
      setMappingStockItem("");
      setMappingUnit("NOS");
      setShowMappingForm(false);
      await fetchMappings(mappingPage, mappingSearch);
    } finally {
      setSavingMapping(false);
    }
  }

  function startLedgerEdit(ledger: LedgerEntry) {
    setEditingLedgerKey(ledger.key);
    setEditLedgerName(ledger.name);
    setEditLedgerGroup(ledger.group);
  }

  function cancelLedgerEdit() {
    setEditingLedgerKey(null);
    setEditLedgerName("");
    setEditLedgerGroup("");
  }

  async function handleSaveLedgerEdit(ledgerKey: string) {
    if (!editLedgerName.trim() || !editLedgerGroup.trim()) return;

    setSavingLedgerKey(ledgerKey);
    try {
      const res = await fetch("/api/ledger-masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ledger_key: ledgerKey,
          name: editLedgerName.trim(),
          parent_group: editLedgerGroup.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "Failed to save ledger");
        return;
      }
      cancelLedgerEdit();
      await fetchLedgers(ledgerPage, ledgerSearch);
    } finally {
      setSavingLedgerKey(null);
    }
  }

  async function handleDelete(ledgerKey: string) {
    try {
      await fetch(`/api/ledger-masters?ledger_key=${encodeURIComponent(ledgerKey)}`, {
        method: "DELETE",
      });
      if (editingLedgerKey === ledgerKey) cancelLedgerEdit();
      await fetchLedgers(ledgerPage, ledgerSearch);
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

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          value={ledgerSearch}
          onChange={(e) => setLedgerSearch(e.target.value)}
          placeholder="Search ledgers by name or group..."
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Table */}
      <Card className="border-gray-200">
        <CardContent className="p-0">
          {ledgersLoading ? (
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
                    {ledgerSearch.trim() ? "No matching ledgers" : "No ledgers found"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {ledgerSearch.trim()
                      ? "Try a different search term."
                      : "Upload a Tally export or add ledgers manually."}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                  <TableHead className="text-sm font-semibold text-gray-900 pr-6 w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgers.map((ledger) => {
                  const isEditing = editingLedgerKey === ledger.key;
                  const isSavingThisLedger = savingLedgerKey === ledger.key;
                  const canSaveEdit = editLedgerName.trim().length > 0 && editLedgerGroup.trim().length > 0;

                  return (
                    <TableRow key={ledger.key} className="border-gray-100">
                      <TableCell className="pl-6 text-base font-medium text-gray-900">
                        {isEditing ? (
                          <div>
                            <label className="sr-only" htmlFor={`ledger-name-${ledger.key}`}>
                              Ledger Name
                            </label>
                            <input
                              id={`ledger-name-${ledger.key}`}
                              type="text"
                              value={editLedgerName}
                              onChange={(event) => setEditLedgerName(event.target.value)}
                              className="h-10 w-full min-w-64 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              required
                            />
                          </div>
                        ) : (
                          ledger.name
                        )}
                      </TableCell>
                      <TableCell className="text-base text-gray-800">
                        {isEditing ? (
                          <div>
                            <label className="sr-only" htmlFor={`ledger-group-${ledger.key}`}>
                              Parent Group
                            </label>
                            <input
                              id={`ledger-group-${ledger.key}`}
                              type="text"
                              value={editLedgerGroup}
                              onChange={(event) => setEditLedgerGroup(event.target.value)}
                              className="h-10 w-full min-w-52 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                              required
                            />
                          </div>
                        ) : (
                          ledger.group
                        )}
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
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveLedgerEdit(ledger.key)}
                                disabled={isSavingThisLedger || !canSaveEdit}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Save ledger"
                                aria-label="Save ledger"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={cancelLedgerEdit}
                                disabled={isSavingThisLedger}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
                                title="Cancel edit"
                                aria-label="Cancel edit"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startLedgerEdit(ledger)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                                title="Edit ledger"
                                aria-label={`Edit ${ledger.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {ledger.source !== "system" && (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(ledger.key)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title="Remove override"
                                  aria-label={`Remove ${ledger.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <PaginationFooter
              page={ledgerPage}
              pageSize={PAGE_SIZE}
              total={ledgerTotal}
              onPrev={() => changeLedgerPage(ledgerPage - 1)}
              onNext={() => changeLedgerPage(ledgerPage + 1)}
            />
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Security Mappings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Match broker symbols to the exact Tally ledger and stock item names.
          </p>
        </div>
        <button
          onClick={() => setShowMappingForm(!showMappingForm)}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Mapping
        </button>
      </div>

      {showMappingForm && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardContent className="p-4">
            <form onSubmit={handleAddMapping} className="grid gap-4 lg:grid-cols-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Broker Symbol
                </label>
                <input
                  type="text"
                  value={mappingSymbol}
                  onChange={(e) => setMappingSymbol(e.target.value)}
                  placeholder="MOTILALOFS"
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ISIN
                </label>
                <input
                  type="text"
                  value={mappingIsin}
                  onChange={(e) => setMappingIsin(e.target.value)}
                  placeholder="INE338I01027"
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tally Ledger
                </label>
                <input
                  type="text"
                  value={mappingLedger}
                  onChange={(e) => {
                    const nextLedger = e.target.value;
                    setMappingLedger(nextLedger);
                    if (!mappingStockItem || mappingStockItem === mappingLedger) {
                      setMappingStockItem(nextLedger);
                    }
                  }}
                  placeholder="Motilal Oswal Financial Services Ltd"
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Group
                </label>
                <input
                  type="text"
                  value={mappingGroup}
                  onChange={(e) => setMappingGroup(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={mappingUnit}
                  onChange={(e) => setMappingUnit(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tally Stock Item
                </label>
                <input
                  type="text"
                  value={mappingStockItem}
                  onChange={(e) => setMappingStockItem(e.target.value)}
                  placeholder="Motilal Oswal Financial Services Ltd"
                  className="w-full h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  required
                />
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <button
                  type="submit"
                  disabled={savingMapping}
                  className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {savingMapping ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMappingForm(false)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          value={mappingSearch}
          onChange={(e) => setMappingSearch(e.target.value)}
          placeholder="Search by symbol, ISIN, ledger, or stock item..."
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-0">
          {mappingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-600">Loading mappings...</p>
            </div>
          ) : securityMappings.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-600">
                {mappingSearch.trim()
                  ? "No mappings match your search."
                  : "No security mappings saved."}
              </p>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50/50">
                  <TableHead className="text-sm font-semibold text-gray-900 pl-6">
                    Broker Symbol
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900">
                    ISIN
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900">
                    Tally Ledger
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900">
                    Stock Item
                  </TableHead>
                  <TableHead className="text-sm font-semibold text-gray-900 pr-6">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {securityMappings.map((mapping) => (
                  <TableRow key={mapping.id} className="border-gray-100">
                    <TableCell className="pl-6 text-base font-medium text-gray-900">
                      {mapping.broker_symbol}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {mapping.isin ?? "-"}
                    </TableCell>
                    <TableCell className="text-base text-gray-800">
                      {mapping.tally_ledger_name}
                    </TableCell>
                    <TableCell className="text-base text-gray-800">
                      {mapping.tally_stock_item_name}
                    </TableCell>
                    <TableCell className="pr-6">
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                        {mapping.match_source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationFooter
              page={mappingPage}
              pageSize={PAGE_SIZE}
              total={mappingTotal}
              onPrev={() => changeMappingPage(mappingPage - 1)}
              onNext={() => changeMappingPage(mappingPage + 1)}
            />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaginationFooter({
  page,
  pageSize,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  const canPrev = page > 0;
  const canNext = end < total;

  return (
    <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
      <p className="text-sm text-gray-600">
        {total === 0 ? "No results" : `${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
