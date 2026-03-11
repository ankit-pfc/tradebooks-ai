"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
    { href: "/#how-it-works", label: "Workflow" },
    { href: "/#who-its-for", label: "Who it’s for" },
    { href: "/#proof", label: "Proof" },
    { href: "/#pricing", label: "Pricing" },
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
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#387ED1] text-white">
                        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <span className="text-base font-semibold text-[#1A1A2E] sm:text-lg">
                        TradeBooks AI
                    </span>
                </Link>

                <nav className="hidden items-center gap-6 md:flex">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-sm font-medium text-[#4A5568] transition-colors hover:text-[#1A1A2E]"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>

                <Link
                    href={process.env.NODE_ENV === "production" ? "#" : "/upload"}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#387ED1] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#2f6db7]"
                >
                    Get Started Free
                </Link>
            </div>
        </header>
    );
}
