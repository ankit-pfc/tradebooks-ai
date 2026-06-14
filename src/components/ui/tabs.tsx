"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-ink-2 group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        // Pill-style (default): tinted background, rounded
        default: "rounded-lg bg-surface-2 p-[3px]",
        // Line-style: bottom border, no background
        line: "gap-1 bg-transparent border-b border-hairline rounded-none p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // Base layout
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        // Group orientation
        "group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
        // Focus
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:rounded-sm",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        // Icons
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",

        // ── Default (pill) variant ─────────────────────────────────────────
        "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent",
        // Inactive
        "group-data-[variant=default]/tabs-list:text-ink-2 group-data-[variant=default]/tabs-list:hover:text-ink",
        // Active
        "group-data-[variant=default]/tabs-list:data-active:bg-card group-data-[variant=default]/tabs-list:data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm",

        // ── Line variant ──────────────────────────────────────────────────
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:bg-transparent",
        // Inactive
        "group-data-[variant=line]/tabs-list:text-ink-2 group-data-[variant=line]/tabs-list:hover:text-ink",
        // Active: text-primary + 2px bottom border in --primary color
        "group-data-[variant=line]/tabs-list:data-active:text-primary group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        // The active underline is rendered via an ::after pseudo-element
        "after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-[var(--primary)] after:opacity-0 after:transition-opacity",
        "group-data-horizontal/tabs:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        // Vertical line variant active marker (right side)
        "group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-[1px] group-data-vertical/tabs:after:h-auto group-data-vertical/tabs:after:w-0.5 group-data-vertical/tabs:after:bottom-auto",
        "group-data-vertical/tabs:group-data-[variant=line]/tabs-list:data-active:after:opacity-100",

        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
