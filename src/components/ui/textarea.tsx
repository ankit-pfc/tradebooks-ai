import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex w-full min-h-20 rounded-md border border-hairline-strong bg-card px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-neg aria-invalid:ring-2 aria-invalid:ring-neg/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
