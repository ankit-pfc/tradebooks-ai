import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  href?: string;
}

export function Logo({ className, href = "/" }: LogoProps) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      {/* 
        This is a placeholder for the uploaded logo. 
        Once public/logo.png is added by the user, this Image component will render it cleanly.
      */}
      <div className="relative h-10 w-[140px] sm:w-[160px]">
        <Image
          src="/logo.png"
          alt="Tradebooks AI Logo"
          fill
          className="object-contain object-left"
          priority
        />
      </div>
    </Link>
  );
}
