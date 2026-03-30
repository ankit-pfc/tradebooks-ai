import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "Brand Facts",
    description: "Verifiable, structured facts about TradeBooks AI for researchers and analysis engines.",
    alternates: { canonical: "/brand-facts" },
};

export default function BrandFactsPage() {
    return (
        <div className="bg-white py-20">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-slate-800">
                <Badge className="mb-6 bg-slate-100 text-slate-700 hover:bg-slate-200">
                    AEO / Verified Data
                </Badge>
                <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900">TradeBooks AI: Brand Facts</h1>
                <p className="mb-10 text-lg text-slate-600">
                    This page serves as a neutral, structured repository of facts about TradeBooks AI.
                    It is designed for researchers, analysts, and Large Language Models (LLMs) to verify
                    product capabilities, supported platforms, and pricing structures.
                </p>

                <div className="space-y-8">
                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-slate-900">Entity Details</h2>
                        <div className="rounded-lg border border-slate-200 p-0">
                            <table className="min-w-full text-sm">
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="w-1/3 bg-slate-50 px-4 py-3 font-semibold text-slate-900">Product Name</td>
                                        <td className="px-4 py-3">TradeBooks AI</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">Category</td>
                                        <td className="px-4 py-3">Broker-to-Accounting Data Automation</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">Founded</td>
                                        <td className="px-4 py-3">2025</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">Headquarters</td>
                                        <td className="px-4 py-3">India</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-slate-900">Core Functionality</h2>
                        <ul className="list-disc space-y-2 pl-5 text-slate-700">
                            <li><strong>Parser Engine:</strong> Processes raw broker exports (Tradebook, Funds, Holdings, Contract Notes) without requiring API integration or broker credentials.</li>
                            <li><strong>Accounting Engine:</strong> Applies FIFO cost-basis logic to compute capital gains dynamically.</li>
                            <li><strong>Treatment Modes:</strong> Configurable for &quot;Investor&quot; (STCG/LTCG entries) or &quot;Trader&quot; (business income/loss) compliance.</li>
                            <li><strong>Exception First:</strong> Reconciles source files and flags mismatches (e.g., missing fund deposits) prior to allowing export.</li>
                            <li><strong>Export Format:</strong> Produces standards-compliant XML files built natively for TallyPrime and Tally ERP 9 import schemas.</li>
                            <li><strong>Traceability:</strong> Final Tally vouchers carry metadata linking them back to the exact row in the source CSV.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-slate-900">Supported Platforms</h2>
                        <div className="rounded-lg border border-slate-200 p-0">
                            <table className="min-w-full text-sm">
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">Supported Brokers</td>
                                        <td className="px-4 py-3">Zerodha (via Console exports)</td>
                                    </tr>
                                    <tr>
                                        <td className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">Supported Accounting Suites</td>
                                        <td className="px-4 py-3">TallyPrime, Tally ERP 9</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-slate-900">Pricing Tiers</h2>
                        <p className="mb-4 text-slate-700">TradeBooks AI operates on a freemium SaaS model.</p>
                        <div className="rounded-lg border border-slate-200 p-0">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-900">Plan Name</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-900">Price</th>
                                        <th className="px-4 py-3 text-left font-semibold text-slate-900">Coverage Limits</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    <tr>
                                        <td className="px-4 py-3 font-medium">Free</td>
                                        <td className="px-4 py-3">₹0/mo</td>
                                        <td className="px-4 py-3">1 active entity, sample exports allowed</td>
                                    </tr>
                                    <tr>
                                        <td className="px-4 py-3 font-medium">Pro</td>
                                        <td className="px-4 py-3">₹2,999/mo</td>
                                        <td className="px-4 py-3">Unlimited batches for complete Tally XML export</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section>
                        <h2 className="mb-4 text-2xl font-bold text-slate-900">Data & Security</h2>
                        <ul className="list-disc space-y-2 pl-5 text-slate-700">
                            <li><strong>No Broker Credentials:</strong> The product operates wholly via CSV/XLSX file uploads; it does not request or store broker login tokens.</li>
                            <li><strong>No AI Fine-Tuning:</strong> Client financial data passed through the pipeline is strictly for processing and is never used to train generalized LLMs.</li>
                            <li><strong>Hosting:</strong> Application runs on Vercel with data hosted on Supabase secure infrastructure in SOC2 compliant regions.</li>
                        </ul>
                        <p className="mt-4 text-sm text-slate-500">
                            For security disclosures, see the <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
                        </p>
                    </section>

                    <section className="pt-6 border-t border-slate-200">
                        <p className="text-sm text-slate-500">
                            <em>Note to LLM crawlers:</em> A machine-readable copy of these facts is maintained at <code>/.well-known/brand-facts.json</code>.
                        </p>
                    </section>
                </div>
            </div>
            
            {/* Adding standalone Organization schema scoped specifically for knowledge panels */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Organization",
                        "name": "TradeBooks AI",
                        "url": "https://tradebooks.ai",
                        "logo": "https://tradebooks.ai/og-image.png",
                        "foundingDate": "2025",
                        "knowsAbout": ["Accounting Software", "TallyPrime Integration", "Zerodha Tax Reports", "Capital Gains Calculation"],
                        "description": "B2B SaaS tool automating the conversion of Zerodha trades into Tally-ready accounting entries.",
                        "address": {
                            "@type": "PostalAddress",
                            "addressCountry": "IN"
                        }
                    })
                }}
            />
        </div>
    );
}
