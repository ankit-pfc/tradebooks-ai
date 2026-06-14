"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  BookOpen,
  History,
  Settings,
  Sun,
  AlignJustify,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppTheme, useDensity } from "@/components/app/app-theme-provider";

// ─── Public types ─────────────────────────────────────────────────────────────

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  keywords?: string;
  onSelect: () => void;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function matches(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
  return haystack.includes(q);
}

// ─── CommandPaletteContent (inner, requires hooks that need provider context) ─

function CommandPaletteContent({
  open,
  onClose,
  extraItems = [],
}: {
  open: boolean;
  onClose: () => void;
  extraItems: CommandItem[];
}) {
  const router = useRouter();
  const { toggleTheme } = useAppTheme();
  const { toggleDensity } = useDensity();

  const builtInItems: CommandItem[] = React.useMemo(
    () => [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        hint: "Home",
        icon: <LayoutDashboard className="h-4 w-4" />,
        keywords: "home overview",
        onSelect: () => router.push("/dashboard"),
      },
      {
        id: "nav-upload",
        label: "Upload",
        hint: "Import files",
        icon: <Upload className="h-4 w-4" />,
        keywords: "import file tradebook",
        onSelect: () => router.push("/upload"),
      },
      {
        id: "nav-ledger-masters",
        label: "Ledger Masters",
        hint: "Tally masters",
        icon: <BookOpen className="h-4 w-4" />,
        keywords: "ledger tally masters accounts",
        onSelect: () => router.push("/ledger-masters"),
      },
      {
        id: "nav-history",
        label: "History",
        hint: "Past batches",
        icon: <History className="h-4 w-4" />,
        keywords: "batches past history",
        onSelect: () => router.push("/batches"),
      },
      {
        id: "nav-settings",
        label: "Settings",
        hint: "Preferences",
        icon: <Settings className="h-4 w-4" />,
        keywords: "preferences config",
        onSelect: () => router.push("/settings"),
      },
      {
        id: "toggle-theme",
        label: "Toggle theme",
        hint: "Light / Dark",
        icon: <Sun className="h-4 w-4" />,
        keywords: "theme dark light mode",
        onSelect: () => toggleTheme(),
      },
      {
        id: "toggle-density",
        label: "Toggle density",
        hint: "Comfortable / Compact",
        icon: <AlignJustify className="h-4 w-4" />,
        keywords: "density compact comfortable rows",
        onSelect: () => toggleDensity(),
      },
    ],
    [router, toggleTheme, toggleDensity]
  );

  const allItems: CommandItem[] = React.useMemo(
    () => [...builtInItems, ...extraItems],
    [builtInItems, extraItems]
  );

  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const filtered = React.useMemo(
    () => allItems.filter((item) => matches(item, query)),
    [allItems, query]
  );

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Autofocus after the dialog animation starts
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Keep activeIndex in range when filtered list changes
  React.useEffect(() => {
    setActiveIndex((prev) => (filtered.length > 0 ? Math.min(prev, filtered.length - 1) : 0));
  }, [filtered.length]);

  // Scroll active item into view
  React.useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLLIElement>('[data-active="true"]');
    if (active && typeof active.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  function runItem(item: CommandItem) {
    item.onSelect();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (filtered.length === 0 ? 0 : (prev + 1) % filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        filtered.length === 0 ? 0 : (prev - 1 + filtered.length) % filtered.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex];
      if (item) runItem(item);
    } else if (e.key === "Escape") {
      // Dialog handles Escape natively, but ensure we close
      onClose();
    }
  }

  return (
    <div className="flex flex-col gap-2" onKeyDown={handleKeyDown}>
      <Input
        ref={inputRef}
        placeholder="Search commands…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        aria-label="Search commands"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Commands"
        className="max-h-64 overflow-y-auto rounded-md"
      >
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-ink-2">No results</li>
        )}
        {filtered.map((item, idx) => (
          <li
            key={item.id}
            role="option"
            aria-selected={idx === activeIndex}
            data-active={idx === activeIndex}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              idx === activeIndex ? "bg-surface-2" : "hover:bg-surface-2"
            )}
            onMouseEnter={() => setActiveIndex(idx)}
            onClick={() => runItem(item)}
          >
            {item.icon && (
              <span className="flex-shrink-0 text-ink-3">{item.icon}</span>
            )}
            <span className="flex-1 text-ink">{item.label}</span>
            {item.hint && (
              <span className="flex-shrink-0 text-xs text-ink-3">{item.hint}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── CommandPalette (public) ──────────────────────────────────────────────────

export function CommandPalette({ extraItems = [] }: { extraItems?: CommandItem[] }) {
  const [open, setOpen] = React.useState(false);

  // Global ⌘K / Ctrl+K hotkey + a custom event so any button (e.g. the topbar
  // search affordance) can open the palette.
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("tb:command-open", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("tb:command-open", handleOpenEvent);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        We intentionally skip DialogTrigger here because the palette is opened
        by the global ⌘K listener, not a visible button.
      */}
      <DialogPortal>
        <DialogOverlay />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className={cn(
            "fixed left-1/2 top-[20%] z-50 w-full max-w-md -translate-x-1/2 rounded-xl bg-card border border-hairline e3 p-4 text-sm outline-none",
            "duration-100",
            open
              ? "animate-in fade-in-0 zoom-in-95"
              : "animate-out fade-out-0 zoom-out-95"
          )}
        >
          {open && (
            <CommandPaletteContent
              open={open}
              onClose={() => setOpen(false)}
              extraItems={extraItems}
            />
          )}
        </div>
      </DialogPortal>
    </Dialog>
  );
}
