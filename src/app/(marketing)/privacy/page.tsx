import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy | TradeBooks AI",
    description:
        "Read how TradeBooks AI secures your financial data. We use a secure file-upload model, require no broker credentials, and never train AI on your trading data.",
};

export default function PrivacyPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <h1 className="mb-8 text-4xl font-bold tracking-tight text-slate-900">Privacy Policy</h1>

                <div className="space-y-6 text-slate-600">
                    <p className="text-lg">
                        TradeBooks AI is built for sensitive accounting workflows. We collect only the
                        data needed to process your uploads, reconcile records, and generate Tally-ready
                        output artifacts.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">1. Data Collection</h2>
                    <p>We collect account information (such as name and email) and files you upload intentionally.</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li>Account information for authentication and support</li>
                        <li>Uploaded Zerodha exports and related reconciliation artifacts</li>
                    </ul>
                    <p className="font-medium text-slate-900">
                        We do not require broker login credentials, and we do not require direct Tally access.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">2. Data Usage</h2>
                    <p>
                        Your uploaded data is used strictly for parser processing, reconciliation checks,
                        exception reporting, and Tally XML generation.
                    </p>
                    <div className="rounded-lg border border-[#2D9CDB]/20 bg-[#2D9CDB]/10 p-5 text-[#0B1F33]">
                        <strong>Explicit guarantee:</strong> We do not use your financial data to train AI models.
                    </div>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">3. Retention &amp; Deletion</h2>
                    <p>
                        Files and generated outputs are retained to support batch history and audit traceability.
                        You can delete batches and associated artifacts, and account termination removes linked data.
                    </p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">4. Third-party Infrastructure</h2>
                    <p>We rely on secure infrastructure providers to host and operate the product.</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li>Supabase for database and storage services</li>
                        <li>Vercel for application hosting and runtime delivery</li>
                    </ul>
                    <p>We do not sell or rent your data.</p>

                    <h2 className="pt-4 text-2xl font-bold text-slate-900">5. Contact</h2>
                    <p>Questions about privacy can be sent to privacy@tradebooks.ai.</p>
                </div>
            </div>
        </div>
    );
}