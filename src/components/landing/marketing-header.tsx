"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navLinks = [
    { href: "/#features", label: "Features", hasDropdownCue: true },
    { href: "/#who-its-for", label: "Who It’s For", hasDropdownCue: true },
    { href: "/#proof", label: "Proof" },
    { href: "/pricing", label: "Pricing" },
    { href: "/#faq", label: "FAQ" },
];

export function MarketingHeader() {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setIsScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <header
            className={cn(
                "sticky top-0 z-50 w-full border-b border-[#E2E8F0]/80 bg-white/95 backdrop-blur transition-shadow duration-200",
                isScrolled && "shadow-[0_6px_24px_rgba(15,23,42,0.08)]",
            )}
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="h-8 w-1.5 rounded-full bg-[#1E4FD8]" aria-hidden="true" />
                    <div>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7280]">
                            TradeBooks
                        </span>
                        <span className="block -mt-0.5 text-lg font-bold tracking-tight text-[#0F1C2E]">
                            AI
                        </span>
                    </div>
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[#4A5568] transition-colors hover:text-[#0F1C2E]"
                        >
                            {link.label}
                            {link.hasDropdownCue && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                        </Link>
                    ))}
                </nav>

                <div className="hidden md:block">
                    <Link
                        href="/upload"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-[#1E4FD8]/30 bg-white px-5 text-sm font-semibold text-[#1E4FD8] transition-colors hover:bg-[#EFF4FF]"
                    >
                        Get Started Free
                    </Link>
                </div>

                <Sheet>
                    <SheetTrigger
                        render={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="md:hidden"
                                aria-label="Open menu"
                            />
                        }
                    >
                        <Menu className="h-5 w-5 text-[#0F1C2E]" />
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[84%] border-l border-[#E2E8F0] bg-white p-0">
                        <div className="border-b border-[#E2E8F0] px-5 py-4">
                            <SheetTitle className="text-left text-lg font-semibold text-[#0F1C2E]">
                                TradeBooks AI
                            </SheetTitle>
                        </div>

                        <nav className="flex flex-col px-5 py-5">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="inline-flex items-center justify-between border-b border-[#EEF2F7] py-3.5 text-sm font-medium text-[#334155]"
                                >
                                    {link.label}
                                    {link.hasDropdownCue && <ChevronDown className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />}
                                </Link>
                            ))}

                            <Link
                                href="/upload"
                                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#1E4FD8] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1944BB]"
                            >
                                Get Started Free
                            </Link>
                        </nav>
                    </SheetContent>
                </Sheet>
            </div>
        </header>
    );
}
