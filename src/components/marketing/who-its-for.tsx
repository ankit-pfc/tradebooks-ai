import { Container, Eyebrow, H2 } from "./section-primitives";
import { BuildingIcon, StoreIcon, TrendingUpIcon } from "./icons";
import { toneVar, whoCards } from "./landing-data";

const iconFor = {
  building: BuildingIcon,
  store: StoreIcon,
  trend: TrendingUpIcon,
};

export function WhoItsFor() {
  return (
    <section id="who" className="pb-[60px] pt-[90px]">
      <Container>
        <div data-reveal className="mb-[44px] max-w-[640px]">
          <Eyebrow>WHO IT&rsquo;S FOR</Eyebrow>
          <H2 className="mt-[14px]">Built first for the practice. Useful well beyond it.</H2>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {whoCards.map((c) => {
            const Icon = iconFor[c.icon];
            const accent = toneVar[c.accent];
            return (
              <div
                key={c.title}
                data-reveal
                className="relative rounded-[14px] p-[28px]"
                style={
                  c.primary
                    ? { border: "1px solid var(--action)", background: "var(--surface)", boxShadow: "0 18px 44px -28px rgba(31,90,224,.45)" }
                    : { border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.05)" }
                }
              >
                {c.badge && (
                  <span
                    className="absolute right-[18px] top-[18px] rounded-full px-[9px] py-[3px] font-mono text-[10px] font-semibold"
                    style={{ color: "var(--action)", background: "color-mix(in srgb, var(--action) 12%, transparent)" }}
                  >
                    {c.badge}
                  </span>
                )}
                <span
                  className="mb-[18px] grid h-[42px] w-[42px] place-items-center rounded-[11px]"
                  style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
                >
                  <Icon className="h-[22px] w-[22px]" sw={1.8} />
                </span>
                <h3 className="mb-2 font-display text-[19px] font-semibold tracking-[-.02em] text-ink">
                  {c.title}
                  {c.suffix && <span className="text-[12px] font-medium text-ink-3"> {c.suffix}</span>}
                </h3>
                <p className="mb-4 font-sans text-[14.5px] leading-[1.55] text-ink-2">{c.body}</p>
                <p
                  className="rounded-[9px] px-[15px] py-[13px] font-sans text-[13.5px] leading-[1.5] text-ink"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--hairline)" }}
                >
                  &ldquo;{c.quote}&rdquo;
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
