"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean
  onCheckedChange?: (next: boolean) => void
  indeterminate?: boolean
  "aria-label"?: string
  className?: string
}

export function Checkbox({
  checked,
  onCheckedChange,
  indeterminate = false,
  className,
  ...props
}: CheckboxProps) {
  const ref = React.useRef<HTMLInputElement>(null)

  // Keep the indeterminate DOM property in sync — it cannot be set via HTML attr
  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={cn(
        // Size
        "size-4 shrink-0",
        // Shape
        "rounded-sm",
        // Border when unchecked (browser default appearance overridden via accent)
        "border border-hairline-strong",
        // Checked/indeterminate fill color via accent (CSS accent-color)
        "accent-[var(--primary)]",
        // Cursor
        "cursor-pointer",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}
