import * as React from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatDelta {
  value: string
  direction: "up" | "down"
}

export interface StatProps {
  label: string
  value: number | string
  sub?: string
  delta?: StatDelta
  icon?: React.ReactNode
  className?: string
}

export function Stat({ label, value, sub, delta, icon, className }: StatProps) {
  return (
    <div
      className={cn(
        "bg-card border border-hairline rounded-xl e1 p-5 flex flex-col gap-2",
        className
      )}
    >
      {/* Top row: label + optional icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-2">
          {label}
        </span>
        {icon && (
          <span className="text-ink-3 h-4 w-4 shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>

      {/* Value */}
      <span className="text-2xl md:text-3xl font-semibold mono-data text-ink leading-none">
        {value}
      </span>

      {/* Delta and sub row */}
      {(delta || sub) && (
        <div className="flex items-center gap-3 flex-wrap">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-sm font-medium",
                delta.direction === "up" ? "text-pos" : "text-neg"
              )}
            >
              {delta.direction === "up" ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {delta.value}
            </span>
          )}
          {sub && (
            <span className="text-sm text-ink-3">{sub}</span>
          )}
        </div>
      )}
    </div>
  )
}
