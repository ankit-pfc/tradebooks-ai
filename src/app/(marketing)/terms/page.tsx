import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | TradeBooks AI",
    description: "Terms and conditions for using TradeBooks AI's Zerodha-to-Tally accounting utility.",
};

export default function TermsPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <h1 className="mb-8 text-4xl font-bold tracking-tight text-slate-900">Terms of Service</h1>

                <div className="space-y-6 text-slate-600">
                    <p className="text-lg">
                        By using TradeBooks AI, you agree to these terms governing the use of our
                        Zerodha-to-Tally workflow utility.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">1. Service Scope</h2>
                    <p>
                        TradeBooks AI helps users convert broker exports into structured, Tally-importable
                        XML with reconciliation and exception visibility.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">2. User Responsibility</h2>
                    <p>
                        TradeBooks AI does not provide tax, legal, or financial advice. Users remain
                        responsible for verifying generated outputs before import into their accounting ledger.
                    </p>
                    <p>
                        Exceptions are surfaced for review; final import decisions and accounting treatment
                        remain with the user or their appointed accountant.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">3. Limitation of Liability</h2>
                    <p>
                        We are not liable for issues arising from incomplete source data, user configuration
                        choices, or failure to review flagged exceptions before import.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">4. Fair Usage &amp; Termination</h2>
                    <p>
                        We may suspend accounts that abuse free-tier limits, attempt unauthorized access,
                        or violate platform policies.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">5. Subscriptions &amp; Billing</h2>
                    <p>
                        Paid tiers are billed on a recurring basis. Plan limits and inclusions are listed on
                        the pricing page. Cancellations apply at the end of the active billing cycle unless
                        otherwise required by law.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">6. Terms Updates</h2>
                    <p>
                        We may update these terms as the platform evolves. Material changes will be
                        communicated to account holders.
                    </p>
                </div>
            </div>
        </div>
    );
}