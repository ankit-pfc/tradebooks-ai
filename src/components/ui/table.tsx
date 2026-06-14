"use client"

import * as React from "react"
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-surface-2 [&_tr]:border-b [&_tr]:border-hairline", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-hairline bg-surface-2 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "h-[var(--row-h)] border-b border-hairline transition-colors hover:bg-surface-2 data-[state=selected]:bg-primary/[.06]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-[var(--cell-px)] py-[var(--cell-py)] text-left align-middle text-xs font-medium uppercase tracking-wide whitespace-nowrap text-ink-2 [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-[var(--cell-px)] py-[var(--cell-py)] align-middle text-ink whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-ink-3", className)}
      {...props}
    />
  )
}

// ── SortableHeader ────────────────────────────────────────────────────────────
// A TableHead-like <th> that renders a clickable sort button with aria-sort and
// a lucide caret indicating the current sort direction.

interface SortableHeaderProps {
  active?: boolean
  direction?: "asc" | "desc"
  onSort?: () => void
  align?: "left" | "right"
  children: React.ReactNode
  className?: string
}

function SortableHeader({
  active = false,
  direction,
  onSort,
  align = "left",
  children,
  className,
}: SortableHeaderProps) {
  const ariaSortValue: React.AriaAttributes["aria-sort"] = active
    ? direction === "asc"
      ? "ascending"
      : "descending"
    : "none"

  const Icon = active
    ? direction === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown

  return (
    <th
      data-slot="table-head"
      aria-sort={ariaSortValue}
      className={cn(
        "px-[var(--cell-px)] py-[var(--cell-py)] align-middle text-xs font-medium uppercase tracking-wide whitespace-nowrap text-ink-2 [&:has([role=checkbox])]:pr-0",
        align === "right" ? "text-right" : "text-left",
        className
      )}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm",
          active && "text-ink",
          align === "right" ? "flex-row-reverse" : "flex-row"
        )}
      >
        <span>{children}</span>
        <Icon
          className={cn(
            "h-3 w-3 shrink-0",
            active ? "text-primary" : "text-ink-3"
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
    </th>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  SortableHeader,
}
