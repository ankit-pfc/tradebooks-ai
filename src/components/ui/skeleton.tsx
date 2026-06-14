import { cn } from "@/lib/utils"

export interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-2", className)}
      aria-hidden="true"
    />
  )
}

export interface SkeletonRowsProps {
  rows?: number
  cols?: number
  className?: string
}

export function SkeletonRows({ rows = 5, cols = 4, className }: SkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIdx) => (
        <tr key={rowIdx} className={className}>
          {Array.from({ length: cols }, (_, colIdx) => (
            <td key={colIdx} className="px-3 py-2">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
