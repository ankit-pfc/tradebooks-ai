import { cn } from "@/lib/utils";
import { BarChartGlyph, GlobeIcon, LineChartIcon, LockIcon } from "./icons";
import { trustItems } from "./landing-data";

const iconFor = {
  bar: <BarChartGlyph className="h-5 w-5" />,
  line: <LineChartIcon className="h-5 w-5" sw={1.7} />,
  lock: <LockIcon className="h-5 w-5" sw={1.7} />,
  globe: <GlobeIcon className="h-5 w-5" sw={1.7} />,
};

export function TrustStrip() {
  return (
    <section className="px-8 pb-2 pt-[18px]">
      <div className="mx-auto w-full max-w-[1200px]">
        <div
          data-reveal
          className="grid grid-cols-2 overflow-hidden rounded-[13px] md:grid-cols-4"
          style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}
        >
          {trustItems.map((it) => (
            <div
              key={it.title}
              className={cn(
                "flex items-center gap-[11px] border-hairline px-[20px] py-[16px]",
                "md:[&:not(:last-child)]:border-r",
                "max-md:[&:nth-child(odd)]:border-r",
                "max-md:[&:nth-child(-n+2)]:border-b",
              )}
            >
              <span className="shrink-0 text-ink-3">{iconFor[it.icon]}</span>
              <div className={it.nowrap ? "whitespace-nowrap" : undefined}>
                <p className="text-[13.5px] font-semibold text-ink">{it.title}</p>
                <p className="font-sans text-[11.5px] text-ink-3">{it.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
