import Link from "next/link";
import {
    ArrowRight,
    BadgeCheck,
    Clock3,
    FileSpreadsheet,
    FileText,
    Radar,
    Send,
    ShieldCheck,
    Sparkles,
    Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const heroStats = [
    { value: "500+", label: "CA firms streamlining closes" },
    { value: "70%", label: "less manual posting time on repeat cycles" },
    { value: "100%", label: "Tally-ready XML aligned to Indian workflows" },
];

const trustBarItems = [
    "500+ CA firms onboarded",
    "₹0 setup cost",
    "Tally XML guaranteed or we fix it",
];

const ecosystemMarks = [
    { name: "Zerodha", sub: "Console Exports", logo: "Z" },
    { name: "TallyPrime", sub: "XML Import", logo: "T" },
    { name: "Tally ERP 9", sub: "Legacy Support", logo: "T" },
    { name: "CA Stack", sub: "Practice Workflows", logo: "CA" },
    { name: "Audit Trail", sub: "Row-Level Proof", logo: "AT" },
    { name: "Compliance", sub: "Close Controls", logo: "C" },
];

const processSteps = [
    {
        title: "Upload Zerodha exports",
        text: "Import tradebook, funds, holdings, and contract files from Console in minutes.",
        eta: "~5 mins",
        outcome: "All source files validated and ready",
    },
    {
        title: "Review reconciliation",
        text: "Exceptions are flagged first so your team can validate edge cases before posting.",
        eta: "~10 mins",
        outcome: "Only confirmed entries move forward",
    },
    {
        title: "Export Tally XML",
        text: "Download Tally-ready XML with clean mapping and a traceable source-row audit trail.",
        eta: "~2 mins",
        outcome: "Import-ready package for Tally Prime / ERP 9",
    },
];

const painCards = [
    {
        metric: "18+ hrs",
        label: "lost per client each close",
        text: "Manual posting and reconciliation consume team capacity that should go into advisory and review.",
    },
    {
        metric: "3x",
        label: "more handoffs per cycle",
        text: "CSV → Excel → reviewer loops create avoidable friction and break accountability across teams.",
    },
    {
        metric: "87%",
        label: "errors discovered late",
        text: "Mismatches surface at peak filing pressure when client windows are already closed.",
    },
];

const personas = [
    {
        title: "CA Firms",
        text: "Standardize Zerodha-to-Tally workflows across multiple clients and close cycles faster.",
        sub: "For firms managing many books",
        outcome: "Build one repeatable process across your team and client portfolio.",
        accent: "from-[#EAF3FF] to-[#F5F9FF] border-[#BFD8F6] text-[#255FA0]",
    },
    {
        title: "Accounting Teams",
        text: "Reduce repetitive voucher posting work and improve consistency in every period close.",
        sub: "For internal finance operations",
        outcome: "Shift effort from manual posting to review, controls, and reporting.",
        accent: "from-[#EAFBF3] to-[#F4FDF8] border-[#B9E7CF] text-[#1E7A58]",
    },
    {
        title: "Active Traders",
        text: "Maintain cleaner books for filing with less manual accounting overhead.",
        sub: "For high-frequency retail/pro traders",
        outcome: "Keep records cleaner with less bookkeeping stress at tax time.",
        accent: "from-[#FFF4EA] to-[#FFFAF5] border-[#F4D2B5] text-[#A25622]",
    },
];

const exportPreviewRows = [
    {
        date: "05 Mar 2026",
        symbol: "RELIANCE EQ · CNC",
        voucher: "Journal · STCG",
        amount: "₹24,580",
        status: "Ready",
        source: "tradebook.csv · row 248",
    },
    {
        date: "05 Mar 2026",
        symbol: "HDFCBANK EQ · MIS",
        voucher: "Journal · Intraday",
        amount: "₹8,120",
        status: "Ready",
        source: "contract-note.csv · row 91",
    },
    {
        date: "05 Mar 2026",
        symbol: "INFY EQ · CNC",
        voucher: "Journal · STCG",
        amount: "₹12,040",
        status: "Needs review",
        source: "funds.csv · row 36",
    },
];

const testimonials = [
    {
        quote: "Earlier we were spending half a day posting and re-checking one active trading client. Now my team reviews exceptions first and exports in one pass.",
        name: "Rajesh Bhatia",
        role: "Senior CA Partner, Mumbai Practice",
        avatar: "RB",
    },
    {
        quote: "The row-level traceability gives us confidence during audit prep. We can show exactly where each voucher came from without hunting across sheets.",
        name: "Shreya Iyer",
        role: "Accounts Lead, Investment Ops Team",
        avatar: "SI",
    },
];

const pricingPlans = [
    {
        name: "Free",
        price: "₹0",
        period: "/month",
        description: "Best for trying your first Zerodha-to-Tally workflow.",
        points: ["1 active entity", "Upload + exception preview", "Sample export package"],
        cta: "Start Free Workflow",
        href: process.env.NODE_ENV === "production" ? "#" : "/upload",
    },
    {
        name: "Pro",
        price: "₹2,999",
        period: "/month",
        description: "For CA teams closing client books every cycle.",
        points: ["Unlimited monthly batches", "Full Tally XML export", "Priority onboarding support"],
        cta: "Upgrade to Pro",
        href: process.env.NODE_ENV === "production" ? "#" : "/pricing",
        featured: true,
    },
];

const comparisonRows = [
    ["Zerodha-ready workflow", "Formatting heavy", "Edge-case misses", "Built for Zerodha exports"],
    ["Exception handling", "Late discovery", "Often blind import", "Clear pre-export checks"],
    ["Investor / Trader modes", "Manual split", "Flat logic", "Configurable treatment"],
    ["Tally XML quality", "Manual cleanup", "Needs rework", "Native import format"],
    ["Price", "Hidden team-hour cost", "Tool fee + rework overhead", "₹2,999/mo with guided onboarding"],
];

const faqs = [
    {
        q: "Does TradeBooks AI connect directly to my Zerodha account?",
        a: "No. You upload exports you already download from Zerodha Console. We do not require your Zerodha login credentials.",
    },
    {
        q: "Does it connect directly to my Tally database?",
        a: "No. TradeBooks AI generates standard Tally-importable XML. You import it into Tally Prime or ERP 9 from your side.",
    },
    {
        q: "What if uploaded files have missing entries or mismatches?",
        a: "The workflow is exception-first. Missing funds entries, amount mismatches, and similar issues are flagged before export so books stay clean.",
    },
    {
        q: "Can I verify what voucher was created from which source row?",
        a: "Yes. Every generated voucher has traceability back to its originating Zerodha export row for faster validation and audit confidence.",
    },
    {
        q: "Will this disrupt our current accounting process?",
        a: "No. TradeBooks AI sits between your broker exports and existing Tally workflow. Your close process stays familiar, just faster and cleaner.",
    },
    {
        q: "Is setup complex for CA teams with multiple clients?",
        a: "Setup is lightweight. Teams standardize one repeatable upload-review-export flow and apply it across client cycles.",
    },
    {
        q: "Does this support Investor and Trader accounting modes?",
        a: "Yes. You can choose the appropriate treatment based on the client profile and reporting requirement.",
    },
    {
        q: "How is data privacy handled?",
        a: "Processing is secure, scoped to your workflow, and we do not need broker or Tally credentials to generate exports.",
    },
];

export default function LandingPage() {
    return (
        <>
            <section id="hero" className="bg-[#F7F8FA] py-20 sm:py-24">
                <section id="hero" className="bg-white py-20 sm:py-24">
                    <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
                        <div>
                            <Badge className="mb-5 border-[1.5px] border-[#93C5FD] bg-[#1E4FD8]/10 text-[#255FA0] hover:bg-[#1E4FD8]/10">
                                Built for Indian CAs & Accountants
                            </Badge>
                            <h1 className="font-sans text-[44px] font-extrabold leading-[1.1] tracking-tight text-[#0F1C2E] sm:text-[56px]">
                                Close Zerodha books faster with Tally-ready exports your team can trust.
                            </h1>
                            <p className="lead mt-6 max-w-xl text-[20px] font-normal leading-[1.6] text-[#374151]">
                                Stop losing hours in manual posting and spreadsheet back-and-forth. Upload broker files, review exceptions first, and export clean XML in a repeatable CA-ready workflow.
                            </p>
                            <div className="mt-9">
                                <Link
                                    href={process.env.NODE_ENV === "production" ? "#" : "/upload"}
                                    className="inline-flex items-center justify-center rounded-lg bg-[#1E4FD8] px-7 py-[14px] text-base font-semibold text-white transition-colors hover:bg-[#1944bb]"
                                >
                                    Start Free Workflow
                                </Link>
                                <div className="mt-3">
                                    <Link
                                        href="#how-it-works"
                                        className="inline-flex items-center text-sm font-medium text-[#555] hover:text-[#1A1A2E]"
                                    >
                                        See 3-Step Process <ArrowRight className="ml-1 h-3.5 w-3.5" />
                                    </Link>
                                </div>
                            </div>

                            <div className="mt-8 flex max-w-xl flex-wrap items-center gap-y-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-6 py-3">
                                {trustBarItems.map((item, idx) => (
                                    <div key={item} className="flex items-center">
                                        <span className="text-[13px] font-medium text-[#374151]">{item}</span>
                                        {idx < trustBarItems.length - 1 && <span className="mx-3 h-4 w-px bg-[#D1D5DB]" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] sm:p-6">
                            <div className="flex items-center gap-1.5 pb-4">
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                            </div>
                            <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F3F6FB] p-4 text-sm">
                                <div className="flex items-center justify-between rounded-lg bg-white p-3">
                                    <span className="font-medium text-[#1A1A2E]">RELIANCE EQ · CNC</span>
                                    <span className="text-[#2D9D78]">Matched</span>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-white p-3">
                                    <span className="font-medium text-[#1A1A2E]">HDFCBANK EQ · MIS</span>
                                    <span className="text-[#2D9D78]">Matched</span>
                                </div>
                                <div className="flex items-center justify-between rounded-lg bg-white p-3">
                                    <span className="font-medium text-[#1A1A2E]">INFY EQ · CNC</span>
                                    <span className="text-amber-600">Needs review</span>
                                </div>
                                <div className="rounded-lg border border-dashed border-[#C7D7EC] bg-white/70 p-3 text-xs text-[#617188]">
                                    Batch quality checks complete. Ready for final export review.
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#D6E3F3] bg-[#F8FBFF] px-3 py-2 text-xs font-semibold text-[#38506F]">
                                <span className="inline-flex items-center gap-1.5 text-[#2D9D78]"><BadgeCheck className="h-3.5 w-3.5" /> 42 vouchers ready</span>
                                <span className="text-amber-700">2 flagged</span>
                                <span className="inline-flex items-center gap-1 text-[#1E4FD8]"><Sparkles className="h-3.5 w-3.5" /> Export ready</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="stats" className="border-y border-[#E2E8F0] bg-white py-8">
                    <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:grid-cols-3 sm:px-6 lg:px-8">
                        {heroStats.map((stat) => (
                            <div key={stat.label} className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-4 text-center">
                                <p className="text-3xl font-extrabold tracking-tight text-[#1A1A2E]">{stat.value}</p>
                                <p className="mt-1.5 text-sm leading-6 text-[#4A5568]">{stat.label}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section id="trust-strip" className="border-b border-[#E2E8F0] bg-white py-6">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <p className="text-center text-xs font-semibold tracking-[0.12em] text-[#718096]">
                            Designed for the ecosystem you already use
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                            {ecosystemMarks.map((item) => (
                                <div
                                    key={item.name}
                                    className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3 text-center"
                                >
                                    <p className="inline-flex items-center text-sm font-semibold text-[#475569]">
                                        <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-[#1E4FD8]/10 text-[10px] font-bold text-[#1E4FD8]">
                                            {item.logo}
                                        </span>
                                        {item.name}
                                    </p>
                                    <p className="mt-0.5 text-[11px] tracking-wide text-[#7b8797]">{item.sub}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="problem" className="bg-[#0F1C2E] py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-white sm:text-[36px]">Why manual posting breaks at scale</h2>
                        <p className="mx-auto mt-4 max-w-3xl text-center leading-8 text-slate-200">
                            As client volume grows, spreadsheet-led workflows slow close cycles, increase review friction, and expose teams to late-stage surprises.
                        </p>

                        <div className="mt-10 grid gap-5 md:grid-cols-3">
                            {painCards.map((card) => (
                                <div key={card.label} className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-6">
                                    <p className="text-[56px] font-bold leading-none tracking-tight text-white">{card.metric}</p>
                                    <p className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] text-[#7fb0e5]">{card.label}</p>
                                    <p className="mt-4 text-sm leading-7 text-slate-100">{card.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="testimonials" className="bg-white py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">Early-user proof from real close cycles</h2>
                        <p className="mx-auto mt-3 max-w-3xl text-center text-base font-normal leading-[1.7] text-[#4B5563]">
                            Initial feedback from teams running Zerodha-to-Tally workflows with exception-first review.
                        </p>
                        <div className="mt-10 grid gap-5 md:grid-cols-2">
                            {testimonials.map((item) => (
                                <article key={item.name} className="rounded-2xl border border-[#D6E3F3] bg-white p-6 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
                                    <p className="text-[15px] leading-8 text-[#334155]">“{item.quote}”</p>
                                    <div className="mt-5 flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1E4FD8] text-base font-bold text-white">
                                            {item.avatar}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-[#1A1A2E]">{item.name}</p>
                                            <p className="text-xs tracking-[0.04em] text-[#5f6f87]">{item.role}</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="how-it-works" className="bg-[#F3F6FB] py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">How it works</h2>
                        <p className="mx-auto mt-3 max-w-3xl text-center text-base font-normal leading-[1.7] text-[#4B5563]">
                            A controlled 3-step workflow designed for faster closes and cleaner downstream posting.
                        </p>
                        <div className="mt-10 grid gap-5 md:grid-cols-3">
                            {processSteps.map((step, idx) => (
                                <div key={step.title} className="rounded-2xl border border-[#E2E8F0] bg-[#F7F8FA] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E4FD8]/15 text-[#1E4FD8]">
                                        {idx === 0 && <FileSpreadsheet className="h-5 w-5" />}
                                        {idx === 1 && <ShieldCheck className="h-5 w-5" />}
                                        {idx === 2 && <Send className="h-5 w-5" />}
                                    </div>
                                    <p className="mt-4 text-[11px] font-bold tracking-[0.14em] text-[#1E4FD8]">STEP 0{idx + 1}</p>
                                    <h3 className="mt-2 text-lg font-semibold text-[#1A1A2E]">{step.title}</h3>
                                    <p className="mt-2 text-sm leading-7 text-[#4A5568]">{step.text}</p>
                                    <div className="mt-4 space-y-2 rounded-lg border border-[#D6E3F3] bg-white p-3 text-xs text-[#42526b]">
                                        <p className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-[#1E4FD8]" /> Time: {step.eta}</p>
                                        <p className="inline-flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-[#2D9D78]" /> Outcome: {step.outcome}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 flex justify-center">
                            <Link
                                href={process.env.NODE_ENV === "production" ? "#" : "/upload"}
                                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#1E4FD8]/30 bg-[#1E4FD8]/10 px-5 text-sm font-semibold text-[#1E4FD8] transition-colors hover:bg-[#1E4FD8]/15"
                            >
                                Try this workflow on your next close <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

                <section id="who-its-for" className="bg-white py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">Who it’s for</h2>
                        <p className="mx-auto mt-3 max-w-3xl text-center leading-8 text-[#4A5568]">
                            Pick the profile closest to your workflow and see where TradeBooks AI fits best.
                        </p>
                        <div className="mt-10 grid gap-5 md:grid-cols-3">
                            {personas.map((persona, idx) => (
                                <div key={persona.title} className="group rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-transform hover:-translate-y-0.5">
                                    <div className={`relative mb-5 overflow-hidden rounded-xl border bg-gradient-to-br p-4 ${persona.accent}`}>
                                        <div className="absolute -right-4 -top-6 h-16 w-16 rounded-full bg-[#387ED1]/10" />
                                        <div className="absolute -bottom-6 -left-4 h-14 w-14 rounded-full bg-[#2D9D78]/10" />
                                        <div className="relative flex items-center justify-between rounded-lg border border-white/70 bg-white/90 p-3">
                                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b84]">{persona.sub}</p>
                                            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#387ED1]/15 text-[#387ED1]">
                                                {idx === 0 && <Workflow className="h-4 w-4" />}
                                                {idx === 1 && <Radar className="h-4 w-4" />}
                                                {idx === 2 && <FileText className="h-4 w-4" />}
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-semibold text-[#1A1A2E]">{persona.title}</h3>
                                    <p className="mt-3 text-sm leading-7 text-[#4A5568]">{persona.text}</p>
                                    <p className="mt-3 text-sm leading-7 text-[#334155]">{persona.outcome}</p>
                                    <Link href={process.env.NODE_ENV === "production" ? "#" : "/upload"} className="mt-5 inline-flex items-center text-sm font-semibold text-[#1E4FD8] group-hover:text-[#1944bb]">
                                        Know more <ArrowRight className="ml-1.5 h-4 w-4" />
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="proof" className="bg-white py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">See exactly what gets exported</h2>
                        <p className="mx-auto mt-3 max-w-3xl text-center leading-8 text-[#4A5568]">
                            Practical, row-level evidence from source file to Tally-ready XML output — with exceptions surfaced before export.
                        </p>

                        <div className="mt-10 overflow-hidden rounded-2xl border border-[#D6E3F3] bg-[#F8FBFF]">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D6E3F3] bg-white px-5 py-4">
                                <p className="text-sm font-semibold text-[#1A1A2E]">Export Preview · Batch #TB-2026-03-05-18</p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full border border-[#2D9D78]/30 bg-[#2D9D78]/10 px-2.5 py-1 text-xs font-semibold text-[#2D9D78]">
                                        <BadgeCheck className="h-3.5 w-3.5" /> 42 vouchers ready
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                        <ShieldCheck className="h-3.5 w-3.5" /> Exceptions flagged: 2
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto px-3 py-4 sm:px-5">
                                <table className="min-w-full text-left text-sm">
                                    <thead className="text-xs uppercase tracking-[0.08em] text-[#5f6f87]">
                                        <tr>
                                            <th className="px-3 py-2 font-semibold">Date</th>
                                            <th className="px-3 py-2 font-semibold">Instrument</th>
                                            <th className="px-3 py-2 font-semibold">Voucher Type</th>
                                            <th className="px-3 py-2 font-semibold">Amount</th>
                                            <th className="px-3 py-2 font-semibold">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                                        {exportPreviewRows.map((row) => (
                                            <tr key={`${row.symbol}-${row.source}`} className="bg-white/80">
                                                <td className="px-3 py-3">{row.date}</td>
                                                <td className="px-3 py-3 font-medium text-[#1A1A2E]">{row.symbol}</td>
                                                <td className="px-3 py-3">{row.voucher}</td>
                                                <td className="px-3 py-3">{row.amount}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "Ready" ? "bg-[#2D9D78]/10 text-[#2D9D78]" : "bg-amber-50 text-amber-700"}`}>
                                                        {row.status}
                                                    </span>
                                                    <p className="mt-1 text-xs text-[#5f6f87]">Source link: {row.source}</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D6E3F3] bg-white px-5 py-4 text-sm">
                                <p className="inline-flex items-center gap-1.5 text-[#334155]">
                                    <FileText className="h-4 w-4 text-[#387ED1]" /> Row-link traceability included in exported package.
                                </p>
                                <p className="inline-flex items-center gap-1.5 text-[#334155]">
                                    <FileSpreadsheet className="h-4 w-4 text-[#387ED1]" /> Compatible with Tally Prime and Tally ERP 9 import format.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="comparison" className="bg-white py-20">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">Compared to alternatives</h2>
                        <div className="mt-8 overflow-hidden rounded-2xl border border-[#E2E8F0]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#F7F8FA] text-[#1A1A2E]">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">Criteria</th>
                                        <th className="px-4 py-3 font-semibold">Manual Excel</th>
                                        <th className="px-4 py-3 font-semibold">Generic Parser</th>
                                        <th className="px-4 py-3 font-semibold bg-[#EAF3FF]">
                                            <div className="inline-flex items-center gap-2">
                                                TradeBooks AI
                                                <span className="rounded-full border border-[#387ED1]/25 bg-[#387ED1]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#387ED1]">
                                                    ✓ Recommended
                                                </span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E2E8F0] bg-white text-[#4A5568]">
                                    {comparisonRows.map((row) => (
                                        <tr key={row[0]}>
                                            {row.map((cell, idx) => (
                                                <td
                                                    key={cell}
                                                    className={`px-4 py-3 ${idx === 0 ? "font-medium text-[#1A1A2E]" : ""} ${idx === 3 ? "bg-[#F5F9FF] font-semibold text-[#387ED1]" : ""}`}
                                                >
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

                <section id="pricing" className="bg-white py-20">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">Simple pricing for every close stage</h2>
                        <p className="mx-auto mt-3 max-w-3xl text-center leading-8 text-[#4A5568]">
                            Start free to validate your workflow, then move to Pro once your team is ready for production exports.
                        </p>
                        <p className="mx-auto mt-3 max-w-3xl text-center text-sm font-medium text-[#374151]">
                            18 hrs of manual posting = ₹6,000–9,000 in billable time lost. TradeBooks AI: ₹2,999/mo.
                        </p>
                        <div className="mt-10 grid gap-5 md:grid-cols-2">
                            {pricingPlans.map((plan) => (
                                <article
                                    key={plan.name}
                                    className={`rounded-2xl border p-7 ${plan.featured ? "border-[#387ED1] bg-[#F5F9FF] shadow-[0_14px_32px_rgba(56,126,209,0.18)]" : "border-[#E2E8F0] bg-white"}`}
                                >
                                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#5f6f87]">{plan.name}</p>
                                    <div className="mt-3 flex items-end gap-1.5">
                                        <p className="text-4xl font-extrabold text-[#1A1A2E]">{plan.price}</p>
                                        <p className="text-sm text-[#64748B]">{plan.period}</p>
                                    </div>
                                    <p className="mt-3 text-sm leading-7 text-[#475569]">{plan.description}</p>
                                    <ul className="mt-5 space-y-2.5 text-sm text-[#334155]">
                                        {plan.points.map((point) => (
                                            <li key={point} className="inline-flex items-start gap-2">
                                                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2D9D78]" /> {point}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link
                                        href={plan.href}
                                        className={`mt-7 inline-flex h-11 w-full items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${plan.featured ? "border-[#387ED1] bg-[#387ED1] text-white hover:bg-[#2f6db7]" : "border-[#C7D7EC] text-[#1A1A2E] hover:bg-[#F7F8FA]"}`}
                                    >
                                        {plan.cta}
                                    </Link>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="faq" className="bg-white py-20">
                    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">Frequently Asked Questions</h2>
                        <div className="mt-10 space-y-4">
                            {faqs.map((item) => (
                                <details key={item.q} className="rounded-xl border border-[#E2E8F0] bg-white p-5">
                                    <summary className="cursor-pointer list-none text-lg font-semibold leading-7 text-[#1A1A2E]">
                                        {item.q}
                                    </summary>
                                    <p className="mt-3 text-sm leading-7 text-[#4A5568]">{item.a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="final-cta" className="bg-white py-20 text-center">
                    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                        <h2 className="font-sans text-3xl font-semibold text-[#1A1A2E] sm:text-4xl">Close faster with fewer exceptions and clean Tally imports.</h2>
                        <p className="mt-4 text-[#4B5563]">Move from manual posting to exception-first review and export ready XML your team can trust each cycle.</p>
                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link
                                href={process.env.NODE_ENV === "production" ? "#" : "/upload"}
                                className="inline-flex h-12 items-center justify-center rounded-lg bg-[#1E4FD8] px-7 text-sm font-semibold text-white hover:bg-[#1944bb]"
                            >
                                Get Started Free
                            </Link>
                            <Link
                                href={process.env.NODE_ENV === "production" ? "#" : "#pricing"}
                                className="inline-flex h-12 items-center justify-center rounded-lg border-2 border-[#D1D5DB] px-7 text-sm font-medium text-[#1A1A2E] hover:bg-[#F9FAFB]"
                            >
                                View Pricing
                            </Link>
                        </div>
                    </div>
                </section>
            </>
            );
}