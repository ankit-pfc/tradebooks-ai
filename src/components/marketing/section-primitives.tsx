import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 1200px centered container with 32px gutters (handoff layout constant). */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-8", className)}>{children}</div>;
}

/** Mono eyebrow, e.g. `// THE GAP`. Pass the label only — the `// ` is added
 *  here (keeping it out of JSX text avoids the comment-textnode lint). */
export function Eyebrow({
  children,
  color = "var(--action)",
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <p
      className={cn("font-mono text-[13px] tracking-[.04em]", className)}
      style={{ color }}
    >
      {"// "}
      {children}
    </p>
  );
}

/** Section H2 — fluid display heading. */
export function H2({
  children,
  className,
  color = "var(--ink)",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <h2
      className={cn(
        "font-display font-bold tracking-[-.03em] leading-[1.1] text-[clamp(28px,3.6vw,44px)]",
        className,
      )}
      style={{ color }}
    >
      {children}
    </h2>
  );
}

/** Body paragraph (Inter). */
export function Lead({
  children,
  className,
  color = "var(--ink-2)",
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <p className={cn("font-sans text-[17px] leading-[1.6]", className)} style={{ color }}>
      {children}
    </p>
  );
}
