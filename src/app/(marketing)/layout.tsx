import Link from "next/link";
import { CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { Logo } from "@/components/ui/logo";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MarketingHeader />

      <main className="flex-1">{children}</main>

      <footer className="bg-[#0B1F33] text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Logo />
              </div>
              <p className="text-base leading-relaxed">
                Broker statements to Tally, automatically. Built for Indian CAs,
                accountants, and traders.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-sm text-slate-200">
                  <Lock className="h-3.5 w-3.5 text-[#2D9D78]" /> SSL Secured
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-sm text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#2D9D78]" /> SOC-style Controls
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-3">Product</h3>
              <ul className="space-y-2 text-base">
                <li>
                  <Link href="/#how-it-works" className="hover:text-white transition-colors">
                    Workflow
                  </Link>
                </li>
                <li>
                  <Link href="/#proof" className="hover:text-white transition-colors">
                    Proof
                  </Link>
                </li>
                <li>
                  <Link href="/#who-its-for" className="hover:text-white transition-colors">
                    Who It&apos;s For
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" className="hover:text-white transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-3">Resources</h3>
              <ul className="space-y-2 text-base">
                <li>
                  <Link href="/#trust-strip" className="hover:text-white transition-colors">
                    Trust & Security
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" className="hover:text-white transition-colors">
                    FAQs
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Plan Details
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-3">Legal</h3>
              <ul className="space-y-2 text-base">
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
                <li className="inline-flex items-center gap-1 text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#2D9D78]" />
                  Data retention controls
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3 text-sm">
              <Link
                href="/upload"
                className="inline-flex items-center justify-center rounded-lg bg-[#0B1F33] px-4 py-2 font-medium text-white transition-colors hover:bg-[#132d47]"
              >
                Get Started Free
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              >
                View Plans
              </Link>
            </div>
          </div>
          <Separator className="my-8 bg-slate-800" />
          <p className="text-center text-base">
            &copy; {new Date().getFullYear()} TradeBooks AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
