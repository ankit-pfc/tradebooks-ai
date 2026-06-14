"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Check, Pencil, Plus, Upload, Trash2, FileText, Search, X } from "lucide-react";
import { toast } from "sonner";
import { MAX_FILE_SIZE } from "@/lib/upload-constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/status-dot";
import { SkeletonRows } from "@/components/ui/skeleton";
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

// Tone mapping for source — paired with StatusDot (dot + label, never color alone)
const SOURCE_TONE: Record<LedgerEntry["source"], "neutral" | "warn" | "pos"> = {
  system: "neutral",
  override: "warn",
  custom: "pos",
};

const SOURCE_LABEL: Record<LedgerEntry["source"], string> = {
  system: "System",
  override: "Override",
  custom: "Custom",
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
      toast.error("File too large (max 50 MB)");
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
        toast.error(data.error ?? "Upload failed");
        return;
      }
      await Promise.all([
        fetchLedgers(ledgerPage, ledgerSearch),
        fetchMappings(mappingPage, mappingSearch),
      ]);
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
        toast.error(data.error ?? "Failed to save mapping");
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
        toast.error(data.error ?? "Failed to save ledger");
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
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Ledger Master</h1>
          <p className="text-sm text-ink-2 mt-1">
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
          <Button
            variant="secondary"
            size="default"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading..." : "Upload from Tally"}
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus className="h-4 w-4" />
            Add Ledger
          </Button>
        </div>
      </div>

      {/* Add Ledger Form */}
      {showAddForm && (
        <Card className="bg-surface-2 border-hairline">
          <CardContent className="p-4">
            <form onSubmit={handleAddLedger} className="flex items-end gap-4">
              <div className="w-48">
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Override Target
                </label>
                <select
                  value={selectedSystemKey}
                  onChange={(e) => setSelectedSystemKey(e.target.value)}
                  className="w-full h-9 rounded-md border border-hairline-strong bg-card px-3 text-sm text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
                >
                  {SYSTEM_LEDGER_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Ledger Name
                </label>
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. HDFC Bank Account"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Parent Group
                </label>
                <Input
                  type="text"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                  placeholder="e.g. Bank Accounts"
                  required
                />
              </div>
              <Button type="submit" variant="default" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Ledger Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          value={ledgerSearch}
          onChange={(e) => setLedgerSearch(e.target.value)}
          placeholder="Search ledgers by name or group..."
          className="h-9 w-full rounded-md border border-hairline-strong bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
        />
      </div>

      {/* Ledger Table */}
      <Card>
        <CardContent className="p-0">
          {ledgersLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Ledger Name</TableHead>
                  <TableHead>Parent Group</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="pr-4 w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows rows={5} cols={4} />
              </TableBody>
            </Table>
          ) : ledgers.length === 0 ? (
            <div className="py-16">
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-ink-3" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">
                    {ledgerSearch.trim() ? "No matching ledgers" : "No ledgers found"}
                  </p>
                  <p className="text-sm text-ink-2 mt-1">
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
                  <TableRow>
                    <TableHead className="pl-4">Ledger Name</TableHead>
                    <TableHead>Parent Group</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="pr-4 w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgers.map((ledger) => {
                    const isEditing = editingLedgerKey === ledger.key;
                    const isSavingThisLedger = savingLedgerKey === ledger.key;
                    const canSaveEdit = editLedgerName.trim().length > 0 && editLedgerGroup.trim().length > 0;

                    return (
                      <TableRow key={ledger.key}>
                        <TableCell className="pl-4 font-medium text-ink">
                          {isEditing ? (
                            <div>
                              <label className="sr-only" htmlFor={`ledger-name-${ledger.key}`}>
                                Ledger Name
                              </label>
                              <Input
                                id={`ledger-name-${ledger.key}`}
                                type="text"
                                value={editLedgerName}
                                onChange={(event) => setEditLedgerName(event.target.value)}
                                className="min-w-52"
                                required
                              />
                            </div>
                          ) : (
                            ledger.name
                          )}
                        </TableCell>
                        <TableCell className="text-ink-2">
                          {isEditing ? (
                            <div>
                              <label className="sr-only" htmlFor={`ledger-group-${ledger.key}`}>
                                Parent Group
                              </label>
                              <Input
                                id={`ledger-group-${ledger.key}`}
                                type="text"
                                value={editLedgerGroup}
                                onChange={(event) => setEditLedgerGroup(event.target.value)}
                                className="min-w-44"
                                required
                              />
                            </div>
                          ) : (
                            ledger.group
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusDot
                            tone={SOURCE_TONE[ledger.source]}
                            label={SOURCE_LABEL[ledger.source]}
                          />
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {isEditing ? (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleSaveLedgerEdit(ledger.key)}
                                  disabled={isSavingThisLedger || !canSaveEdit}
                                  className="text-pos hover:bg-pos/10"
                                  title="Save ledger"
                                  aria-label="Save ledger"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={cancelLedgerEdit}
                                  disabled={isSavingThisLedger}
                                  title="Cancel edit"
                                  aria-label="Cancel edit"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => startLedgerEdit(ledger)}
                                  title="Edit ledger"
                                  aria-label={`Edit ${ledger.name}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {ledger.source !== "system" && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => handleDelete(ledger.key)}
                                    className="text-ink-3 hover:text-neg hover:bg-neg/10"
                                    title="Remove override"
                                    aria-label={`Remove ${ledger.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
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

      {/* Security Mappings Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Security Mappings</h2>
          <p className="text-sm text-ink-2 mt-1">
            Match broker symbols to the exact Tally ledger and stock item names.
          </p>
        </div>
        <Button
          variant="secondary"
          size="default"
          onClick={() => setShowMappingForm(!showMappingForm)}
        >
          <Plus className="h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      {/* Add Mapping Form */}
      {showMappingForm && (
        <Card className="bg-surface-2 border-hairline">
          <CardContent className="p-4">
            <form onSubmit={handleAddMapping} className="grid gap-4 lg:grid-cols-6">
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Broker Symbol
                </label>
                <Input
                  type="text"
                  value={mappingSymbol}
                  onChange={(e) => setMappingSymbol(e.target.value)}
                  placeholder="MOTILALOFS"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  ISIN
                </label>
                <Input
                  type="text"
                  value={mappingIsin}
                  onChange={(e) => setMappingIsin(e.target.value)}
                  placeholder="INE338I01027"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Tally Ledger
                </label>
                <Input
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
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Parent Group
                </label>
                <Input
                  type="text"
                  value={mappingGroup}
                  onChange={(e) => setMappingGroup(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Unit
                </label>
                <Input
                  type="text"
                  value={mappingUnit}
                  onChange={(e) => setMappingUnit(e.target.value)}
                />
              </div>
              <div className="lg:col-span-4">
                <label className="block text-xs font-medium text-ink-2 mb-1.5">
                  Tally Stock Item
                </label>
                <Input
                  type="text"
                  value={mappingStockItem}
                  onChange={(e) => setMappingStockItem(e.target.value)}
                  placeholder="Motilal Oswal Financial Services Ltd"
                  required
                />
              </div>
              <div className="flex items-end gap-2 lg:col-span-2">
                <Button type="submit" variant="default" disabled={savingMapping}>
                  {savingMapping ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowMappingForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mapping Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-3" aria-hidden="true" />
        <input
          type="search"
          value={mappingSearch}
          onChange={(e) => setMappingSearch(e.target.value)}
          placeholder="Search by symbol, ISIN, ledger, or stock item..."
          className="h-9 w-full rounded-md border border-hairline-strong bg-card pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"
        />
      </div>

      {/* Security Mappings Table */}
      <Card>
        <CardContent className="p-0">
          {mappingsLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Broker Symbol</TableHead>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Tally Ledger</TableHead>
                  <TableHead>Stock Item</TableHead>
                  <TableHead className="pr-4">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SkeletonRows rows={5} cols={5} />
              </TableBody>
            </Table>
          ) : securityMappings.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-2">
                {mappingSearch.trim()
                  ? "No mappings match your search."
                  : "No security mappings saved."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Broker Symbol</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Tally Ledger</TableHead>
                    <TableHead>Stock Item</TableHead>
                    <TableHead className="pr-4">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securityMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="pl-4 font-medium text-ink">
                        <span className="mono-data">{mapping.broker_symbol}</span>
                      </TableCell>
                      <TableCell className="text-ink-2">
                        <span className="mono-data">{mapping.isin ?? "—"}</span>
                      </TableCell>
                      <TableCell className="text-ink">
                        {mapping.tally_ledger_name}
                      </TableCell>
                      <TableCell className="text-ink">
                        {mapping.tally_stock_item_name}
                      </TableCell>
                      <TableCell className="pr-4">
                        <StatusDot tone="pos" label={mapping.match_source} />
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
    <div className="flex items-center justify-between border-t border-hairline px-6 py-3">
      <p className="text-xs text-ink-2">
        {total === 0 ? (
          "No results"
        ) : (
          <span className="mono-data">{start}–{end} of {total}</span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPrev}
          disabled={!canPrev}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onNext}
          disabled={!canNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
