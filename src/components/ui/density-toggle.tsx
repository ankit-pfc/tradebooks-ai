"use client";

import { Rows3, AlignJustify } from "lucide-react";
import { useDensity } from "@/components/app/app-theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DensityToggle({ className }: { className?: string }) {
  const { density, toggleDensity } = useDensity();

  const isComfortable = density === "comfortable";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(className)}
      onClick={toggleDensity}
      aria-pressed={!isComfortable}
      aria-label={isComfortable ? "Switch to compact density" : "Switch to comfortable density"}
    >
      {isComfortable ? (
        <Rows3 className="h-4 w-4" />
      ) : (
        <AlignJustify className="h-4 w-4" />
      )}
    </Button>
  );
}
