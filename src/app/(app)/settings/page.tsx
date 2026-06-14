"use client";

import { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecurityTab } from "@/components/settings/security-tab";
import { toast } from "sonner";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface SettingsFormData {
    company_name: string;
    accounting_mode: "INVESTOR" | "TRADER";
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const SELECT_CLASSES =
    "h-9 w-full rounded-md border border-hairline-strong bg-card px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-ink-3";

/* -------------------------------------------------------------------------- */
/*  Workspace Tab                                                             */
/* -------------------------------------------------------------------------- */

function WorkspaceTab() {
    const [form, setForm] = useState<SettingsFormData>({
        company_name: "",
        accounting_mode: "INVESTOR",
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
                body: JSON.stringify({
                    ...form,
                    cost_basis_method: "FIFO",
                    charge_treatment: "HYBRID",
                    voucher_granularity: "TRADE_LEVEL",
                    ledger_strategy: "SCRIPT_LEVEL",
                }),
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
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-4 w-72 mt-1" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <div className="space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                    <Skeleton className="h-9 w-28 mt-2" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Workspace defaults</CardTitle>
                <CardDescription>
                    These values will pre-fill future import forms.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
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
                        <option value="INVESTOR">Investor (Capital Gains)</option>
                        <option value="TRADER">Trader (Business Income)</option>
                    </select>
                </div>

                <p className="text-sm text-ink-3">
                    Cost method (FIFO), charge treatment, and ledger structure are fixed per Income Tax Act guidelines.
                </p>

                <div className="flex items-center gap-3 pt-1">
                    <Button onClick={handleSave} disabled={status === "saving"}>
                        {status === "saving" ? "Saving…" : "Save settings"}
                    </Button>
                    {status === "saved" && (
                        <span className="flex items-center gap-1.5 text-sm text-pos">
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Settings saved
                        </span>
                    )}
                    {status === "error" && (
                        <span className="flex items-center gap-1.5 text-sm text-neg">
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            {errorMsg}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

/* -------------------------------------------------------------------------- */
/*  Settings Page                                                             */
/* -------------------------------------------------------------------------- */

export default function SettingsPage() {
    return (
        <div className="px-8 py-8 space-y-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
                <p className="text-sm text-ink-2 mt-1">
                    Configure workspace defaults and security settings.
                </p>
            </div>

            <Tabs defaultValue="workspace">
                <TabsList variant="line">
                    <TabsTrigger value="workspace">Workspace</TabsTrigger>
                    <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>

                <TabsContent value="workspace" className="mt-6">
                    <WorkspaceTab />
                </TabsContent>

                <TabsContent value="security" className="mt-6">
                    <SecurityTab />
                </TabsContent>
            </Tabs>
        </div>
    );
}
