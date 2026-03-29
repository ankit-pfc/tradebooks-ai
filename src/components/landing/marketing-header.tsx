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
                "sticky top-0 z-50 w-full border-b border-[#E5E7EB]/80 bg-white/95 backdrop-blur transition-shadow duration-200",
                isScrolled && "shadow-[0_6px_24px_rgba(15,23,42,0.08)]",
            )}
        >
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="h-8 w-1.5 rounded-sm bg-[#0B1F33]" aria-hidden="true" />
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-medium tracking-tight text-[#0B1F33]">
                            Tradebooks
                        </span>
                        <span className="text-lg font-semibold tracking-tight text-[#2D9CDB]">
                            AI
                        </span>
                    </div>
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="inline-flex items-center gap-1 text-base font-medium text-[#6B7280] transition-colors hover:text-[#0B1F33]"
                        >
                            {link.label}
                            {link.hasDropdownCue && <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                        </Link>
                    ))}
                </nav>

                <div className="hidden md:block">
                    <Link
                        href="/upload"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-[#0B1F33]/30 bg-white px-5 text-base font-semibold text-[#0B1F33] transition-colors hover:bg-[#F3F4F6]"
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
                        <Menu className="h-5 w-5 text-[#0B1F33]" />
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[84%] border-l border-[#E5E7EB] bg-white p-0">
                        <div className="border-b border-[#E5E7EB] px-5 py-4">
                            <SheetTitle className="text-left text-lg font-semibold text-[#0B1F33]">
                                TradeBooks AI
                            </SheetTitle>
                        </div>

                        <nav className="flex flex-col px-5 py-5">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="inline-flex items-center justify-between border-b border-[#E5E7EB] py-3.5 text-base font-medium text-[#374151]"
                                >
                                    {link.label}
                                    {link.hasDropdownCue && <ChevronDown className="h-4 w-4 text-[#9CA3AF]" aria-hidden="true" />}
                                </Link>
                            ))}

                            <Link
                                href="/upload"
                                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#0B1F33] px-5 text-base font-semibold text-white transition-colors hover:bg-[#132d47]"
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
