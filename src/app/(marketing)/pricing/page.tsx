import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "Pricing | TradeBooks AI",
    description:
        "Simple pricing based on the number of client books you manage. Start free and scale your CA practice's Zerodha-to-Tally workflow without per-transaction fees.",
};

const tiers = [
    {
        name: "Solo",
        sub: "For independent accountants and self-filers",
        price: "₹999",
        period: "/month",
        cta: "Start Free Upload",
        href: "/upload",
        points: ["Up to 5 client books", "Core Zerodha-to-Tally export", "Basic reconciliation visibility"],
    },
    {
        name: "CA Pro",
        sub: "For growing CA firms",
        price: "₹3,499",
        period: "/month",
        cta: "Start Free Upload",
        href: "/upload",
        points: ["Up to 25 client books", "Team access (3 seats)", "Advanced reconciliation + priority support"],
        featured: true,
    },
    {
        name: "Practice",
        sub: "For large firms managing high volume",
        price: "Custom",
        period: "",
        cta: "Talk to Sales",
        href: "mailto:sales@tradebooks.ai",
        points: ["Unlimited client books", "Unlimited seats", "Custom workflows + dedicated support"],
    },
];

export default function PricingPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <Badge className="mb-6 border-indigo-500/30 bg-indigo-500/20 text-indigo-700 hover:bg-indigo-500/20">
                        Transparent Pricing
                    </Badge>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Pricing that scales with your practice.</h1>
                    <p className="mt-6 text-lg text-slate-600">
                        Stop billing for manual entry. Convert Zerodha exports to Tally-ready XML in minutes.
                        Start free and upgrade as your client list grows.
                    </p>
                    <p className="mt-3 text-sm text-slate-500">Annual billing eligible for savings up to 20%.</p>
                </div>

                <div className="mx-auto mt-16 grid max-w-md gap-6 lg:max-w-6xl lg:grid-cols-3">
                    {tiers.map((tier) => (
                        <div
                            key={tier.name}
                            className={`flex flex-col rounded-3xl p-8 ${tier.featured ? "border-2 border-indigo-500 shadow-xl" : "border border-slate-200 shadow-sm"}`}
                        >
                            <h3 className="text-xl font-semibold text-slate-900">{tier.name}</h3>
                            <p className="mt-2 text-sm text-slate-500">{tier.sub}</p>
                            <div className="mt-6 flex items-baseline gap-x-2">
                                <span className="text-4xl font-bold text-slate-900">{tier.price}</span>
                                <span className="text-sm text-slate-500">{tier.period}</span>
                            </div>
                            <ul className="mt-8 flex-1 space-y-3 text-sm text-slate-600">
                                {tier.points.map((point) => (
                                    <li key={point}>• {point}</li>
                                ))}
                            </ul>
                            <Link
                                href={tier.href}
                                className={`mt-8 block rounded-lg px-4 py-3 text-center text-sm font-semibold ${tier.featured ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-slate-100 text-slate-900 hover:bg-slate-200"}`}
                            >
                                {tier.cta}
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="mt-20 overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900 text-white">
                            <tr>
                                <th className="px-4 py-3">Feature</th>
                                <th className="px-4 py-3">Solo</th>
                                <th className="px-4 py-3">CA Pro</th>
                                <th className="px-4 py-3">Practice</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-600">
                            {[
                                ["Client books", "Up to 5", "Up to 25", "Unlimited"],
                                ["Team seats", "1", "3", "Unlimited"],
                                ["Exception rules", "Basic", "Advanced", "Custom"],
                                ["Support", "Standard", "Priority", "Dedicated manager"],
                            ].map((row) => (
                                <tr key={row[0]}>
                                    {row.map((cell) => (
                                        <td key={cell} className="px-4 py-3">
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