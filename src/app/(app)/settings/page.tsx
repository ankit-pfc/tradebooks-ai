"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SettingsFormData {
    company_name: string;
    accounting_mode: "INVESTOR" | "TRADER";
    cost_basis_method: "FIFO" | "WEIGHTED_AVERAGE";
    charge_treatment: "CAPITALIZE" | "EXPENSE" | "HYBRID";
    voucher_granularity: "TRADE_LEVEL" | "CONTRACT_NOTE_LEVEL" | "DAILY_SUMMARY_BY_SCRIPT" | "DAILY_SUMMARY_POOLED";
    ledger_strategy: "SCRIPT_LEVEL" | "POOLED";
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SELECT_CLASSES =
    "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export default function SettingsPage() {
    const [form, setForm] = useState<SettingsFormData>({
        company_name: "",
        accounting_mode: "INVESTOR",
        cost_basis_method: "FIFO",
        charge_treatment: "HYBRID",
        voucher_granularity: "TRADE_LEVEL",
        ledger_strategy: "SCRIPT_LEVEL",
    });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<SaveStatus>("idle");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        fetch("/api/settings")
            .then((res) => res.json())
            .then((data) => {
                if (!data.error) {
                    setForm({
                        company_name: data.company_name ?? "",
                        accounting_mode: data.accounting_mode ?? "INVESTOR",
                        cost_basis_method: data.cost_basis_method ?? "FIFO",
                        charge_treatment: data.charge_treatment ?? "HYBRID",
                        voucher_granularity: data.voucher_granularity ?? "TRADE_LEVEL",
                        ledger_strategy: data.ledger_strategy ?? "SCRIPT_LEVEL",
                    });
                }
            })
            .catch(() => { /* use defaults */ })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setStatus("saving");
        setErrorMsg("");
        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus("error");
                setErrorMsg(data.error ?? "Failed to save");
                toast.error(data.error ?? "Failed to save");
                return;
            }
            setStatus("saved");
            toast.success("Settings saved");
            setTimeout(() => setStatus("idle"), 2000);
        } catch {
            setStatus("error");
            setErrorMsg("Network error");
            toast.error("Failed to save settings");
        }
    };

    const updateField = <K extends keyof SettingsFormData>(
        key: K,
        value: SettingsFormData[K],
    ) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        if (status === "saved") setStatus("idle");
    };

    if (loading) {
        return (
            <div className="px-8 py-8">
                <p className="text-sm text-gray-400">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="px-8 py-8 space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Configure workspace defaults for upload and export workflows.
                </p>
            </div>

            <Card className="border-gray-200">
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-gray-900">
                        Workspace defaults
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        These values will pre-fill future import forms.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="company-name">Default Tally company</Label>
                        <Input
                            id="company-name"
                            placeholder="e.g. Rajesh Kumar & Associates"
                            value={form.company_name}
                            onChange={(e) => updateField("company_name", e.target.value)}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="accounting-mode">Accounting mode</Label>
                        <select
                            id="accounting-mode"
                            className={SELECT_CLASSES}
                            value={form.accounting_mode}
                            onChange={(e) =>
                                updateField("accounting_mode", e.target.value as SettingsFormData["accounting_mode"])
                            }
                        >
                            <option value="INVESTOR">Investor (Capital Gains / ITR-2)</option>
                            <option value="TRADER">Trader (Business Income / ITR-3)</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="cost-basis">Cost basis method</Label>
                        <select
                            id="cost-basis"
                            className={SELECT_CLASSES}
                            value={form.cost_basis_method}
                            onChange={(e) =>
                                updateField("cost_basis_method", e.target.value as SettingsFormData["cost_basis_method"])
                            }
                        >
                            <option value="FIFO">FIFO (First In, First Out)</option>
                            <option value="WEIGHTED_AVERAGE">Weighted Average</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="charge-treatment">Charge treatment</Label>
                        <select
                            id="charge-treatment"
                            className={SELECT_CLASSES}
                            value={form.charge_treatment}
                            onChange={(e) =>
                                updateField("charge_treatment", e.target.value as SettingsFormData["charge_treatment"])
                            }
                        >
                            <option value="HYBRID">Hybrid (buy charges capitalised, sell expensed)</option>
                            <option value="CAPITALIZE">Capitalise all charges</option>
                            <option value="EXPENSE">Expense all charges</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="voucher-granularity">Voucher granularity</Label>
                        <select
                            id="voucher-granularity"
                            className={SELECT_CLASSES}
                            value={form.voucher_granularity}
                            onChange={(e) =>
                                updateField(
                                    "voucher_granularity",
                                    e.target.value as SettingsFormData["voucher_granularity"],
                                )
                            }
                        >
                            <option value="TRADE_LEVEL">Trade level (one voucher per trade)</option>
                            <option value="CONTRACT_NOTE_LEVEL">Contract note level</option>
                            <option value="DAILY_SUMMARY_BY_SCRIPT">Daily summary by scrip</option>
                            <option value="DAILY_SUMMARY_POOLED">Daily summary pooled</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="ledger-strategy">Ledger strategy</Label>
                        <select
                            id="ledger-strategy"
                            className={SELECT_CLASSES}
                            value={form.ledger_strategy}
                            onChange={(e) =>
                                updateField("ledger_strategy", e.target.value as SettingsFormData["ledger_strategy"])
                            }
                        >
                            <option value="SCRIPT_LEVEL">Per-scrip ledgers</option>
                            <option value="POOLED">Pooled ledger</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Button onClick={handleSave} disabled={status === "saving"}>
                            {status === "saving" ? "Saving..." : "Save settings"}
                        </Button>
                        {status === "saved" && (
                            <span className="text-sm text-green-600">Settings saved</span>
                        )}
                        {status === "error" && (
                            <span className="text-sm text-red-600">{errorMsg}</span>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
