import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-hairline-strong bg-card px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-3 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15 focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-neg aria-invalid:ring-2 aria-invalid:ring-neg/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
