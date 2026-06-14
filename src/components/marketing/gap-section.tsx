import { Fragment } from "react";
import { Container, Eyebrow, H2 } from "./section-primitives";
import { ImageSlot } from "./image-slot";
import { gapCosts, gapSteps } from "./landing-data";

const LABEL = "text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3";

export function GapSection() {
  return (
    <section id="gap" className="pb-[60px] pt-[96px]">
      <Container>
        {/* Intro */}
        <div data-reveal className="mb-[44px] max-w-[660px]">
          <Eyebrow>THE GAP</Eyebrow>
          <H2 className="mt-[14px]">Your filing tool stops at the P&amp;L. The books start right after it.</H2>
          <p className="mt-4 font-sans text-[17px] leading-[1.6] text-ink-2">
            Quicko and ClearTax answer &ldquo;what&rsquo;s the tax?&rdquo; once a year, for the
            taxpayer. None of them put a single voucher into your client&rsquo;s Tally. That part —
            the recurring, billable, audit-exposed part — still lands on a junior at midnight.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-[28px] lg:grid-cols-[1.15fr_0.85fr]">
          {/* Left: the manual reality */}
          <div
            data-reveal
            className="rounded-[14px] p-[28px]"
            style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.05)" }}
          >
            <p className={`${LABEL} mb-5`}>The manual reality, today</p>
            {gapSteps.map((s, i) => {
              const last = i === gapSteps.length - 1;
              const neg = s.tone === "neg";
              return (
                <Fragment key={s.n}>
                  <div className="flex items-start gap-4" style={{ paddingBottom: last ? 0 : 18 }}>
                    <span
                      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] font-mono text-[12px] font-semibold"
                      style={
                        neg
                          ? { background: "color-mix(in srgb, var(--neg) 12%, transparent)", color: "var(--neg)" }
                          : { background: "var(--surface-3)", color: "var(--ink-2)" }
                      }
                    >
                      {s.n}
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{s.title}</p>
                      <p className="font-sans text-[14px] leading-[1.5] text-ink-2">{s.body}</p>
                    </div>
                  </div>
                  {!last && (
                    <div className="ml-[14px] h-[18px] border-l-[1.5px] border-dashed" style={{ borderColor: "var(--hairline-strong)" }} />
                  )}
                </Fragment>
              );
            })}
          </div>

          {/* Right: cost of the gap + photo slot */}
          <div data-reveal className="flex flex-col gap-[28px]">
            <div
              className="rounded-[14px] p-[26px]"
              style={{ border: "1px solid var(--hairline)", background: "linear-gradient(160deg, var(--surface), var(--surface-2))" }}
            >
              <div className="mb-5 flex items-center justify-between">
                <p className={LABEL}>The cost of the gap</p>
                <span
                  className="rounded-[5px] px-[7px] py-[2px] font-mono text-[10px] text-ink-3"
                  style={{ border: "1px solid var(--hairline)" }}
                >
                  illustrative
                </span>
              </div>
              <div className="flex flex-col gap-[14px] font-mono">
                {gapCosts.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-baseline justify-between"
                    style={c.border ? { borderTop: "1px solid var(--hairline)", paddingTop: 14 } : undefined}
                  >
                    <span className="font-sans text-[13px] text-ink-2">{c.label}</span>
                    <span
                      className="text-[18px] font-semibold"
                      style={{ color: c.tone === "neg" ? "var(--neg)" : c.tone === "pos" ? "var(--pos)" : "var(--ink)" }}
                    >
                      {c.value}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-sans text-[12px] leading-[1.5] text-ink-3">
                Rough figures to frame the math, not a measured result. Your file, your numbers — run it and see.
              </p>
            </div>

            <ImageSlot
              id="gap-desk"
              className="flex-1"
              minHeight={190}
              brief="A CA desk at audit season — dual monitors, Tally on screen, chai."
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
