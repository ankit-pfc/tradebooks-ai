import { cn } from "@/lib/utils"

export type StatusDotTone = "pos" | "neg" | "warn" | "info" | "neutral"

export const TONE_MAP: Record<StatusDotTone, string> = {
  pos: "bg-pos",
  neg: "bg-neg",
  warn: "bg-warn",
  info: "bg-info",
  neutral: "bg-ink-3",
}

export interface StatusDotProps {
  tone: StatusDotTone
  label: string
  srOnlyLabel?: boolean
  className?: string
}

export function StatusDot({ tone, label, srOnlyLabel = false, className }: StatusDotProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 rounded-full shrink-0", TONE_MAP[tone])}
      />
      <span className={cn("text-sm text-ink", srOnlyLabel && "sr-only")}>
        {label}
      </span>
    </span>
  )
}
