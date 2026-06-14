"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Headless-ish animated disclosure used by the accounting-logic and FAQ
 * accordions. Handles only the open/close mechanics and the height animation
 * (grid-rows 0fr → 1fr, which animates cleanly without measuring the DOM).
 * Visual chrome (index, title, chevron) is supplied by the caller via `header`.
 */
export function AccordionItem({
  open,
  onToggle,
  header,
  children,
  className,
  buttonClassName,
  panelClassName,
  buttonId,
  panelId,
  style,
}: {
  open: boolean;
  onToggle: () => void;
  header: ReactNode;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
  panelClassName?: string;
  buttonId?: string;
  panelId?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn("w-full cursor-pointer text-left", buttonClassName)}
      >
        {header}
      </button>
      <div
        id={panelId}
        role="region"
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className={cn("overflow-hidden", panelClassName)}>{children}</div>
      </div>
    </div>
  );
}
