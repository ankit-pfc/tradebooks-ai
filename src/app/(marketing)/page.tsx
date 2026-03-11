import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const trustCues = [
    "Built for Indian tax, audit, and compliance workflows",
    "No broker or Tally credentials required",
    "Tally Prime and ERP 9 compatible XML output",
];

const steps = [
    {
        title: "Upload exports",
        text: "Drop tradebook, funds, holdings, and contract-note files from Zerodha Console.",
    },
    {
        title: "Set accounting mode",
        text: "Choose Investor or Trader treatment and confirm your Tally company context.",
    },
    {
        title: "Review reconciled exceptions",
        text: "We cross-check entries and surface only mismatches that need your attention.",
    },
    {
        title: "Export Tally XML",
        text: "Download import-ready XML and load it into Tally Prime or ERP 9.",
    },
];

const features = [
    "Reconcile before import to reduce downstream corrections",
    "Investor/Trader logic for cleaner tax treatment",
    "Source-row level traceability for audits",
    "Zerodha-first parsing tuned for V1 reliability",
    "Tally-ready XML output without manual post-processing",
    "Exception-first workflow that keeps humans in control",
];

const pillars = [
    {
        title: "Reconcile First",
        text: "We cross-check tradebook, funds, holdings, and contract-note context before generating vouchers, so errors are caught before they reach books.",
    },
    {
        title: "Investor / Trader Logic",
        text: "Pick accounting treatment mode up front so classification and voucher behavior stays consistent with your tax intent.",
    },
    {
        title: "Audit Traceability",
        text: "Every generated row can be traced back to source exports, making review and audit defense practical under real deadlines.",
    },
];

const segments = [
    {
        title: "CA firms",
        text: "Standardize Zerodha-to-Tally posting across clients without creating spreadsheet-heavy SOPs.",
    },
    {
        title: "In-house accounting teams",
        text: "Keep month-end close predictable with exception-first reconciliation and controlled export workflows.",
    },
    {
        title: "Active traders",
        text: "Reduce manual bookkeeping overhead and maintain clean records for filing and advisory conversations.",
    },
];

const proofPoints = [
    "Source row → generated voucher lineage",
    "Exception-first queue for mismatch handling",
    "Native Tally XML output artifact (no copy-paste posting)",
];

const faqs = [
    {
        q: "Do I need to connect Zerodha or Tally directly?",
        a: "No. V1 follows a secure upload-and-export workflow: upload Zerodha exports, review exceptions, then import generated XML into Tally.",
    },
    {
        q: "How is my data handled and secured?",
        a: "Files are processed for reconciliation and export workflows with controlled access in the app. We intentionally avoid requiring direct broker or Tally credentials in V1.",
    },
    {
        q: "Will this affect my existing Tally setup?",
        a: "No. You review and import generated XML manually, so your team keeps control of when and where data enters your Tally company.",
    },
    {
        q: "What if data is missing or mismatched?",
        a: "Those rows are surfaced in exceptions first. You can review and resolve mismatches before export, instead of discovering issues after import.",
    },
    {
        q: "Is this a replacement for Tally?",
        a: "No. TradeBooks AI is a bridge from broker exports to your existing Tally workflow.",
    },
    {
        q: "Does this support brokers beyond Zerodha?",
        a: "Not in V1. We are intentionally focused on Zerodha-first quality and consistency.",
    },
];

export default function LandingPage() {
    return (
        <>
            <section className="relative overflow-hidden bg-slate-950 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_45%)]" />
                <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
                    <div>
                        <Badge className="mb-5 border-indigo-400/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/20">
                            Built for Indian CAs & Accountants
                        </Badge>
                        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                            Stop posting Zerodha trades manually.
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-slate-300">
                            Upload broker exports, review reconciled exceptions, and generate
                            Tally-importable XML in minutes.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/upload"
                                className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-500 px-7 text-sm font-semibold text-white transition hover:bg-indigo-400"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                href="#how-it-works"
                                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-600 px-7 text-sm font-medium text-slate-200 transition hover:bg-slate-900"
                            >
                                See How It Works
                            </Link>
                        </div>
                        <p className="mt-4 text-sm text-slate-400">
                            No credit card required. First file free.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1">Zerodha-first reliability</span>
                            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1">Exception-first review</span>
                            <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1">Audit-ready traceability</span>
                        </div>
                    </div>

                    <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-2xl shadow-indigo-900/30">
                        <CardContent className="p-6 sm:p-8">
                            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Workflow Preview</p>
                            <div className="mt-5 space-y-3">
                                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-slate-100">Zerodha export sample.csv</p>
                                        <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-200">Uploaded</span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-400">Rows: 4,862 · Contract notes linked</p>
                                </div>

                                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-amber-100">Reconciliation state</p>
                                        <span className="rounded-md bg-amber-300/20 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-100">12 exceptions</span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                                        <div className="rounded-md border border-amber-200/20 bg-slate-950/40 px-2 py-2 text-slate-200">Matched 4,850</div>
                                        <div className="rounded-md border border-amber-200/20 bg-slate-950/40 px-2 py-2 text-slate-200">Flagged 12</div>
                                        <div className="rounded-md border border-amber-200/20 bg-slate-950/40 px-2 py-2 text-slate-200">Ready 99.7%</div>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-4">
                                    <p className="text-sm font-semibold text-indigo-100">Tally XML artifact generated</p>
                                    <p className="mt-1 text-xs text-indigo-200/90">vouchers-march.xml · Ready for Tally Prime / ERP 9 import</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="relative border-t border-slate-800/80 bg-slate-950/80">
                    <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-8">
                        {trustCues.map((cue) => (
                            <div key={cue} className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-200">
                                {cue}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-white py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-2xl font-bold text-slate-900">Why manual workflows break at scale</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {[
                            "Manual journal posting is slow and error-prone",
                            "Spreadsheet reconciliation fails under volume",
                            "Audit-time surprises hurt client confidence",
                        ].map((item) => (
                            <div key={item} className="rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-slate-700">
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="mechanism" className="bg-slate-50 py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto mb-10 max-w-3xl text-center">
                        <h2 className="text-3xl font-bold text-slate-900">Why this works in real accounting workflows</h2>
                        <p className="mt-3 text-slate-600">TradeBooks AI is designed around reconciliation and audit realities, not generic CSV parsing.</p>
                    </div>
                    <div className="grid gap-5 md:grid-cols-3">
                        {pillars.map((pillar) => (
                            <div key={pillar.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Mechanism pillar</p>
                                <h3 className="mt-2 text-lg font-semibold text-slate-900">{pillar.title}</h3>
                                <p className="mt-3 text-sm leading-relaxed text-slate-600">{pillar.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="who-its-for" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900">Who it&apos;s for</h2>
                    <div className="mt-8 grid gap-5 md:grid-cols-3">
                        {segments.map((segment) => (
                            <div key={segment.title} className="rounded-xl border border-slate-200 bg-slate-50 p-6">
                                <h3 className="text-lg font-semibold text-slate-900">{segment.title}</h3>
                                <p className="mt-3 text-sm text-slate-600">{segment.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="bg-slate-50 py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto mb-10 max-w-2xl text-center">
                        <h2 className="text-3xl font-bold text-slate-900">4 steps to Tally-ready books</h2>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {steps.map((step, i) => (
                            <div key={step.title} className="rounded-xl border border-slate-200 bg-white p-5">
                                <p className="text-xs font-semibold tracking-wide text-indigo-600">0{i + 1}</p>
                                <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
                                <p className="mt-2 text-sm text-slate-600">{step.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="proof" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-8 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7">
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Product proof</p>
                            <h2 className="mt-2 text-2xl font-bold text-slate-900">Show the audit chain, not marketing promises</h2>
                            <p className="mt-4 text-sm text-slate-600">The platform is built to prove what happened from source export to generated XML, so teams can review with confidence.</p>
                            <ul className="mt-5 space-y-3">
                                {proofPoints.map((point) => (
                                    <li key={point} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                        {point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-7 text-slate-100">
                            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Artifact preview</p>
                            <div className="mt-5 space-y-3">
                                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">Row 1934 (Tradebook) → Voucher #JV-00842</div>
                                <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm">Exception E-011: Missing contract note reference</div>
                                <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-4 text-sm text-indigo-100">Export generated: march-2026-vouchers.xml</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="comparison" className="bg-slate-50 py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mx-auto mb-8 max-w-3xl text-center">
                        <h2 className="text-3xl font-bold text-slate-900">Compared to alternatives</h2>
                        <p className="mt-3 text-slate-600">A focused Zerodha-to-Tally workflow beats generic templates and manual spreadsheet loops.</p>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 text-white">
                                <tr>
                                    <th className="px-4 py-3">Criteria</th>
                                    <th className="px-4 py-3">Manual Excel Workflow</th>
                                    <th className="px-4 py-3">Generic Parser</th>
                                    <th className="px-4 py-3">TradeBooks AI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {[
                                    ["Reconciliation before posting", "Mostly manual", "Partial", "Built-in by default"],
                                    ["Investor / Trader accounting mode", "Manual policy sheets", "Often absent", "Explicit workflow step"],
                                    ["Audit traceability", "Hard to maintain", "Limited", "Row-to-voucher mapping"],
                                    ["Tally XML readiness", "Manual formatting", "Inconsistent", "Native Prime / ERP 9 output"],
                                ].map((row) => (
                                    <tr key={row[0]}>
                                        {row.map((cell, i) => (
                                            <td key={cell} className={`px-4 py-3 ${i === 3 ? "font-semibold text-indigo-700" : "text-slate-600"}`}>
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section id="features" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-10 lg:grid-cols-2">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900">
                                Built for accounting precision, not generic parsing.
                            </h2>
                            <p className="mt-4 text-slate-600">
                                Purpose-built for the Zerodha-to-Tally workflow with a practical,
                                exception-first operating model.
                            </p>
                        </div>
                        <ul className="space-y-3">
                            {features.map((feature) => (
                                <li key={feature} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </section>

            <section className="bg-slate-50 py-20">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center text-3xl font-bold text-slate-900">Security, workflow, and implementation FAQs</h2>
                    <div className="mt-10 space-y-7">
                        {faqs.map((f) => (
                            <div key={f.q}>
                                <h3 className="text-lg font-semibold text-slate-900">{f.q}</h3>
                                <p className="mt-2 text-slate-600">{f.a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-indigo-600 py-20 text-center text-white">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold sm:text-4xl">Ready to automate your Zerodha accounting?</h2>
                    <p className="mt-4 text-indigo-100">
                        Stop typing journal entries. Start reviewing reconciled books.
                    </p>
                    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                        <Link
                            href="/upload"
                            className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50"
                        >
                            Start with Your First Upload
                        </Link>
                        <Link
                            href="#how-it-works"
                            className="inline-flex h-12 items-center justify-center rounded-lg border border-indigo-300 px-7 text-sm font-medium text-white transition hover:bg-indigo-700"
                        >
                            Review the Workflow
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}