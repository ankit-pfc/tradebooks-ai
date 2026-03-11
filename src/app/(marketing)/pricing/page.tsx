import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CheckCircleIcon } from "lucide-react";

export const metadata: Metadata = {
    title: "Pricing | TradeBooks AI",
    description: "Simple pricing based on the number of client books you manage. Start free and scale your CA practice's Zerodha-to-Tally workflow without per-transaction fees.",
};

export default function PricingPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl text-center">
                    <Badge className="mb-6 bg-indigo-500/20 text-indigo-700 border-indigo-500/30 hover:bg-indigo-500/20">
                        Transparent Pricing
                    </Badge>
                    <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-slate-900">
                        Pricing that scales with your practice.
                    </h1>
                    <p className="mt-6 text-lg text-slate-600 max-w-2xl mx-auto">
                        Stop billing for manual entry. Convert Zerodha exports to Tally-ready XML in minutes. Start free, upgrade as your client list grows.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="mx-auto mt-16 grid max-w-md grid-cols-1 gap-8 lg:max-w-5xl lg:grid-cols-3">
                    {/* Solo Plan */}
                    <div className="flex flex-col rounded-3xl p-8 border border-slate-200 shadow-sm bg-white">
                        <h3 className="text-xl font-semibold text-slate-900">Solo</h3>
                        <p className="mt-2 text-sm text-slate-500">For independent accountants and self-filers.</p>
                        <div className="mt-6 flex items-baseline gap-x-2">
                            <span className="text-4xl font-bold text-slate-900">₹999</span>
                            <span className="text-sm text-slate-500">/month</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500 line-through">₹1,199/month regular</p>
                        <ul className="mt-8 flex flex-col gap-4 text-sm text-slate-600 flex-1">
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Up to 5 Client Books</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Core Zerodha-to-Tally Export</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Basic Reconciliation Visibility</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Standard Support</li>
                        </ul>
                        <Link href="/signup" className="mt-8 block rounded-lg px-3 py-3 text-center text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                            Start Free
                        </Link>
                    </div>

                    {/* CA Pro Plan */}
                    <div className="flex flex-col rounded-3xl p-8 border-2 border-indigo-500 shadow-xl bg-white relative">
                        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
                            <span className="bg-indigo-500 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">Most Popular</span>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900">CA Pro</h3>
                        <p className="mt-2 text-sm text-slate-500">For growing CA firms.</p>
                        <div className="mt-6 flex items-baseline gap-x-2">
                            <span className="text-4xl font-bold text-slate-900">₹3,499</span>
                            <span className="text-sm text-slate-500">/month</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">Billed annually</p>
                        <ul className="mt-8 flex flex-col gap-4 text-sm text-slate-600 flex-1">
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Up to 25 Client Books</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Team Features (3 seats)</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Advanced Reconciliation</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Priority Support</li>
                        </ul>
                        <Link href="/signup" className="mt-8 block rounded-lg px-3 py-3 text-center text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors">
                            Start Free Trial
                        </Link>
                    </div>

                    {/* Practice Plan */}
                    <div className="flex flex-col rounded-3xl p-8 border border-slate-200 shadow-sm bg-slate-50">
                        <h3 className="text-xl font-semibold text-slate-900">Practice</h3>
                        <p className="mt-2 text-sm text-slate-500">For large firms managing high volume.</p>
                        <div className="mt-6 flex items-baseline gap-x-2">
                            <span className="text-4xl font-bold text-slate-900">Custom</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">Tailored to your needs</p>
                        <ul className="mt-8 flex flex-col gap-4 text-sm text-slate-600 flex-1">
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Unlimited Client Books</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Unlimited Team Seats</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Custom Rules &amp; Workflows</li>
                            <li className="flex gap-x-3"><CheckCircleIcon className="h-5 w-5 text-indigo-500" /> Dedicated Account Manager</li>
                        </ul>
                        <Link href="mailto:sales@tradebooks.ai" className="mt-8 block rounded-lg px-3 py-3 text-center text-sm font-semibold bg-white border border-slate-300 text-slate-900 hover:bg-slate-50 transition-colors">
                            Contact Sales
                        </Link>
                    </div>
                </div>

                {/* FAQ */}
                <div className="mx-auto mt-24 max-w-3xl">
                    <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">Pricing FAQs</h2>
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Do I pay per transaction or per trade?</h3>
                            <p className="mt-2 text-slate-600">No, you only pay based on the number of client books you manage. Unlimited trades within those books.</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">What is a &apos;client book&apos;?</h3>
                            <p className="mt-2 text-slate-600">A client book represents one individual or corporate entity whose Zerodha accounts you are reconciling for Tally.</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Is there a setup fee?</h3>
                            <p className="mt-2 text-slate-600">No setup fees. You can upload your first Zerodha export and generate an XML in minutes.</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Can I cancel anytime?</h3>
                            <p className="mt-2 text-slate-600">Yes, but we recommend our annual plans which offer a significant discount and align with the typical financial reporting year.</p>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">Does it support brokers other than Zerodha?</h3>
                            <p className="mt-2 text-slate-600">We are hyper-focused on providing the absolute best, most reliable Zerodha-to-Tally experience. We do not support other brokers in our V1.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Final CTA Strip */}
            <div className="bg-indigo-600 mt-24 py-16">
                <div className="mx-auto max-w-4xl text-center px-4">
                    <h2 className="text-3xl font-bold text-white">Ready to eliminate manual posting?</h2>
                    <p className="mt-4 text-indigo-100 text-lg">See the reconciliation engine in action today.</p>
                    <div className="mt-8">
                        <Link href="/signup" className="inline-flex items-center justify-center rounded-lg px-8 h-12 text-base font-semibold bg-white text-indigo-700 hover:bg-indigo-50 transition-colors">
                            Upload Your First File Free
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
