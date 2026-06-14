"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MarketingLogo } from "@/components/marketing/marketing-logo";
import { CTA_HREF } from "@/components/marketing/landing-data";

const navLinks = [
  { href: "/#gap", label: "The gap" },
  { href: "/#output", label: "The output" },
  { href: "/#logic", label: "Accounting logic" },
  { href: "/#who", label: "Who it’s for" },
  { href: "/#pricing", label: "Pricing" },
];

const ctaClass =
  "inline-flex items-center justify-center rounded-[8px] px-[18px] py-[9px] text-[14px] font-semibold text-white transition hover:brightness-95";
const ctaStyle = {
  background: "linear-gradient(145deg, var(--action), var(--action-hover))",
  boxShadow: "0 6px 18px rgba(31,90,224,.26)",
};

export function MarketingHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-[background-color,border-color,backdrop-filter] duration-[250ms]",
        isScrolled
          ? "border-[var(--hairline)] bg-[rgba(251,252,254,0.82)] backdrop-blur-[14px]"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-8 py-4">
        <MarketingLogo size="nav" />

        <nav className="hidden items-center gap-[26px] md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-[14px] font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href={CTA_HREF} className={ctaClass} style={ctaStyle}>
            Try a client file
          </Link>
        </div>

        <Sheet>
          <SheetTrigger
            render={<Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu" />}
          >
            <Menu className="h-5 w-5 text-ink" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[84%] border-l border-[var(--hairline)] bg-[var(--surface)] p-0">
            <div className="border-b border-[var(--hairline)] px-5 py-4">
              <SheetTitle className="text-left">
                <MarketingLogo size="footer" />
              </SheetTitle>
            </div>
            <nav className="flex flex-col px-5 py-5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="border-b border-[var(--hairline)] py-[14px] text-[15px] font-medium text-ink-2"
                >
                  {link.label}
                </Link>
              ))}
              <Link href={CTA_HREF} className={cn(ctaClass, "mt-5 py-3")} style={ctaStyle}>
                Try a client file
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
