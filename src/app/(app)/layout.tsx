"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  History,
  Settings,
  LogOut,
  Search,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "./actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/ui/logo";
import { SupportChatFab } from "@/components/agent/support-chat-fab";
import { AppThemeProvider } from "@/components/app/app-theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DensityToggle } from "@/components/ui/density-toggle";
import { CommandPalette } from "@/components/ui/command-palette";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Ledger Masters", href: "/ledger-masters", icon: BookOpen },
  { label: "History", href: "/batches", icon: History },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

function currentLabel(pathname: string): string {
  const match = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  return match?.label ?? "";
}

function openCommandPalette() {
  window.dispatchEvent(new Event("tb:command-open"));
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string>("Accountant");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const handleSignOut = () => signOut();
  const sectionLabel = currentLabel(pathname);

  return (
    <AppThemeProvider>
      <div className="tb-app flex h-screen overflow-hidden bg-background text-foreground">
        {/* ── Sidebar (light) ── */}
        <aside className="flex w-60 shrink-0 flex-col border-r border-hairline bg-sidebar">
          <div className="flex h-14 items-center border-b border-hairline px-5">
            <Logo />
          </div>

          <nav className="flex-1 space-y-0.5 px-3 py-4">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-surface-2 text-primary"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                  )}
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      isActive ? "text-primary" : "text-ink-3",
                    )}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-hairline p-3">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-2">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3">
                  <span className="text-sm font-semibold text-ink">
                    {userEmail[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {userEmail}
                  </p>
                  <p className="truncate text-xs text-ink-3">Free Plan</p>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-52">
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-neg"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header
            className={cn(
              "flex h-14 shrink-0 items-center gap-3 border-b border-hairline bg-background/80 px-6 backdrop-blur transition-shadow",
              scrolled && "e1",
            )}
          >
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-sm"
            >
              <span className="text-ink-3">TradeBooks</span>
              {sectionLabel && (
                <>
                  <span className="text-ink-3">/</span>
                  <span className="font-medium text-ink">{sectionLabel}</span>
                </>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={openCommandPalette}
                className="hidden items-center gap-2 rounded-md border border-hairline bg-surface-2 py-1.5 pl-2.5 pr-2 text-sm text-ink-3 transition-colors hover:border-hairline-strong hover:text-ink-2 sm:flex"
                aria-label="Open command palette"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
                <kbd className="mono-data rounded border border-hairline bg-card px-1.5 py-0.5 text-[11px] text-ink-3">
                  ⌘K
                </kbd>
              </button>
              <DensityToggle />
              <ThemeToggle />
            </div>
          </header>

          {/* Scrollable content */}
          <main
            className="flex-1 overflow-y-auto"
            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
          >
            {children}
          </main>
        </div>

        <CommandPalette />
        <SupportChatFab />
      </div>
    </AppThemeProvider>
  );
}
