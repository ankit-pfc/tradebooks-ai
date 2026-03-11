import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | TradeBooks AI",
    description: "Terms and conditions for using TradeBooks AI's Zerodha-to-Tally accounting utility.",
};

export default function TermsPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Terms of Service</h1>

                <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
                    <p className="lead text-lg">
                        Welcome to TradeBooks AI. By using our utility services, you agree to the following terms and conditions.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">1. Service Description</h2>
                    <p>
                        TradeBooks AI acts as a data-formatting and reconciliation utility that bridges raw broker exports (e.g., Zerodha) to an accounting software-ready format (e.g., Tally XML).
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">2. User Responsibilities &amp; Verification</h2>
                    <p>
                        While we apply stringent processing rules to automatically format and reconcile data, <strong>TradeBooks AI does not provide financial, tax, or legal advice.</strong> You (or your designated accountant) remain solely responsible for verifying the accuracy of all generated entries and the resulting Tally XML before importing it into your accounting ledger.
                    </p>
                    <p className="mt-2">
                        TradeBooks AI explicitly identifies mismatches or errors via its "Exceptions" feature. Approving or ignoring exceptions is exclusively the user's responsibility.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">3. Limitation of Liability</h2>
                    <p>
                        We are not liable for any discrepancies, errors, penalties, or audit findings resulting from missing information in the original broker export, user misconfigurations, or failure to review exceptions. Our liability is limited to the extent permitted by law, and typically shall not exceed the amount paid for your subscription during the trailing twelve months.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">4. Account Termination &amp; Abuse</h2>
                    <p>
                        We reserve the right to suspend or terminate accounts that violate these terms, attempt to reverse-engineer our proprietary parsers, or abuse the generous free/beta tier limits (e.g., generating excessive bot traffic or automated multi-account exploitation).
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">5. Subscription &amp; Payment Terms</h2>
                    <p>
                        Certain features or tiers are subject to a recurring subscription fee ("Paid Tier"). Features and limits (e.g., "Client Books") are detailed on our Pricing page. Payments are standardly non-refundable after processing, except where required by law. Users may downgrade or cancel their subscription at any time, which will take effect at the end of their current billing cycle.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">6. Changes to Terms</h2>
                    <p>
                        We reserve the right to modify these terms as our platform evolves. Significant material changes will be communicated to account holders via email.
                    </p>
                </div>
            </div>
        </div>
    );
}
