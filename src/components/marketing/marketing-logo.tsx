import Link from "next/link";
import { cn } from "@/lib/utils";
import { BarChartGlyph } from "./icons";

/**
 * Landing/marketing wordmark from the design handoff: a gradient rounded-square
 * mark (action → cyan) holding a white bar-chart glyph, followed by the
 * "TradeBooks AI" wordmark with "AI" in action-blue.
 *
 * Separate from the shared `@/components/ui/logo` (icon.png), which the app shell
 * and signup still use — this one is marketing-only.
 */
export function MarketingLogo({
  size = "nav",
  href = "/",
  className,
}: {
  size?: "nav" | "footer";
  href?: string;
  className?: string;
}) {
  const isNav = size === "nav";
  return (
    <Link
      href={href}
      aria-label="TradeBooks AI home"
      className={cn("inline-flex items-center", isNav ? "gap-[11px]" : "gap-[10px]", className)}
    >
      <span
        className="grid place-items-center text-white"
        style={{
          width: isNav ? 34 : 30,
          height: isNav ? 34 : 30,
          borderRadius: isNav ? 9 : 8,
          background: "linear-gradient(145deg, var(--action), var(--cyan))",
          boxShadow: "0 6px 18px rgba(31,90,224,.26)",
        }}
      >
        <BarChartGlyph className={isNav ? "h-[19px] w-[19px]" : "h-4 w-4"} />
      </span>
      <span
        className="font-display font-bold tracking-[-.02em] text-ink"
        style={{ fontSize: isNav ? 18 : 15 }}
      >
        TradeBooks <span style={{ color: "var(--action)" }}>AI</span>
      </span>
    </Link>
  );
}
