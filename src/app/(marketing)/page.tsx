import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

const faqs = [
    {
        q: "Do I need to connect Zerodha or Tally directly?",
        a: "No. V1 follows a secure upload-and-export workflow: upload Zerodha exports, review exceptions, then import generated XML into Tally.",
    },
    {
        q: "Is this a replacement for Tally?",
        a: "No. TradeBooks AI is a bridge from broker exports to your existing Tally workflow.",
    },
    {
        q: "Can I verify entries before import?",
        a: "Yes. Entries are traceable to source data, and exceptions are highlighted before export.",
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
                    </div>

                    <Card className="border-slate-800 bg-slate-900/80 text-slate-100 shadow-2xl shadow-indigo-900/20">
                        <CardContent className="p-6 sm:p-8">
                            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                                Output Preview
                            </p>
                            <div className="mt-5 space-y-4">
                                <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">
                                    <p className="text-sm font-semibold text-slate-100">Zerodha Exports In</p>
                                    <p className="mt-1 text-xs text-slate-400">Tradebook · Funds · Holdings · Contract Notes</p>
                                </div>
                                <div className="text-center text-xs font-semibold uppercase tracking-wide text-indigo-300">
                                    Parse · Reconcile · Validate
                                </div>
                                <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-4">
                                    <p className="text-sm font-semibold text-indigo-100">Tally XML Out</p>
                                    <p className="mt-1 text-xs text-indigo-200/90">Import-ready for Tally Prime / ERP 9</p>
                                </div>
                            </div>
                            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                                {[
                                    ["4-step", "workflow"],
                                    ["Audit", "traceability"],
                                    ["V1", "Zerodha-first"],
                                ].map(([a, b]) => (
                                    <div key={a} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-3">
                                        <p className="text-sm font-semibold text-white">{a}</p>
                                        <p className="text-[11px] text-slate-400">{b}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="bg-white py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
                    <h2 className="text-center text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
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
                            Get Started Free
                        </Link>
                        <Link
                            href="/pricing"
                            className="inline-flex h-12 items-center justify-center rounded-lg border border-indigo-300 px-7 text-sm font-medium text-white transition hover:bg-indigo-700"
                        >
                            View Pricing
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}