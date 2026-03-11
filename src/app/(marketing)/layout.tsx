import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full bg-slate-900 border-b border-slate-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
              <svg
                className="h-5 w-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">
              TradeBooks AI
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/#how-it-works"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="/#mechanism"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Why It Works
            </Link>
            <Link
              href="/#comparison"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Comparison
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-slate-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="hidden sm:block text-sm text-slate-300 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center justify-center rounded-lg px-3 h-7 text-[0.8rem] font-medium bg-indigo-500 hover:bg-indigo-400 text-white transition-colors"
            >
              Start Free Upload
            </Link>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <span className="text-white font-semibold">TradeBooks AI</span>
              </div>
              <p className="text-sm leading-relaxed">
                Broker statements to Tally, automatically. Built for Indian CAs,
                accountants, and traders.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/#how-it-works" className="hover:text-white transition-colors">
                    How it Works
                  </Link>
                </li>
                <li>
                  <Link href="/#proof" className="hover:text-white transition-colors">
                    Product Proof
                  </Link>
                </li>
                <li>
                  <Link href="/#comparison" className="hover:text-white transition-colors">
                    Comparison
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Get Started</h3>
              <div className="space-y-2 text-sm">
                <Link
                  href="/upload"
                  className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-400"
                >
                  Start Free Upload
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
                >
                  View Plans
                </Link>
              </div>
            </div>
          </div>
          <Separator className="my-8 bg-slate-800" />
          <p className="text-center text-sm">
            &copy; {new Date().getFullYear()} TradeBooks AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
