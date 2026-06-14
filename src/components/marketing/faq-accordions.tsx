"use client";

import { useState } from "react";
import { Eyebrow } from "./section-primitives";
import { AccordionItem } from "./accordion-item";
import { ChevronDownIcon } from "./icons";
import { faqs } from "./landing-data";

export function FaqAccordions() {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const toggle = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }));

  return (
    <section className="mx-auto w-full max-w-[880px] px-8 py-[60px]">
      <div data-reveal className="mb-9">
        <Eyebrow>FAQ</Eyebrow>
        <h2 className="mt-[14px] font-display text-[clamp(28px,3.6vw,42px)] font-bold tracking-[-.03em] leading-[1.1] text-ink">
          The questions a CA actually asks.
        </h2>
      </div>

      <div data-reveal style={{ borderTop: "1px solid var(--hairline)" }}>
        {faqs.map((f, i) => {
          const isOpen = !!open[i];
          return (
            <AccordionItem
              key={f.q}
              open={isOpen}
              onToggle={() => toggle(i)}
              buttonId={`faq-h-${i}`}
              panelId={`faq-p-${i}`}
              style={{ borderBottom: "1px solid var(--hairline)" }}
              buttonClassName="px-1 py-5"
              header={
                <span className="flex items-center gap-4">
                  <span className="flex-1 text-[16.5px] font-semibold tracking-[-.01em] text-ink">{f.q}</span>
                  <ChevronDownIcon className={`h-[18px] w-[18px] shrink-0 text-ink-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </span>
              }
            >
              <p className="max-w-[62ch] px-1 pb-[22px] font-sans text-[15px] leading-[1.6] text-ink-2">{f.a}</p>
            </AccordionItem>
          );
        })}
      </div>
    </section>
  );
}
