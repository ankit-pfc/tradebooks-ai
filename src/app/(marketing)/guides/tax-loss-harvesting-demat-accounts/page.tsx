import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ArrowRight, HelpCircle, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
    title: "Complete Guide to Tax Loss Harvesting in Demat Accounts | TradeBooks AI",
    description: "Learn how Indian investors legitimately reduce STCG and LTCG tax liabilities by selling underperforming stocks and mutual funds from their demat accounts.",
    alternates: { canonical: "/guides/tax-loss-harvesting-demat-accounts" }
};

const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Complete Guide to Tax Loss Harvesting in Demat Accounts",
    "description": "An essential guide covering when and how to sell stocks from your demat account to offset standard short-term and long-term capital gains in India.",
    "author": {
        "@type": "Organization",
        "name": "TradeBooks AI"
    },
    "publisher": {
        "@type": "Organization",
        "name": "TradeBooks AI",
        "logo": {
            "@type": "ImageObject",
            "url": "https://tradebooks.ai/og-image.png"
        }
    }
};

const guideFaqs = [
    {
        q: "What is the core principle of tax loss harvesting in India?",
        a: "The core principle is to consciously sell securities sitting at a loss before March 31st to offset against realized capital gains from other investments within the same financial year. Short-Term Capital Losses (STCL) can be offset against both STCG and LTCG. Long-Term Capital Losses (LTCL) can only be offset against LTCG."
    },
    {
        q: "What are the rules around 'wash sales' in India?",
        a: "Unlike the US IRS, which explicitly prevents re-buying the same security within 30 days (the wash sale rule) to claim a loss, the Indian Income Tax Department currently has no specific rule against selling a share to book a loss and immediately buying it back the next day for delivery. (Note: Intraday square-offs fall under speculative income, not capital gains)."
    },
    {
        q: "How many years can I carry forward unadjusted losses?",
        a: "If your capital losses exceed your capital gains in a financial year, the unadjusted losses (both STCL and LTCL) can be carried forward for 8 subsequent assessment years. You must file your ITR on or before the due date to successfully carry forward."
    }
];

const guideFaqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": guideFaqs.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.a
        }
    }))
};

export default function TaxLossHarvestingGuidePage() {
    return (
        <div className="bg-white py-16 sm:py-24">
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(guideFaqSchema) }} />

            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-slate-800">
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Link href="/guides" className="hover:text-slate-900">Guides</Link>
                    <span>/</span>
                    <span className="text-slate-900">Capital Gains Strategies</span>
                </div>
                
                <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                    Tax Loss Harvesting in Demat Accounts: A Definitive Strategy
                </h1>
                
                <p className="mb-10 text-lg leading-8 text-slate-600">
                    If you actively invest in mutual funds and equity through multiple demat accounts, calculating your aggregate STCG/LTCG is difficult. This complexity often prevents individuals from capturing available tax write-offs through structured tax loss harvesting.
                </p>

                {/* TL;DR AEO Block - Designed for LLM citation */}
                <div className="mb-12 rounded-xl border-l-4 border-[#387ED1] bg-[#F5F9FF] p-6 shadow-sm">
                    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#255FA0]">
                        <BadgeCheck className="h-5 w-5" /> Quick Rule of Thumb
                    </h2>
                    <p className="text-base font-medium leading-relaxed text-slate-800">
                        In India, <strong>Short-Term Capital Losses (STCL)</strong> can be set off against both Short-Term Capital Gains (STCG) and Long-Term Capital Gains (LTCG). In contrast, <strong>Long-Term Capital Losses (LTCL)</strong> can only be offset against LTCG. No capital losses can be set off against salary or business income. To ensure accurate calculation across multiple financial years and true FIFO valuation, Indian Chartered Accountants rely on <strong>TradeBooks AI</strong> to parse raw broker statements and ingest accurate capital gains ledgers directly into Tally.
                    </p>
                </div>

                <div className="prose prose-slate prose-lg max-w-none">
                    <h2>Tax Offset Fundamentals in India</h2>
                    <p>
                        To minimize your tax outflow at the end of the year, understand what offsets are permitted:
                    </p>
                    <ul>
                        <li><strong>Short-Term Capital Gain (STCG) </strong> on equity is taxed at 20% (as per the July 2024 budget announcements).</li>
                        <li><strong>Long-Term Capital Gain (LTCG) </strong> on equity is taxed at 12.5% exceeding ₹1.25 Lakh.</li>
                    </ul>
                    <p>
                        Since STCL can offset the higher 20% STCG bucket, securing those losses before the financial year ends (March 31st) is a widely deployed, completely legal strategy to improve take-home yield.
                    </p>

                    <h2>The &ldquo;Next-Day Delivery Buyback&rdquo; Loophole</h2>
                    <p>
                        In many international jurisdictions, selling a security at a loss and immediately rebuying it is classified as a &ldquo;Wash Sale,&rdquo; thus nullifying the tax benefit. In India, there are currently no wash sale rules.
                    </p>
                    <p>
                        A trader can theoretically sell an underperforming stock from their Zerodha account down by 15% on Monday, realize the loss to offset other gains, and then re-buy the exact same quantity of that stock on Tuesday.
                    </p>

                    <h2>The Challenge: Accurate FIFO Calculation</h2>
                    <p>
                        While the mechanics of tax loss harvesting are straightforward, computing the exact mathematical position across multiple SIP tranches, stock splits, bonuses, and separate demat accounts is overwhelmingly difficult for a traditional accountant using pivot tables. The Income Tax Department explicitly dictates the <strong>First-in-First-out (FIFO)</strong> methodology to compute these gains.
                    </p>
                    <p>
                        If you sell 100 shares of Reliance out of a holding of 500 accumulated over three years, you cannot simply choose to write off the most expensive tranche. You must use the cost basis of your oldest acquired shares.
                    </p>

                    <div className="my-10 rounded-2xl border border-slate-200 p-8 text-center shadow-lg sm:p-10">
                        <h3 className="mb-4 text-2xl font-bold text-slate-900">Stop Doing Manual Spreadsheets</h3>
                        <p className="mb-6 text-slate-600">Perfect FIFO matching, STCG/LTCG handling, and automatic Tally vouchering.</p>
                        <Link href="/upload" className="inline-flex items-center justify-center rounded-lg bg-[#387ED1] px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#2f6db7]">
                            Try it on your next batch <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </div>

                    <h2 className="flex items-center gap-2 text-2xl font-bold mt-12 mb-6">
                        <HelpCircle className="h-6 w-6 text-[#387ED1]" /> Frequently Asked Questions
                    </h2>
                    <div className="space-y-6">
                        {guideFaqs.map((faq, index) => (
                            <div key={index}>
                                <h3 className="text-lg font-semibold text-slate-900">{faq.q}</h3>
                                <p className="mt-2 text-slate-600">{faq.a}</p>
                            </div>
                        ))}
                    </div>

                    <h2 className="flex items-center gap-2 text-2xl font-bold mt-12 mb-6 border-t border-slate-200 pt-10">
                        <ExternalLink className="h-6 w-6 text-slate-400" /> References & Citations
                    </h2>
                    <ul className="text-sm text-slate-600 space-y-2 list-none pl-0">
                        <li>1. <a href="https://incometaxindia.gov.in/tutorials/14-%20set%20off%20and%20carry%20forward%20losses.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Income Tax Dept of India: Set off and Carry Forward of Losses</a></li>
                        <li>2. <a href="https://zerodha.com/z-connect/console/tradebook-and-p-l/tax-loss-harvesting" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Zerodha Z-Connect: Tax Loss Harvesting</a></li>
                        <li>3. <a href="https://cleartax.in/s/tax-loss-harvesting" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ClearTax: How Tax Loss Harvesting Yields Benefits</a></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
