/**
 * Inline, stroke-based icons transcribed from the design handoff so the landing
 * matches the prototype 1:1. All use `currentColor`, so color is set by the
 * parent's text color (or an inline `style={{ color }}`).
 */
import type { ReactNode } from "react";

function Svg({
  children,
  className,
  sw = 1.8,
}: {
  children: ReactNode;
  className?: string;
  sw?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function BarChartGlyph({ className }: { className?: string }) {
  return (
    <Svg className={className} sw={2.4}>
      <path d="M4 19V9M9.5 19V5M15 19v-7M20.5 19v-11" />
    </Svg>
  );
}

export function LineChartIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M3 3v18h18" />
      <path d="M7 14l3-3 3 3 5-6" />
    </Svg>
  );
}

export function LockIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function GlobeIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18" />
    </Svg>
  );
}

export function CogIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <circle cx="12" cy="12" r="3.4" />
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
    </Svg>
  );
}

export function ShieldCheckIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Svg>
  );
}

export function LinkIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <path d="M8 12h8" />
    </Svg>
  );
}

export function ArrowRightIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </Svg>
  );
}

export function CheckIcon({ className, sw = 2 }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M5 12l4 4 10-11" />
    </Svg>
  );
}

export function XIcon({ className, sw = 2 }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function ChevronDownIcon({ className, sw = 2 }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function ClipboardCheckIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 13l2 2 4-4" />
    </Svg>
  );
}

export function BuildingIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2" />
      <path d="M10 21v-3h4v3" />
    </Svg>
  );
}

export function StoreIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M4 9l1-5h14l1 5" />
      <path d="M4 9a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 0 5 0" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9 20v-5h4v5" />
    </Svg>
  );
}

export function TrendingUpIcon({ className, sw }: { className?: string; sw?: number }) {
  return (
    <Svg className={className} sw={sw}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </Svg>
  );
}
