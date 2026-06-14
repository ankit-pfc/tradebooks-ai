import { Container, Eyebrow, H2 } from "./section-primitives";
import { steps, toneVar, type Step } from "./landing-data";

const tagClass =
  "rounded-full border border-hairline px-[11px] py-[4px] font-mono text-[11.5px] font-medium text-ink-2";

export function HowItWorks() {
  return (
    <section id="how" className="py-[60px]">
      <Container>
        <div data-reveal className="mb-12 max-w-[640px]">
          <Eyebrow>HOW IT WORKS</Eyebrow>
          <H2 className="mt-[14px]">One repeatable flow, with the hard parts handled.</H2>
          <p className="mt-4 font-sans text-[17px] leading-[1.6] text-ink-2">
            Upload, treatment, reconcile, export — the same path for every trading client.
            Here&rsquo;s what&rsquo;s actually happening under each step.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {steps.map((s) => (
            <article
              key={s.n}
              data-reveal
              className="grid grid-cols-1 items-center gap-8 rounded-[14px] px-[30px] py-[28px] lg:grid-cols-[1.25fr_0.9fr]"
              style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.05)" }}
            >
              <div>
                <div className="mb-[14px] flex items-center gap-3">
                  <span className="font-mono text-[13px] font-semibold" style={{ color: toneVar[s.tone] }}>{s.n}</span>
                  <span className="h-px w-[26px] shrink-0" style={{ background: toneVar[s.tone], opacity: 0.4 }} />
                  <h3 className="font-display text-[20px] font-semibold tracking-[-.02em] text-ink">{s.title}</h3>
                </div>
                <p className="mb-4 font-sans text-[15px] leading-[1.6] text-ink-2">{s.lead}</p>
                <div className="flex flex-wrap gap-2">
                  {s.tags.map((t) => (
                    <span key={t} className={tagClass} style={{ background: "var(--surface-2)" }}>{t}</span>
                  ))}
                </div>
              </div>
              <StepVisual step={s} />
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function VisualCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] p-4" style={{ border: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
      {children}
    </div>
  );
}

function MonoRow({ l, r, rColor }: { l: string; r: string; rColor?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[7px] font-mono text-[12px]">
      <span className="text-ink-2">{l}</span>
      <span className="font-medium" style={{ color: rColor ?? "var(--ink)" }}>{r}</span>
    </div>
  );
}

function StepVisual({ step }: { step: Step }) {
  if (step.n === "01") {
    return (
      <VisualCard>
        <div
          className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed px-4 py-6 text-center"
          style={{ borderColor: "var(--hairline-strong)" }}
        >
          <span
            className="grid h-9 w-9 place-items-center rounded-[9px]"
            style={{ background: "color-mix(in srgb, var(--action) 13%, transparent)", color: "var(--action)" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
            </svg>
          </span>
          <span className="text-[13px] font-medium text-ink">Drop files or browse</span>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {["tradebook.csv", "pnl.xlsx"].map((f) => (
              <span key={f} className="rounded-[6px] px-[9px] py-[3px] font-mono text-[11px] text-ink-2" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>{f}</span>
            ))}
          </div>
        </div>
      </VisualCard>
    );
  }

  if (step.n === "02") {
    return (
      <VisualCard>
        <MonoRow l="SELL INFY ×120" r="FIFO → lot 14 Aug 19" rColor="var(--cyan)" />
        <div style={{ borderTop: "1px solid var(--hairline)" }} />
        <MonoRow l="holding 5y 7m" r="LTCG" rColor="var(--pos)" />
        <div style={{ borderTop: "1px solid var(--hairline)" }} />
        <MonoRow l="pre-2018 lot" r="grandfathered ✓" rColor="var(--ink)" />
      </VisualCard>
    );
  }

  if (step.n === "03") {
    return (
      <VisualCard>
        <div className="flex items-center justify-between rounded-[8px] px-3 py-[10px]">
          <span className="flex items-center gap-2 text-[13px] text-ink">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--pos)" }} />
            1,228 matched
          </span>
          <span className="font-mono text-[12px] text-ink-3">auto</span>
        </div>
        <div className="flex items-center justify-between rounded-[8px] px-3 py-[10px]" style={{ background: "color-mix(in srgb, var(--warn) 6%, transparent)" }}>
          <span className="flex items-center gap-2 text-[13px] text-ink">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--warn)" }} />
            12 need your call
          </span>
          <span className="font-mono text-[12px] font-medium" style={{ color: "var(--warn)" }}>review →</span>
        </div>
      </VisualCard>
    );
  }

  // 04
  return (
    <VisualCard>
      <MonoRow l="vouchers.xml" r="1,240 ✓" rColor="var(--pos)" />
      <div style={{ borderTop: "1px solid var(--hairline)" }} />
      <MonoRow l="Dr = Cr" r="balanced" rColor="var(--pos)" />
      <button
        type="button"
        className="mt-3 w-full rounded-[8px] py-[9px] text-[13px] font-semibold text-white"
        style={{ background: "linear-gradient(145deg, var(--action), var(--action-hover))" }}
      >
        Import into Tally
      </button>
    </VisualCard>
  );
}
