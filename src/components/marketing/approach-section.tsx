import { Container, Eyebrow } from "./section-primitives";
import { ImageSlot } from "./image-slot";
import { CheckIcon } from "./icons";
import { approachItems } from "./landing-data";

export function ApproachSection() {
  return (
    <section id="approach" className="py-[60px]">
      <Container>
        <div data-reveal className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>OUR APPROACH</Eyebrow>
            <h2 className="mt-[14px] font-display text-[clamp(26px,3.2vw,40px)] font-bold leading-[1.12] tracking-[-.03em] text-ink">
              Zerodha-first, on purpose. And honest about the rest.
            </h2>
            <p className="my-[22px] font-sans text-[16px] leading-[1.6] text-ink-2">
              We&rsquo;d rather do one broker properly than five badly. Zerodha is where the volume is,
              so that&rsquo;s where we got the accounting right — FIFO, grandfathering, charge mapping
              and reconciliation, tested against real contract notes.
            </p>

            <div className="flex flex-col gap-[14px]">
              {approachItems.map((it) => (
                <div key={it.label} className="flex items-start gap-3">
                  <span
                    className="mt-[1px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px]"
                    style={
                      it.kind === "today"
                        ? { background: "color-mix(in srgb, var(--pos) 14%, transparent)", color: "var(--pos)" }
                        : { background: "var(--surface-3)", color: "var(--ink-3)" }
                    }
                  >
                    {it.kind === "today" ? (
                      <CheckIcon className="h-[13px] w-[13px]" sw={2.2} />
                    ) : (
                      <span className="font-mono text-[11px]">~</span>
                    )}
                  </span>
                  <p className="font-sans text-[14.5px] leading-[1.5] text-ink-2">
                    <span className="font-semibold text-ink">{it.label}</span> {it.text}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-[22px] pl-[14px] font-sans text-[13.5px] leading-[1.5] text-ink-3" style={{ borderLeft: "2px solid var(--hairline-strong)" }}>
              If your client isn&rsquo;t on Zerodha yet, tell us — it shapes what we build next.
            </p>
          </div>

          <ImageSlot
            id="approach-team"
            minHeight={360}
            brief="A team / workspace photo (optional) — real faces build trust faster than any feature."
          />
        </div>
      </Container>
    </section>
  );
}
