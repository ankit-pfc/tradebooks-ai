import Link from "next/link";
import { Container, Eyebrow, H2 } from "./section-primitives";
import { CheckIcon } from "./icons";
import { CTA_HREF, pricingFree, pricingPro } from "./landing-data";

function Feature({ text, variant }: { text: string; variant: "free" | "pro" }) {
  const tint =
    variant === "pro"
      ? { background: "color-mix(in srgb, var(--action) 14%, transparent)", color: "var(--action)" }
      : { background: "color-mix(in srgb, var(--ink-3) 14%, transparent)", color: "var(--ink-2)" };
  return (
    <li className="flex items-start gap-[10px]">
      <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px]" style={tint}>
        <CheckIcon className="h-[11px] w-[11px]" sw={2.4} />
      </span>
      <span className="font-sans text-[13.5px] leading-[1.45] text-ink-2">{text}</span>
    </li>
  );
}

export function PricingCards() {
  return (
    <section id="pricing" className="py-[60px]">
      <Container>
        <div data-reveal className="mx-auto mb-[44px] max-w-[600px] text-center">
          <Eyebrow>PRICING</Eyebrow>
          <H2 className="mt-[14px]">Priced against a junior&rsquo;s afternoon.</H2>
          <p className="mt-4 font-sans text-[17px] leading-[1.6] text-ink-2">
            Start free on one client file. Upgrade when it&rsquo;s saving you whole closes.
          </p>
        </div>

        <div className="mx-auto grid max-w-[840px] grid-cols-1 gap-5 md:grid-cols-2">
          {/* Free */}
          <div data-reveal className="rounded-[16px] p-8" style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.05)" }}>
            <p className="mb-2 text-[14px] font-semibold text-ink-2">{pricingFree.name}</p>
            <div className="mb-[6px] flex items-baseline gap-[6px]">
              <span className="font-mono text-[40px] font-semibold tracking-[-.02em] text-ink">{pricingFree.price}</span>
            </div>
            <p className="mb-[22px] font-sans text-[14px] leading-[1.5] text-ink-2">{pricingFree.desc}</p>
            <Link
              href={CTA_HREF}
              className="mb-[22px] block rounded-[9px] py-3 text-center text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2"
              style={{ border: "1px solid var(--hairline-strong)", background: "var(--surface)" }}
            >
              {pricingFree.cta}
            </Link>
            <ul className="flex flex-col gap-[11px]">
              {pricingFree.features.map((f) => (
                <Feature key={f} text={f} variant="free" />
              ))}
            </ul>
          </div>

          {/* Pro */}
          <div data-reveal className="relative rounded-[16px] p-8" style={{ border: "1px solid var(--action)", background: "var(--surface)", boxShadow: "0 22px 50px -28px rgba(31,90,224,.45)" }}>
            <span className="absolute right-6 top-6 whitespace-nowrap rounded-full px-[10px] py-1 font-mono text-[10px] font-semibold" style={{ color: "var(--action)", background: "color-mix(in srgb, var(--action) 12%, transparent)" }}>
              {pricingPro.badge}
            </span>
            <p className="mb-2 text-[14px] font-semibold text-action">{pricingPro.name}</p>
            <div className="mb-[6px] flex items-baseline gap-[6px]">
              <span className="font-mono text-[40px] font-semibold tracking-[-.02em] text-ink">{pricingPro.price}</span>
              <span className="font-sans text-[14px] text-ink-3">{pricingPro.suffix}</span>
            </div>
            <p className="mb-[22px] font-sans text-[14px] leading-[1.5] text-ink-2">{pricingPro.desc}</p>
            <Link
              href={CTA_HREF}
              className="mb-[22px] block rounded-[9px] py-3 text-center text-[14px] font-semibold text-white transition hover:brightness-95"
              style={{ background: "linear-gradient(145deg, var(--action), var(--action-hover))", boxShadow: "0 10px 26px rgba(31,90,224,.28)" }}
            >
              {pricingPro.cta}
            </Link>
            <ul className="flex flex-col gap-[11px]">
              {pricingPro.features.map((f) => (
                <Feature key={f} text={f} variant="pro" />
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
