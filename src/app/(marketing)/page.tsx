import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const trustBadges = [
    "Built for Indian tax & audit workflows",
    "Secure processing (no AI training on your data)",
    "Compliant with Tally Prime & ERP 9",
];

const workflowSteps = [
    {
        title: "Upload",
        text: "Drop tradebook, funds, holdings, and contract exports directly from Zerodha Console.",
    },
    {
        title: "Configure",
        text: "Select Investor or Trader mode and confirm your Tally company context and mappings.",
    },
    {
        title: "Reconcile",
        text: "Review mismatches in an exception-first queue before anything reaches books.",
    },
    {
        title: "Export",
        text: "Generate Tally-importable XML for Tally Prime or ERP 9.",
    },
];

const features = [
    {
        title: "Reconcile before import",
        text: "Spot discrepancies before entries reach Tally, instead of discovering them during audit cleanup.",
    },
    {
        title: "Investor & Trader logic",
        text: "Use explicit accounting treatment modes based on the client profile and filing context.",
    },
    {
        title: "Traceable audit trail",
        text: "Every generated voucher can be traced back to its originating Zerodha source row.",
    },
    {
        title: "Tally-native XML output",
        text: "Generate XML that imports directly into Tally Prime and ERP 9 with no manual reshaping.",
    },
];

const problemPoints = [
    "Manual posting drains hours across every client cycle.",
    "Spreadsheet handoffs are fragile and difficult to validate at scale.",
    "Errors often surface late, during audit or finalization pressure windows.",
];

const personas = [
    {
        title: "CA Firms",
        text: "Handle multiple client books faster with standardized Zerodha-to-Tally workflows.",
    },
    {
        title: "Accounting Teams",
        text: "Reduce repetitive posting and improve reconciliation consistency across periods.",
    },
    {
        title: "Active Traders",
        text: "Keep cleaner books for filing with less manual journal entry overhead.",
    },
];

const faqItems = [
    {
        q: "Do I need to learn a new accounting system?",
        a: "No. TradeBooks AI works as a secure bridge between Zerodha file exports and your existing Tally workflow.",
    },
    {
        q: "Can I trust the generated entries to be accurate?",
        a: "Yes. Reconciliation happens before export, and exceptions are flagged clearly for review before you import.",
    },
    {
        q: "Does this handle Investor vs Trader classification?",
        a: "Yes. You can configure Investor or Trader mode based on the client and accounting treatment required.",
    },
    {
        q: "Does TradeBooks AI connect directly to Zerodha or Tally credentials?",
        a: "No. V1 is file-upload based. You upload Zerodha exports and import generated XML into Tally yourself.",
    },
    {
        q: "Will this work with brokers other than Zerodha?",
        a: "V1 is optimized for Zerodha to maintain high-quality parsing and reconciliation in this workflow.",
    },
];

export default function LandingPage() {
    return (
        <>
            <section className="relative overflow-hidden bg-slate-950 text-white" id="hero">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_45%)]" />
                <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
                    <div>
                        <Badge className="mb-4 border-indigo-400/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/20">
                            Built for Indian CAs & Accountants
                        </Badge>
                        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
                            Stop posting Zerodha trades manually.
                        </h1>
                        <p className="mt-5 max-w-xl text-lg text-slate-300">
                            Upload your broker exports, review reconciled exceptions, and generate
                            a Tally-importable XML in minutes.
                        </p>
                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/upload"
                                className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-500 px-7 text-sm font-semibold text-white hover:bg-indigo-400"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                href="#how-it-works"
                                className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-600 px-7 text-sm font-medium text-slate-200 hover:bg-slate-900"
                            >
                                See How It Works
                            </Link>
                        </div>
                        <p className="mt-4 text-sm text-slate-400">No credit card required. Import your first file free.</p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/85 p-6 shadow-2xl shadow-indigo-900/30">
                        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Live workflow preview</p>
                        <div className="mt-4 space-y-3 text-sm">
                            <div className="rounded-lg border border-slate-700 bg-slate-950 p-4">Zerodha export uploaded · 4,862 rows</div>
                            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
                                Reconciliation complete · 12 exceptions flagged before export
                            </div>
                            <div className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 p-4 text-indigo-100">
                                Output ready · march-2026-vouchers.xml
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-y border-slate-200 bg-white py-7" id="trust-strip">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 sm:px-6 md:flex-row md:flex-wrap md:items-center md:justify-between lg:px-8">
                    {trustBadges.map((item) => (
                        <p key={item} className="text-sm text-slate-600">
                            <span className="mr-2 font-semibold text-emerald-700">✓</span>
                            {item}
                        </p>
                    ))}
                </div>
            </section>

            <section className="bg-white py-20" id="proof">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center text-3xl font-bold text-slate-900">Product proof you can verify</h2>
                    <p className="mx-auto mt-3 max-w-3xl text-center text-slate-600">
                        See how TradeBooks AI transforms Zerodha exports into reconciled, Tally-ready output without manual posting.
                    </p>

                    <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
                        <div className="grid gap-4 text-sm font-medium text-slate-900 md:grid-cols-3 md:items-center">
                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-center">Zerodha CSV</div>
                            <div className="text-center text-indigo-600">→ TradeBooks AI Engine →</div>
                            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-5 text-center text-indigo-800">Tally XML</div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-5 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white p-5">
                            <h3 className="text-base font-semibold text-slate-900">Audit trail proof</h3>
                            <p className="mt-2 text-sm text-slate-600">
                                Every voucher maps directly to a source row, so you can validate exactly where each figure originated.
                            </p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                            <h3 className="text-base font-semibold text-slate-900">Exception handling proof</h3>
                            <p className="mt-2 text-sm text-slate-700">
                                Mismatches are flagged before export so incorrect entries do not silently flow into your books.
                            </p>
                        </div>
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
                            <h3 className="text-base font-semibold text-slate-900">Native Tally XML proof</h3>
                            <p className="mt-2 text-sm text-slate-700">
                                Output is generated in standard Tally import format for both Tally Prime and Tally ERP 9.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-slate-50 py-20" id="problem">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900">The manual posting bottleneck</h2>
                    <p className="mt-4 max-w-4xl text-slate-600">
                        Zerodha gives you raw transaction exports. Tally needs structured accounting entries. Bridging that gap manually with spreadsheets
                        creates rework, delays close cycles, and increases audit-time risk.
                    </p>
                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {problemPoints.map((point) => (
                            <div key={point} className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
                                {point}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="bg-slate-50 py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center text-3xl font-bold text-slate-900">4 steps to Tally-ready books</h2>
                    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {workflowSteps.map((step, idx) => (
                            <div key={step.title} className="rounded-xl border border-slate-200 bg-white p-5">
                                <p className="text-xs font-semibold tracking-wide text-indigo-600">0{idx + 1}</p>
                                <h3 className="mt-2 text-base font-semibold text-slate-900">{step.title}</h3>
                                <p className="mt-2 text-sm text-slate-600">{step.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-white py-16" id="benefits">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold text-slate-900">Built for accounting precision, not generic parsing.</h2>
                    <div className="mt-8 grid gap-4 md:grid-cols-2">
                        {features.map((f) => (
                            <div key={f.title} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                                <h3 className="text-base font-semibold text-slate-900">{f.title}</h3>
                                <p className="mt-2 text-sm text-slate-700">{f.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-slate-50 py-20" id="who-its-for">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center text-3xl font-bold text-slate-900">Who relies on TradeBooks AI?</h2>
                    <div className="mt-10 grid gap-5 md:grid-cols-3">
                        {personas.map((persona) => (
                            <div key={persona.title} className="rounded-xl border border-slate-200 bg-white p-6">
                                <h3 className="text-lg font-semibold text-slate-900">{persona.title}</h3>
                                <p className="mt-3 text-sm text-slate-600">{persona.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="comparison" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center text-3xl font-bold text-slate-900">Compared to alternatives</h2>
                    <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-900 text-white">
                                <tr>
                                    <th className="px-4 py-3">Criteria</th>
                                    <th className="px-4 py-3">Manual Excel</th>
                                    <th className="px-4 py-3">Generic Parser</th>
                                    <th className="px-4 py-3">TradeBooks AI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {[
                                    ["Zerodha-native workflow", "Formatting heavy", "Edge-case prone", "Built for Zerodha exports"],
                                    ["Exception flagging", "Late discovery", "Often blind import", "Explicitly flagged before export"],
                                    ["Investor / Trader mode", "Manual separation", "Flat treatment", "Configurable modes"],
                                    ["Tally XML readiness", "Manual formatting", "Needs cleanup", "Native output"],
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

            <section id="faq" className="bg-slate-50 py-20">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center text-3xl font-bold text-slate-900">Frequently Asked Questions</h2>
                    <div className="mt-10 space-y-4">
                        {faqItems.map((item) => (
                            <details key={item.q} className="rounded-xl border border-slate-200 bg-white p-5">
                                <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
                                    {item.q}
                                </summary>
                                <p className="mt-3 text-sm text-slate-600">{item.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <section id="final-cta" className="bg-indigo-600 py-20 text-center text-white">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-3xl font-bold sm:text-4xl">Ready to automate your Zerodha accounting?</h2>
                    <p className="mt-4 text-indigo-100">Stop typing journal entries. Start reviewing reconciled books.</p>
                    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                        <Link
                            href="/upload"
                            className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-7 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                            Get Started Free
                        </Link>
                        <Link
                            href="/pricing"
                            className="inline-flex h-12 items-center justify-center rounded-lg border border-indigo-300 px-7 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                            View Pricing
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}