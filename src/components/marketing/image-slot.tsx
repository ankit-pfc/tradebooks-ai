import { cn } from "@/lib/utils";

/**
 * Styled placeholder for the two art-directed photo slots in the handoff
 * (CA-desk in The Gap, team/workspace in Our Approach). No real photography is
 * bundled yet; swap these for a `next/image` when assets arrive.
 */
export function ImageSlot({
  brief,
  minHeight,
  className,
  id,
}: {
  brief: string;
  minHeight: number;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="img"
      aria-label={brief}
      className={cn("flex w-full items-center justify-center overflow-hidden rounded-[14px] p-6", className)}
      style={{
        minHeight,
        border: "1px solid var(--hairline)",
        background:
          "repeating-linear-gradient(135deg, var(--surface-2) 0 14px, var(--surface-3) 14px 28px)",
      }}
    >
      <p className="max-w-[34ch] text-center font-mono text-[12px] leading-[1.6] text-ink-3">
        {brief}
      </p>
    </div>
  );
}
