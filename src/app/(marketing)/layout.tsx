import Link from "next/link";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { MarketingLogo } from "@/components/marketing/marketing-logo";

const footerLinks = [
  { href: "/#gap", label: "The gap" },
  { href: "/#logic", label: "Accounting logic" },
  { href: "/#security", label: "Security" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg)" }}>
      <MarketingHeader />

      <main className="flex-1">{children}</main>

      <footer style={{ borderTop: "1px solid var(--hairline)", background: "var(--bg)" }}>
        <div className="mx-auto w-full max-w-[1200px] px-8 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-[11px]">
              <MarketingLogo size="footer" />
              <span className="font-sans text-[13px] text-ink-3">
                © {new Date().getFullYear()} · Console exports to audit-defensible Tally books.
              </span>
            </div>
            <div className="flex flex-wrap gap-x-[22px] gap-y-2 text-[13.5px]">
              {footerLinks.map((link) => (
                <Link key={link.href} href={link.href} className="text-ink-2 transition-colors hover:text-ink">
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
