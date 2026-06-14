"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useAppTheme } from "@/components/app/app-theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// useSyncExternalStore with a no-op subscribe gives us the SSR-safe mounted
// pattern: serverSnapshot="false" → placeholder on server/first paint, then
// React re-renders with the real client value — no hydration mismatch.
function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},          // no-op subscribe
    () => true,              // client snapshot: mounted
    () => false,             // server snapshot: not mounted
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useAppTheme();
  const mounted = useIsMounted();

  // Render a stable placeholder until mounted to avoid SSR hydration mismatch.
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn(className)}
        aria-label="Toggle theme"
        disabled
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(className)}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
