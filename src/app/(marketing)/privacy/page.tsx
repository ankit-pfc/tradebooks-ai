import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy | TradeBooks AI",
    description: "Read how TradeBooks AI secures your financial data. We use a secure file-upload model, require no broker credentials, and never train AI on your trading data.",
};

export default function PrivacyPage() {
    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Privacy Policy</h1>

                <div className="prose prose-slate max-w-none text-slate-600 space-y-6">
                    <p className="lead text-lg">
                        At TradeBooks AI, we are committed to protecting your privacy and security—especially when it comes to sensitive financial data.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">1. Data Collection</h2>
                    <p>
                        We strictly collect only what is necessary to operate our service. This includes:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Account Information:</strong> Basic personal information (name, email) used to create and manage your account.</li>
                        <li><strong>Uploaded Artifacts:</strong> The CSVs and statements you intentionally upload (e.g., Zerodha Tradebooks, Funds statements, Holdings).</li>
                    </ul>
                    <p className="mt-2 font-medium text-slate-900">
                        We do not ask for or store any direct broker credentials, nor do we require direct connection to your Tally software.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">2. Data Usage &amp; AI Non-Training Guarantee</h2>
                    <p>
                        Your uploaded data is strictly used for parser processing, reconciliation, and Tally XML generation.
                    </p>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 my-6 text-indigo-900">
                        <strong>Explicit Guarantee:</strong> We do not use your financial data, trading history, or personal information to train artificial intelligence models (LLMs). Your data remains your data.
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">3. Data Retention &amp; Deletion</h2>
                    <p>
                        Uploaded files and generated output files are kept within your account for historical/audit tracing. You retain the ability to permanently delete any processed batch, its associated files, and entries at any time via your history dashboard. Terminating your account will purge all associated financial artifacts.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">4. Third-Party Services</h2>
                    <p>
                        We utilize select, highly-secure third-party infrastructure providers to run our service securely:
                    </p>
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li><strong>Supabase:</strong> For database hosting and secure file storage (SOC2 Type II compliant).</li>
                        <li><strong>Vercel:</strong> For application hosting and compute.</li>
                    </ul>
                    <p className="mt-2">
                        We do not sell, rent, or trade your data.
                    </p>

                    <h2 className="text-2xl font-bold text-slate-900 mt-12 mb-4">5. Contact Us</h2>
                    <p>
                        If you have structural concerns regarding this policy or the privacy architecture of our platform, please reach out via email at privacy@tradebooks.ai.
                    </p>
                </div>
            </div>
        </div>
    );
}
