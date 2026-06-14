import { Container, Eyebrow } from "./section-primitives";
import { CogIcon, GlobeIcon, LockIcon, ShieldCheckIcon } from "./icons";
import { securityCards } from "./landing-data";

const iconFor = {
  lock: LockIcon,
  cog: CogIcon,
  globe: GlobeIcon,
  shield: ShieldCheckIcon,
};

export function SecurityPanel() {
  return (
    <section id="security" className="py-[60px]">
      <Container>
        <div
          data-reveal
          className="relative overflow-hidden rounded-[18px]"
          style={{ border: "1px solid var(--hairline)", background: "linear-gradient(155deg, var(--brand), #0A0E14)" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: "radial-gradient(700px 360px at 85% 0%, rgba(91,141,239,.20), transparent 60%)" }}
          />
          <div className="relative z-[1] px-8 py-12 sm:px-[44px] sm:py-[48px]">
            <div className="mb-9 max-w-[620px]">
              <Eyebrow color="#74A1F2">SECURITY &amp; TRUST</Eyebrow>
              <h2 className="mt-[14px] font-display text-[clamp(26px,3.2vw,40px)] font-bold leading-[1.12] tracking-[-.03em] text-white">
                The first question a CA asks. So we answer it loudly.
              </h2>
              <p className="mt-4 font-sans text-[16px]" style={{ color: "#9AA6B8" }}>
                You&rsquo;re trusting us with a client&rsquo;s financial data. Here&rsquo;s exactly how
                that&rsquo;s handled — no fine print.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-4">
              {securityCards.map((c) => {
                const Icon = iconFor[c.icon];
                return (
                  <div
                    key={c.title}
                    className="rounded-[12px] p-[22px]"
                    style={{ border: "1px solid rgba(150,180,235,.14)", background: "rgba(255,255,255,.04)" }}
                  >
                    <span
                      className="mb-[14px] grid h-[38px] w-[38px] place-items-center rounded-[10px]"
                      style={{ background: "rgba(255,255,255,.07)", color: "#74A1F2" }}
                    >
                      <Icon className="h-5 w-5" sw={1.8} />
                    </span>
                    <p className="mb-[6px] text-[15px] font-semibold text-white">{c.title}</p>
                    <p className="font-sans text-[13px] leading-[1.5]" style={{ color: "#9AA6B8" }}>{c.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
