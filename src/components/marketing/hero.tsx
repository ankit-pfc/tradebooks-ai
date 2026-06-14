import Link from "next/link";
import { Container } from "./section-primitives";
import { ArrowRightIcon } from "./icons";
import { CTA_HREF, heroBeliefs, heroExceptions, heroStats } from "./landing-data";

export function Hero() {
  return (
    <header id="top" className="pb-14 pt-[72px] sm:pt-[88px]">
      <Container className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_1.04fr] lg:gap-[60px]">
        {/* ── Left: editorial ── */}
        <div data-reveal>
          {/* Badge */}
          <div
            className="mb-[26px] inline-flex flex-wrap items-center gap-[9px] rounded-full py-[6px] pl-[7px] pr-[13px] font-sans text-[13px] text-ink-2"
            style={{ border: "1px solid rgba(31,90,224,.16)", background: "rgba(255,255,255,.7)" }}
          >
            <span className="whitespace-nowrap rounded-full bg-brand px-[9px] py-[3px] text-[11px] font-semibold tracking-[.03em] text-white">
              FOR CA PRACTICES
            </span>
            AI auto-mapping reconciles 94% of entries untouched
          </div>

          {/* H1 */}
          <h1 className="mb-[22px] max-w-[15ch] font-display text-[clamp(36px,4.4vw,60px)] font-bold leading-[1.05] tracking-[-.035em] text-ink">
            A P&amp;L is not your client&rsquo;s <span style={{ color: "var(--action)" }}>books.</span>
          </h1>

          {/* Sub */}
          <p className="mb-8 max-w-[46ch] font-sans text-[clamp(16px,1.5vw,19px)] leading-[1.6] text-ink-2">
            We built TradeBooks AI for the practice that still hand-posts every trading client into
            Tally at midnight. Console export in, audit-defensible vouchers out — the AI maps every
            line, and you review only what doesn&rsquo;t tie out.
          </p>

          {/* Three beliefs */}
          <div style={{ borderTop: "1px solid var(--hairline)" }}>
            {heroBeliefs.map((b, i) => (
              <div
                key={b.n}
                className="flex items-start gap-[14px] py-[15px]"
                style={i < heroBeliefs.length - 1 ? { borderBottom: "1px solid var(--hairline)" } : undefined}
              >
                <span className="pt-[2px] font-mono text-[12px] text-action">{b.n}</span>
                <div>
                  <p className="text-[15px] font-semibold text-ink">{b.title}</p>
                  <p className="font-sans text-[14px] text-ink-2">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-[30px] flex flex-wrap items-center gap-[13px]">
            <Link
              href={CTA_HREF}
              className="inline-flex items-center gap-2 rounded-[9px] px-[26px] py-[14px] text-[15px] font-semibold text-white transition hover:brightness-95"
              style={{
                background: "linear-gradient(145deg, var(--action), var(--action-hover))",
                boxShadow: "0 12px 30px rgba(31,90,224,.28)",
              }}
            >
              Run it on one client file — free
              <ArrowRightIcon className="h-[18px] w-[18px]" sw={2} />
            </Link>
            <Link
              href="#output"
              className="rounded-[9px] border px-[22px] py-[14px] text-[15px] font-semibold text-ink transition-colors hover:bg-surface-2"
              style={{ borderColor: "var(--hairline-strong)", background: "var(--surface)" }}
            >
              See the Tally output
            </Link>
          </div>
        </div>

        {/* ── Right: reconciliation surface ── */}
        <div data-reveal className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-[26px]"
            style={{
              background: "radial-gradient(closest-side, rgba(31,90,224,.14), transparent 72%)",
              filter: "blur(8px)",
            }}
          />
          <ReconCard />
          <p className="mt-3 text-center font-mono text-[10.5px] tracking-[.02em] text-ink-3">
            Sample client file · illustrative data
          </p>
        </div>
      </Container>
    </header>
  );
}

function ReconCard() {
  const dots = ["#E2867C", "#E3B341", "#5FB37E"];
  return (
    <div
      className="relative z-[1] overflow-hidden rounded-[14px]"
      style={{
        border: "1px solid var(--hairline)",
        background: "var(--surface)",
        boxShadow: "0 38px 84px -36px rgba(11,31,51,.42)",
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-[10px] px-[18px] py-[13px]"
        style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}
      >
        <div className="flex items-center gap-[6px]">
          {dots.map((c) => (
            <span key={c} className="h-[10px] w-[10px] rounded-full" style={{ background: c }} />
          ))}
        </div>
        <span className="ml-[6px] text-[13.5px] font-semibold text-ink">Reconciliation</span>
        <span className="hidden font-mono text-[11px] text-ink-3 sm:inline">Sharma Trading · FY 24–25</span>
        <span
          className="ml-auto rounded-[6px] px-[10px] py-[4px] font-mono text-[11px] font-semibold"
          style={{ background: "color-mix(in srgb, var(--warn) 13%, transparent)", color: "var(--warn)" }}
        >
          12 exceptions
        </span>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3" style={{ borderBottom: "1px solid var(--hairline)" }}>
        {heroStats.map((s, i) => (
          <div
            key={s.label}
            className="px-[18px] py-[16px]"
            style={i < 2 ? { borderRight: "1px solid var(--hairline)" } : undefined}
          >
            <div
              className="font-mono text-[24px] font-semibold tracking-[-.02em]"
              style={{ color: s.tone === "pos" ? "var(--pos)" : "var(--ink)" }}
            >
              {s.value}
            </div>
            <div className="font-sans text-[12px] text-ink-3">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Exception rows */}
      <div>
        {heroExceptions.map((ex) => (
          <div
            key={ex.cp}
            className="grid grid-cols-[1fr_auto] items-center gap-3 px-[18px] py-[13px]"
            style={{ borderBottom: "1px solid var(--hairline)" }}
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] text-ink">{ex.cp}</p>
              <p className="mt-[2px] font-mono text-[11px] text-ink-3">{ex.meta}</p>
            </div>
            <span
              className="rounded-full px-[9px] py-[3px] text-[10px] font-semibold"
              style={{ background: "color-mix(in srgb, var(--warn) 13%, transparent)", color: "var(--warn)" }}
            >
              {ex.kind}
            </span>
          </div>
        ))}
      </div>

      {/* Footer bar */}
      <div className="flex items-center gap-[10px] px-[18px] py-[12px]" style={{ borderTop: "1px solid var(--hairline)" }}>
        <span className="rounded-[7px] px-[14px] py-[7px] text-[12.5px] font-semibold text-white" style={{ background: "var(--action)" }}>
          Review 12 exceptions
        </span>
        <span className="font-sans text-[12px] text-ink-3">then export to Tally</span>
        <span className="ml-auto font-mono text-[11px] text-ink-3">⌘K</span>
      </div>
    </div>
  );
}
