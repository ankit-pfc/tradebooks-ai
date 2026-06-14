import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  href?: string;
}

export function Logo({ className, href = "/" }: LogoProps) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)}>
      <div className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0">
        <Image
          src="/icon.png"
          alt="TradeBooks AI Icon"
          fill
          className="object-contain"
          priority
        />
      </div>
      <span className="whitespace-nowrap text-lg font-semibold tracking-tight text-ink">
        TradeBooks <span className="text-primary">AI</span>
      </span>
    </Link>
  );
}
