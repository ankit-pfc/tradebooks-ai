import Link from "next/link";
import { Container } from "./section-primitives";
import { ArrowRightIcon } from "./icons";
import { CTA_HREF } from "./landing-data";

export function FinalCta() {
  return (
    <section id="cta" className="px-0 pb-[100px] pt-10">
      <Container>
        <div
          data-reveal
          className="relative overflow-hidden rounded-[22px]"
          style={{ border: "1px solid rgba(150,180,235,.14)", background: "linear-gradient(150deg, var(--brand), #0A0E14)" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(700px 360px at 75% 0%, rgba(91,141,239,.24), transparent 60%), radial-gradient(560px 280px at 12% 110%, rgba(57,176,240,.16), transparent 60%)",
            }}
          />
          <div className="relative z-[1] px-8 py-16 text-center sm:px-10 sm:py-[72px]" style={{ color: "#E7ECF4" }}>
            <h2 className="mx-auto mb-4 max-w-[18ch] font-display text-[clamp(30px,4.4vw,50px)] font-bold leading-[1.06] tracking-[-.035em] text-white">
              Run it on one real client file. Free.
            </h2>
            <p className="mx-auto mb-8 max-w-[46ch] font-sans text-[18px] leading-[1.55]" style={{ color: "#9AA6B8" }}>
              Bring a year of a trading client&rsquo;s Console export. Watch it become audit-defensible
              Tally vouchers — and decide for yourself.
            </p>
            <div className="mb-[18px] flex flex-wrap justify-center gap-[14px]">
              <Link
                href={CTA_HREF}
                className="inline-flex items-center gap-[9px] rounded-[10px] px-[30px] py-[15px] text-[16px] font-semibold text-white transition hover:brightness-95"
                style={{ background: "linear-gradient(145deg, var(--action), var(--cyan))", boxShadow: "0 14px 40px rgba(31,90,224,.4)" }}
              >
                Run your first file
                <ArrowRightIcon className="h-[18px] w-[18px]" sw={2} />
              </Link>
              <Link
                href="#logic"
                className="rounded-[10px] px-[28px] py-[15px] text-[16px] font-semibold text-white transition-colors hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.04)" }}
              >
                Read the accounting logic
              </Link>
            </div>
            <p className="font-sans text-[13px]" style={{ color: "#697587" }}>
              No card · no broker or Tally login · India-hosted
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
