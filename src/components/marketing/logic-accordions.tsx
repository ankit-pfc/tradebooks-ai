"use client";

import { useState } from "react";
import { Eyebrow, H2 } from "./section-primitives";
import { AccordionItem } from "./accordion-item";
import { ChevronDownIcon, ClipboardCheckIcon, ArrowRightIcon } from "./icons";
import { logicItems } from "./landing-data";

export function LogicAccordions() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });
  const toggle = (i: number) => setOpen((o) => ({ ...o, [i]: !o[i] }));

  return (
    <section
      id="logic"
      className="px-8 py-[90px]"
      style={{ background: "linear-gradient(180deg, var(--surface-2), var(--bg))", borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}
    >
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]" data-reveal>
        {/* Left (sticky) */}
        <div className="lg:sticky lg:top-24">
          <Eyebrow>THE ACCOUNTING LOGIC</Eyebrow>
          <H2 className="mt-[14px]">We show our work. That&rsquo;s the whole pitch.</H2>
          <p className="my-6 font-sans text-[16px] leading-[1.6] text-ink-2">
            You can&rsquo;t trust a black box with a client&rsquo;s books — even an AI one. So nothing
            here is hidden: the AI proposes the treatment, and you read exactly how TradeBooks AI
            handles every topic. Disagree with a call? Override it — the override is logged.
          </p>
          <div className="flex items-center gap-[10px] rounded-[10px] px-4 py-[13px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
            <ClipboardCheckIcon className="h-5 w-5 shrink-0" sw={1.8} />
            <span className="font-sans text-[13.5px] text-ink-2">
              Methodology is the proof. No measured-results claims you can&rsquo;t verify on your own file.
            </span>
          </div>
        </div>

        {/* Right: accordions */}
        <div className="flex flex-col gap-3">
          {logicItems.map((item, i) => {
            const isOpen = !!open[i];
            return (
              <AccordionItem
                key={item.t}
                open={isOpen}
                onToggle={() => toggle(i)}
                buttonId={`logic-h-${i}`}
                panelId={`logic-p-${i}`}
                className="overflow-hidden rounded-[13px]"
                buttonClassName="px-[22px] py-5"
                style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.04)" }}
                header={
                  <span className="flex items-start gap-[14px]">
                    <span className="pt-[3px] font-mono text-[14px] text-action">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1">
                      <span className="block text-[16.5px] font-semibold tracking-[-.01em] text-ink">{item.t}</span>
                      <span className="mt-[3px] block font-sans text-[13.5px] text-ink-2">{item.sum}</span>
                    </span>
                    <ChevronDownIcon className={`mt-1 h-[18px] w-[18px] shrink-0 text-ink-3 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                  </span>
                }
              >
                <div className="flex flex-col gap-3 pb-[22px] pl-[48px] pr-[22px] font-sans text-[14.5px] leading-[1.6] text-ink-2">
                  {item.paras.map((p) => (
                    <p key={p.slice(0, 24)}>{p}</p>
                  ))}

                  {item.miniTable && (
                    <div className="mt-1 rounded-[9px] px-[14px] py-3 font-mono text-[12px] leading-[1.8]" style={{ border: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
                      {item.miniTable.map((r) => (
                        <div key={r.label} className="flex justify-between">
                          <span className="text-ink-3">{r.label}</span>
                          <span style={{ color: r.pos ? "var(--pos)" : "var(--ink)" }}>{r.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.mapping && (
                    <div className="mt-1 flex flex-col gap-2">
                      {item.mapping.map(([term, target]) => (
                        <div key={term} className="flex items-center gap-2">
                          <span className="min-w-[120px] font-mono text-ink">{term}</span>
                          <ArrowRightIcon className="h-[14px] w-[14px] text-ink-3" sw={1.8} />
                          <span className="font-sans text-ink-2">{target}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionItem>
            );
          })}
        </div>
      </div>
    </section>
  );
}
