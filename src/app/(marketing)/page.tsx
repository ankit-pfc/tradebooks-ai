import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Icons (inline SVG to avoid extra deps) ──────────────────────────────────

function UploadIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function DocumentReportIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const steps = [
  {
    number: "01",
    icon: <UploadIcon />,
    title: "Upload",
    description:
      "Drop your Zerodha exports — tradebook CSV, funds statement, holdings report, or contract notes — directly into TradeBooks AI.",
  },
  {
    number: "02",
    icon: <CogIcon />,
    title: "Configure",
    description:
      "Choose Investor mode or Trader mode. Set your Tally company, ledger mappings, and financial year. Done in seconds.",
  },
  {
    number: "03",
    icon: <CheckCircleIcon />,
    title: "Reconcile",
    description:
      "The engine auto-reconciles entries across all uploaded files and flags exceptions that need your attention.",
  },
  {
    number: "04",
    icon: <DownloadIcon />,
    title: "Export",
    description:
      "Download a Tally-importable XML file. Import it into Tally Prime or Tally ERP 9 — no manual journal entries.",
  },
];

const features = [
  {
    icon: <UploadIcon />,
    title: "All Zerodha Exports Supported",
    description:
      "Tradebook, funds statement, holdings report, and contract notes — all parsed and correlated automatically.",
  },
  {
    icon: <SwitchIcon />,
    title: "Investor & Trader Mode",
    description:
      "Separate accounting treatment for long-term investors (capital gains) and active traders (business income).",
  },
  {
    icon: <CheckCircleIcon />,
    title: "Auto-Reconciliation",
    description:
      "Entries are cross-verified across files. Mismatches are surfaced as exceptions so nothing slips through.",
  },
  {
    icon: <ShieldCheckIcon />,
    title: "Full Audit Trail",
    description:
      "Every generated entry is traceable back to the source row in your Zerodha export. Audit-ready by design.",
  },
  {
    icon: <DocumentReportIcon />,
    title: "Tally-Ready XML Output",
    description:
      "Generated XML conforms to Tally's import format. Import directly into Tally Prime or ERP 9 without edits.",
  },
  {
    icon: <ClockIcon />,
    title: "No Manual Posting",
    description:
      "Eliminate hours of manual journal entries per month. Upload, review exceptions, export — that's the entire workflow.",
  },
];

const painPoints = [
  "Manually typing hundreds of trade entries into Tally every month",
  "Reconciling broker statements with bank statements by hand",
  "Switching between spreadsheets, PDFs, and Tally for every trade",
  "Risking errors that only surface at year-end during audit",
];

const targetUsers = [
  {
    title: "Chartered Accountants",
    description:
      "Handle multiple clients' broker accounts without drowning in data entry. Deliver audit-ready books faster.",
    badge: "CA Firms",
  },
  {
    title: "Accountants & Bookkeepers",
    description:
      "Automate the tedious parts of stock accounting. Focus on advisory, not data transfer.",
    badge: "Accounting Teams",
  },
  {
    title: "Active Traders",
    description:
      "Keep your own books clean throughout the year. No end-of-year scramble before the CA visit.",
    badge: "Self-Filers",
  },
  {
    title: "Small Firms & Family Offices",
    description:
      "Standardize how every portfolio is recorded in Tally — consistently, quickly, and without extra headcount.",
    badge: "Small Businesses",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-slate-900 text-white py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-6 bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20">
              Built for Indian CAs &amp; Accountants
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl leading-tight">
              Broker statements to{" "}
              <span className="text-indigo-400">Tally</span>,{" "}
              automatically.
            </h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Upload your Zerodha exports. Get reconciled, Tally-importable XML
              accounting entries — without a single manual journal posting.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-lg px-8 h-12 text-base font-medium bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
              >
                Get Started Free
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-lg px-8 h-12 text-base font-medium border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Flow visual */}
          <div className="mt-20 flex flex-wrap items-center justify-center gap-3 md:gap-0">
            {[
              { label: "Zerodha Export", sub: ".csv / .xlsx", color: "bg-slate-800 border-slate-700" },
              null,
              { label: "TradeBooks AI", sub: "Parse · Reconcile", color: "bg-indigo-600 border-indigo-500" },
              null,
              { label: "Tally XML", sub: "Import-ready", color: "bg-slate-800 border-slate-700" },
            ].map((item, i) =>
              item === null ? (
                <div key={i} className="hidden md:flex items-center px-2">
                  <svg className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ) : (
                <div
                  key={i}
                  className={`rounded-xl border px-6 py-4 text-center ${item.color}`}
                >
                  <div className="text-sm font-semibold text-white">{item.label}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{item.sub}</div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900">
              The manual posting problem
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed">
              Zerodha gives you the data. Tally needs journal entries. The gap
              between the two costs accountants hours every month.
            </p>
          </div>
          <div className="mx-auto max-w-xl space-y-4">
            {painPoints.map((point, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-5 py-4">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-slate-700 text-sm leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 mx-auto max-w-xl rounded-lg border border-indigo-100 bg-indigo-50 px-5 py-4 flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-indigo-800 text-sm leading-relaxed font-medium">
              TradeBooks AI eliminates all of this. Upload once, review exceptions, import into Tally.
            </span>
          </div>
        </div>
      </section>

      {/* ── How it Works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">How it works</h2>
            <p className="mt-4 text-slate-500 text-lg">
              Four steps from raw Zerodha export to Tally-ready books.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col">
                <div className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col flex-1">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      {step.icon}
                    </div>
                    <span className="text-3xl font-bold text-slate-100">{step.number}</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">
              Everything you need for accurate stock accounting
            </h2>
            <p className="mt-4 text-slate-500 text-lg">
              Designed specifically for the Zerodha-to-Tally workflow used by
              thousands of Indian accountants.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="border-slate-200 shadow-none hover:border-indigo-200 hover:shadow-sm transition-all">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Target Users ─────────────────────────────────────────────────── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Who it&apos;s for</h2>
            <p className="mt-4 text-slate-500 text-lg">
              Built for everyone who bridges Zerodha statements and Tally books.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {targetUsers.map((user) => (
              <div
                key={user.title}
                className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col"
              >
                <Badge
                  variant="secondary"
                  className="w-fit mb-4 text-xs bg-indigo-50 text-indigo-700 border-0"
                >
                  {user.badge}
                </Badge>
                <h3 className="text-base font-semibold text-slate-900 mb-2">{user.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{user.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-indigo-600 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Stop posting entries. Start reviewing them.
          </h2>
          <p className="mt-4 text-indigo-100 text-lg max-w-2xl mx-auto leading-relaxed">
            Join CAs, accountants, and traders who have eliminated manual Tally
            data entry from their Zerodha workflow.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg px-8 h-12 text-base font-semibold bg-white text-indigo-700 hover:bg-indigo-50 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center rounded-lg px-8 h-12 text-base font-medium border border-indigo-300 text-white hover:bg-indigo-700 hover:border-indigo-400 transition-colors"
            >
              Learn More
            </Link>
          </div>
          <p className="mt-6 text-indigo-200 text-sm">
            No credit card required. Import your first file free.
          </p>
        </div>
      </section>
    </>
  );
}
