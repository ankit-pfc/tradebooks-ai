import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "Pricing",
    description:
        "Simple pricing based on the number of client books you manage. Start free and scale your CA practice's Zerodha-to-Tally workflow without per-transaction fees.",
    alternates: { canonical: '/pricing' },
    openGraph: {
        title: "Pricing | TradeBooks AI",
        description: "Simple pricing based on the number of client books you manage. Start free and scale your CA practice's Zerodha-to-Tally workflow.",
        url: '/pricing',
    },
};

const tiers = [
    {
        name: "Free",
        sub: "For trying your first Zerodha-to-Tally close workflow",
        price: "₹0",
        period: "/month",
        cta: "Start Free Upload",
        href: "/upload",
        points: ["1 active entity", "Exception-first validation preview", "Sample export package"],
    },
    {
        name: "Pro",
        sub: "For CA firms and accounting teams running monthly closes",
        price: "₹2,999",
        period: "/month",
        cta: "Start Free Upload",
        href: "/upload",
        points: ["Unlimited monthly batches", "Full Tally XML export", "Priority onboarding support"],
        featured: true,
    },
];

export default function PricingPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <Badge className="mb-6 border-[#2D9CDB]/30 bg-[#2D9CDB]/10 text-[#2D9CDB] hover:bg-[#2D9CDB]/10">
                        Transparent Pricing
                    </Badge>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Simple pricing for clean, faster closes.</h1>
                    <p className="mt-6 text-lg text-slate-600">
                        Stop billing for manual entry. Convert Zerodha exports to Tally-ready XML in minutes.
                        Start free and upgrade as your client list grows.
                    </p>
                    <p className="mt-3 text-base text-slate-500">No broker credentials needed. No hidden reconciliation fees.</p>
                </div>

                <div className="mx-auto mt-16 grid max-w-md gap-6 lg:max-w-4xl lg:grid-cols-2">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`flex flex-col rounded-3xl p-8 ${tier.featured ? "border-2 border-[#2D9CDB] shadow-lg" : "border border-slate-200 shadow-sm"}`}
                        >
                            <h3 className="text-xl font-semibold text-slate-900">{tier.name}</h3>
                            <p className="mt-2 text-base text-slate-500">{tier.sub}</p>
                            <div className="mt-6 flex items-baseline gap-x-2">
                                <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                                <span className="text-base text-slate-500">{tier.period}</span>
                            </div>
                            <ul className="mt-8 flex-1 space-y-3 text-base text-slate-600">
                                {tier.points.map((point) => (
                                    <li key={point}>• {point}</li>
                                ))}
                            </ul>
                            <Link
                                href={tier.href}
                                className={`mt-8 block rounded-lg px-4 py-3 text-center text-base font-semibold ${tier.featured ? "bg-[#387ED1] text-white hover:bg-[#2f6db7]" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`}
                            >
                                {tier.cta}
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="mt-20 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-base">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                                <th className="px-5 py-4">Feature</th>
                                <th className="px-5 py-4">Free</th>
                                <th className="px-5 py-4">Pro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
                            {[
                                ["Active entities", "1", "Unlimited"],
                                ["Exception handling", "Preview-level", "Production-ready checks"],
                                ["XML export", "Sample package", "Full Tally XML"],
                                ["Support", "Community", "Priority onboarding"],
                            ].map((row) => (
                                <tr key={row[0]}>
                                    {row.map((cell) => (
                                        <td key={cell} className="px-5 py-4">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}