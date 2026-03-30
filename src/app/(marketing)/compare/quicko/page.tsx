import Link from "next/link";
import { Metadata } from "next";
import {
    ArrowRight,
    BadgeCheck,
    AlertTriangle,
    ShieldCheck,
    Scale,
    CheckCircle2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "TradeBooks AI vs Quicko | Broker Export Reconciliation",
    description: "Compare TradeBooks AI and Quicko. Learn why retail traders prefer Quicko for fast DIY tax filing, while CAs and prop desks use TradeBooks AI for rigorous Tally accounting.",
};

const comparisonRows = [
    { feature: "Primary Purpose", us: "Tally XML accounting automation", competitor: "Direct ITR tax filing" },
    { feature: "Output Format", us: "Tally-importable Vouchers (XML)", competitor: "Pre-filled tax returns" },
    { feature: "Target Audience", us: "CAs, Accountants, and Prop Traders", competitor: "Retail investors self-filing" },
    { feature: "Audit Trail", us: "Source-row traceability per voucher", competitor: "Summary tax calculations" },
    { feature: "Reconciliation", us: "Exception-first visual review", competitor: "Automated black-box mapping" },
    { feature: "Accounting Modes", us: "Configurable Investor / Trader logic", competitor: "Standardized tax rules" },
];

const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'Is TradeBooks AI an alternative to Quicko?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'They serve different purposes. Quicko is a tax platform designed to help retail investors file their ITR directly. TradeBooks AI is a bookkeeping automation tool designed to help Chartered Accountants and professional traders convert broker exports into accurate, Tally-importable XML ledgers.'
            }
        },
        {
            '@type': 'Question',
            name: 'Who should use TradeBooks AI instead of Quicko?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'You should use TradeBooks AI if you need to maintain proper double-entry accounting books in Tally Prime or ERP 9. This is essential for CA firms managing client portfolios, prop trading desks, and businesses where trading is a primary operation that requires rigorous audit trails.'
            }
        },
        {
            '@type': 'Question',
            name: 'Does TradeBooks AI file my taxes like Quicko?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. TradeBooks AI generates standard Tally XML vouchers. You or your Chartered Accountant will import this data into Tally to finalize your books and compute taxes according to your specific accounting methods.'
            }
        }
    ]
};

export default function TradeBooksVsQuicko() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />

            {/* ── Hero ── */}
            <section className="bg-[#F7F8FA] pt-20 pb-16 sm:pt-28 sm:pb-24 border-b border-[#E2E8F0]">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center text-balance flex flex-col items-center">
                    <Badge className="mb-5 border-[1.5px] border-[#93C5FD] bg-[#1E4FD8]/10 text-[#255FA0] hover:bg-[#1E4FD8]/10">
                        Compare Broker Export Tools
                    </Badge>
                    <h1 className="font-sans text-[38px] font-extrabold leading-[1.1] tracking-tight text-[#0F1C2E] sm:text-[48px]">
                        TradeBooks AI vs. Quicko
                    </h1>
                    <p className="mt-6 text-[19px] font-normal leading-[1.6] text-[#374151] max-w-2xl">
                        Two excellent tools for two completely different workflows. Ask yourself: <strong>Are you a retail trader looking to file your taxes quickly, or an accounting professional who needs clean double-entry books in Tally?</strong>
                    </p>
                </div>
            </section>

            {/* ── TLDR Section ── */}
            <section className="bg-white py-16">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-8 md:grid-cols-2">
                        {/* Competitor Card */}
                        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F7F8FA] p-8 shadow-sm">
                            <h3 className="text-xl font-bold text-[#1A1A2E]">Summary: Quicko</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
                                Quicko is the industry standard for retail investors who want to file their taxes directly. It ingests broker data and bypasses traditional bookkeeping to generate ready-to-file ITR forms.
                            </p>
                        </div>
                        
                        {/* TradeBooks AI Card */}
                        <div className="rounded-2xl border-2 border-[#1E4FD8] bg-[#F4F8FF] p-8 shadow-[0_10px_30px_rgba(30,79,216,0.08)]">
                            <h3 className="text-xl font-bold text-[#1E4FD8]">Summary: TradeBooks AI</h3>
                            <p className="mt-3 text-sm leading-relaxed text-[#0F1C2E] font-medium">
                                TradeBooks AI is an automation engine that turns complex Zerodha exports into rigorous, double-entry Tally vouchers with full row-level audit traceability. It is built strictly for CAs and accounting teams.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Honest "Who Is Best" Section ── */}
            <section className="bg-white py-16 border-t border-[#E2E8F0]">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center font-sans text-3xl font-bold tracking-tight text-[#1A1A2E]">
                        Who should use which tool?
                    </h2>
                    
                    <div className="mt-12 grid gap-10 md:grid-cols-2">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
                                <AlertTriangle className="h-4 w-4 text-orange-500" /> Choose Quicko if:
                            </div>
                            <ul className="space-y-4 text-[#374151]">
                                <li className="flex gap-3">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                                    <span>You are a self-filing retail investor who just wants tax season to be over quickly.</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                                    <span>You don&apos;t care about maintaining double-entry accounting ledgers or balance sheets.</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                                    <span>You aren&apos;t using Tally Prime or ERP 9 for your business operations.</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#1E4FD8]/20 bg-[#1E4FD8]/10 px-3 py-1.5 text-sm font-semibold text-[#1E4FD8]">
                                <BadgeCheck className="h-4 w-4 text-[#1E4FD8]" /> Choose TradeBooks AI if:
                            </div>
                            <ul className="space-y-4 text-[#1A1A2E] font-medium">
                                <li className="flex gap-3">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2D9D78] mt-0.5" />
                                    <span>You are a CA managing multiple trading clients and need to finalize their hooks in Tally.</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2D9D78] mt-0.5" />
                                    <span>You are a proprietary trading desk that requires rigorous audit trails and clean ledgers.</span>
                                </li>
                                <li className="flex gap-3">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#2D9D78] mt-0.5" />
                                    <span>You need to pre-reconcile messy exports and review exceptions <strong>before</strong> posting vouchers.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Feature Comparison Table ── */}
            <section className="bg-white pb-20 pt-10">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center font-sans text-2xl font-bold tracking-tight text-[#1A1A2E] mb-10">
                        The Architectural Difference
                    </h2>
                    
                    <div className="overflow-hidden rounded-xl border border-[#D6E3F3] shadow-sm">
                        <table className="w-full text-left text-sm md:text-base">
                            <thead className="bg-[#F8FBFF] text-[#1A1A2E]">
                                <tr>
                                    <th className="px-5 py-4 font-semibold w-1/3">Criteria</th>
                                    <th className="px-5 py-4 font-semibold w-1/3">Quicko</th>
                                    <th className="px-5 py-4 font-semibold text-[#1E4FD8] bg-[#F0F5FF] w-1/3">TradeBooks AI</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F0] bg-white text-[#475569]">
                                {comparisonRows.map((row) => (
                                    <tr key={row.feature} className="hover:bg-[#F8FBFF]/50 transition-colors">
                                        <td className="px-5 py-4 font-medium text-[#1A1A2E]">{row.feature}</td>
                                        <td className="px-5 py-4">{row.competitor}</td>
                                        <td className="px-5 py-4 bg-[#F8FBFF] font-medium text-[#1E4FD8]">{row.us}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ── Deep Dives ── */}
            <section className="bg-[#F7F8FA] py-20 border-y border-[#E2E8F0]">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <h2 className="text-center font-sans text-3xl font-bold tracking-tight text-[#1A1A2E] mb-12">
                        Why the difference matters for CAs
                    </h2>

                    <div className="space-y-10">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="md:w-1/3">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-[#D6E3F3] shadow-sm text-[#387ED1] mb-4">
                                    <Scale className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-[#1A1A2E]">Direct Filing vs. Bookkeeping</h3>
                            </div>
                            <div className="md:w-2/3 text-[#374151] leading-relaxed">
                                <p className="mb-4">
                                    Quicko&apos;s engine is designed to bypass the accounting ledger. It reads broker data and maps it directly into ITR tax forms. This is highly efficient for retail users who only care about the final tax calculation.
                                </p>
                                <p>
                                    TradeBooks AI is an <strong>accounting automation layer</strong>. It does not file taxes. Instead, it reads the complex Zerodha exports, applies configurable Investor/Trader logic, and translates those rows into proper double-entry Journal and Receipt vouchers for Tally. It ensures the business logs are immaculate before a CA even begins the tax filing process.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-8 items-start">
                            <div className="md:w-1/3">
                                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-[#D6E3F3] shadow-sm text-[#2D9D78] mb-4">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <h3 className="text-xl font-bold text-[#1A1A2E]">The Exception-First Flow</h3>
                            </div>
                            <div className="md:w-2/3 text-[#374151] leading-relaxed">
                                <p className="mb-4">
                                    When broker data is messy or entries are missing, consumer tax software often makes generic assumptions or throws vague errors during filing.
                                </p>
                                <p>
                                    TradeBooks AI flips this model for professionals. Before you export the XML to Tally, the engine halts at an <strong>Exception Review</strong> step. It specifically flags mismatches (e.g., mismatched funding entries, unsupported corporate actions) so your team can validate the edge case manually. The result is a clean batch of vouchers entering Tally, instead of a contaminated ledger.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="bg-white py-20">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <h2 className="font-sans text-center text-3xl font-bold tracking-tight text-[#1A1A2E]">
                        Frequently Asked Questions
                    </h2>
                    <div className="mt-10 space-y-4">
                        {schema.mainEntity.map((item) => (
                            <details key={item.name} className="group rounded-xl border border-[#E2E8F0] bg-white p-5 open:bg-[#F8FBFF]">
                                <summary className="cursor-pointer list-none text-lg font-semibold leading-7 text-[#1A1A2E] group-open:text-[#1E4FD8]">
                                    {item.name}
                                </summary>
                                <p className="mt-3 text-base leading-8 text-[#374151]">{item.acceptedAnswer.text}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="bg-[#0F1C2E] py-20 text-center">
                <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                    <h2 className="font-sans text-3xl font-bold text-white sm:text-4xl tracking-tight">
                        Need clean Tally ledgers, not just tax forms?
                    </h2>
                    <p className="mt-4 text-slate-300 text-lg">
                        Stop manual data entry. Upload your Zerodha exports and generate Tally-importable XML in minutes.
                    </p>
                    <div className="mt-8 flex justify-center">
                        <Link
                            href="/upload"
                            className="inline-flex h-12 items-center justify-center rounded-lg bg-[#1E4FD8] px-8 text-base font-semibold text-white transition-colors hover:bg-[#1944bb]"
                        >
                            Try TradeBooks AI Free <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </section>
        </>
    );
}
