import Link from "next/link";
import Image from "next/image";
import {
    ArrowRight,
    BadgeCheck,
    Clock3,
    FileSpreadsheet,
    FileText,
    Radar,
    Send,
    ShieldCheck,
    Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const heroStats = [
    { value: "Zerodha-first", label: "Built around the Console exports you already use" },
    { value: "Exception-first", label: "Review mismatches before they reach Tally" },
    { value: "Tally-native", label: "Output formatted for Tally Prime and ERP 9" },
];

const trustBarItems = [
    "Built for Indian Tax/Audit workflows",
    "Secure processing (No AI training on your data)",
    "Compatible with Tally Prime & ERP 9",
];

const ecosystemMarks = [
    { name: "Zerodha", sub: "Console Exports", logo: "Z" },
    { name: "TallyPrime", sub: "XML Import", logo: "T" },
    { name: "Tally ERP 9", sub: "Legacy Support", logo: "T" },
    { name: "CA Stack", sub: "Practice Workflows", logo: "CA" },
    { name: "Audit Trail", sub: "Row-Level Proof", logo: "AT" },
    { name: "Compliance", sub: "Close Controls", logo: "C" },
];

const outputFlow = [
    {
        title: "Zerodha CSV",
        text: "Tradebook, funds, holdings, and contract note exports from Console.",
        tone: "border-[#D6E3F3] bg-[#F8FBFF] text-[#38506F]",
    },
    {
        title: "TradeBooks AI Engine",
        text: "Investor/Trader logic + exception-first reconciliation + voucher mapping.",
        tone: "border-[#CFE3D7] bg-[#F4FBF7] text-[#2f4f43]",
    },
    {
        title: "Tally XML",
        text: "Import-ready output with row-level traceability for Prime and ERP 9.",
        tone: "border-[#F4D7B5] bg-[#FFF8F1] text-[#8A4B19]",
    },
];

const processSteps = [
    {
        title: "Upload Zerodha exports",
        text: "Import tradebook, funds, holdings, and contract files from Console in minutes.",
        eta: "~5 mins",
        outcome: "All source files validated and ready",
    },
    {
        title: "Configure accounting mode",
        text: "Set Investor or Trader treatment and map Tally company context once for the batch.",
        eta: "~3 mins",
        outcome: "Tax treatment and ledgers aligned",
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
        cta: "Get Started Free",
        href: "/upload",
    },
    {
        name: "Pro",
        price: "₹2,999",
        period: "/month",
        description: "For CA teams closing client books every cycle.",
        points: ["Unlimited monthly batches", "Full Tally XML export", "Priority onboarding support"],
        cta: "Upgrade to Pro",
        href: "/pricing",
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

const featureCards = [
    {
        title: "Reconcile before import",
        text: "Catch and review mismatches before they enter Tally so downstream books stay cleaner.",
    },
    {
        title: "Investor & Trader accounting modes",
        text: "Apply the right treatment based on client profile without forcing one flat rule set.",
    },
    {
        title: "Traceable audit trail",
        text: "Every generated voucher links back to a specific source export row for faster verification.",
    },
    {
        title: "Tally-native XML output",
        text: "Generate import-ready files for Tally Prime and ERP 9 with less post-export cleanup.",
    },
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
    {
        q: "Will this work with brokers other than Zerodha?",
        a: "Not in V1. TradeBooks AI is currently optimized for Zerodha exports to ensure higher parsing and reconciliation quality.",
    },
    {
        q: "Do I need to map ledgers manually every time?",
        a: "No. You set Tally company context and mappings once, then reuse that setup across recurring exports.",
    },
];

export default function LandingPage() {
    return (
        <>
            <section id="hero" className="bg-[#F7F8FA] py-20 sm:py-24">
                <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
                    <div>
                        <Badge className="mb-5 border-[1.5px] border-[#93C5FD] bg-[#1E4FD8]/10 text-[#255FA0] hover:bg-[#1E4FD8]/10">
                            Built for Indian CAs & Accountants
                        </Badge>
                        <h1 className="font-sans text-[44px] font-extrabold leading-[1.1] tracking-tight text-[#0F1C2E] sm:text-[56px]">
                            Stop posting Zerodha trades manually.
                        </h1>
                        <p className="lead mt-6 max-w-xl text-[20px] font-normal leading-[1.6] text-[#374151]">
                            Upload Zerodha exports, apply Investor or Trader tax treatment, review reconciled exceptions, and generate Tally-importable XML in minutes.
                        </p>
                        <div className="mt-9">
                            <Link
                                href="/upload"
                                className="inline-flex items-center justify-center rounded-lg bg-[#1E4FD8] px-7 py-[14px] text-base font-semibold text-white transition-colors hover:bg-[#1944bb]"
                            >
                                Get Started Free
                            </Link>
                            <p className="mt-3 text-sm text-[#4B5563]">No credit card required. Import your first file free.</p>
                            <div className="mt-3">
                                <Link
                                    href="#how-it-works"
                                    className="inline-flex items-center text-sm font-medium text-[#555] hover:text-[#1A1A2E]"
                                >
                                    See How It Works <ArrowRight className="ml-1 h-3.5 w-3.5" />
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

                    <div className="relative flex items-start lg:justify-end">
                        <div className="relative w-full max-w-[640px] overflow-hidden rounded-[28px] p-1 sm:p-2">
                            <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-[#387ED1]/12 blur-2xl" />
                            <div className="pointer-events-none absolute -bottom-8 right-0 h-36 w-36 rounded-full bg-[#2D9D78]/12 blur-2xl" />

                            <div className="relative flex flex-col gap-4 sm:gap-5">
                                <div className="ml-auto w-[78%] overflow-hidden rounded-[22px] border border-[#D6E3F3] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)] sm:w-[74%]">
                                    <div className="relative">
                                        <Image
                                            src="/hero-workspace.avif"
                                            alt="TradeBooks AI workspace showing upload, voucher review, and Tally export flow"
                                            width={1200}
                                            height={800}
                                            priority
                                            sizes="(min-width: 1280px) 30vw, (min-width: 1024px) 36vw, 88vw"
                                            className="h-auto w-full rounded-[14px] object-cover"
                                        />
                                        <div className="absolute left-3 top-3 rounded-full border border-[#1E4FD8]/30 bg-white/90 px-2.5 py-1 text-[10px] font-semibold tracking-[0.03em] text-[#1E4FD8] shadow-sm backdrop-blur sm:left-4 sm:top-4 sm:text-[11px]">
                                            Exception-first reconciliation
                                        </div>
                                    </div>
                                </div>

                                <div className="mr-auto w-[92%] overflow-hidden rounded-[22px] border border-[#D6E3F3] bg-white p-2 shadow-[0_14px_32px_rgba(15,23,42,0.12)] sm:w-[88%]">
                                    <Image
                                        src="/hero-advisor.avif"
                                        alt="Accountant reviewing TradeBooks AI output"
                                        width={1100}
                                        height={733}
                                        sizes="(min-width: 1280px) 34vw, (min-width: 1024px) 40vw, 92vw"
                                        className="h-auto w-full rounded-[14px] object-cover"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="output-flow" className="border-b border-[#E2E8F0] bg-white py-14 sm:py-16">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#5f6f87]">The output, at a glance</p>
                    <h2 className="mt-3 text-center font-sans text-2xl font-bold tracking-tight text-[#1A1A2E] sm:text-3xl">
                        From broker export to Tally-importable XML
                    </h2>
                    <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                        {outputFlow.map((step, idx) => (
                            <>
                                <article key={step.title} className={`rounded-2xl border p-5 ${step.tone}`}>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.1em]">Step 0{idx + 1}</p>
                                    <h3 className="mt-2 text-lg font-semibold text-[#1A1A2E]">{step.title}</h3>
                                    <p className="mt-2 text-sm leading-7">{step.text}</p>
                                </article>
                                {idx < outputFlow.length - 1 && (
                                    <div className="mx-auto hidden h-8 w-8 items-center justify-center rounded-full border border-[#D6E3F3] bg-[#F8FBFF] text-[#1E4FD8] md:flex">
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                )}
                            </>
                        ))}
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
                        A controlled 4-step workflow designed for faster closes and cleaner downstream posting.
                    </p>
                    <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                        {processSteps.map((step, idx) => (
                            <div key={step.title} className="rounded-2xl border border-[#E2E8F0] bg-[#F7F8FA] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#1E4FD8]/15 text-[#1E4FD8]">
                                    {idx === 0 && <FileSpreadsheet className="h-5 w-5" />}
                                    {idx === 1 && <Workflow className="h-5 w-5" />}
                                    {idx === 2 && <ShieldCheck className="h-5 w-5" />}
                                    {idx === 3 && <Send className="h-5 w-5" />}
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
                            href="/upload"
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
                                <Link href="/upload" className="mt-5 inline-flex items-center text-sm font-semibold text-[#1E4FD8] group-hover:text-[#1944bb]">
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

            <section id="features" className="bg-white py-20">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E] sm:text-[36px]">Built for accounting precision, not just parsing</h2>
                    <p className="mx-auto mt-3 max-w-3xl text-center leading-8 text-[#4A5568]">
                        These are the workflow safeguards that reduce manual rework and improve close confidence.
                    </p>
                    <div className="mt-10 grid gap-5 md:grid-cols-2">
                        {featureCards.map((feature) => (
                            <article key={feature.title} className="rounded-2xl border border-[#D6E3F3] bg-[#F8FBFF] p-6">
                                <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-[#387ED1]">
                                    <BadgeCheck className="h-4 w-4" /> Core capability
                                </p>
                                <h3 className="mt-3 text-xl font-semibold text-[#1A1A2E]">{feature.title}</h3>
                                <p className="mt-3 text-sm leading-7 text-[#4A5568]">{feature.text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section id="comparison" className="bg-white pb-20">
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
                            href="/upload"
                            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#1E4FD8] px-7 text-sm font-semibold text-white hover:bg-[#1944bb]"
                        >
                            Get Started Free
                        </Link>
                        <Link
                            href="/pricing"
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