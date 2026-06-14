import Link from "next/link";
import { Container, Eyebrow, H2 } from "./section-primitives";
import { ArrowRightIcon } from "./icons";
import { proofCards } from "./landing-data";

export function ProofSection() {
  return (
    <section className="py-[60px]">
      <Container>
        <div data-reveal className="mx-auto mb-[44px] max-w-[680px] text-center">
          <Eyebrow>PROOF</Eyebrow>
          <H2 className="mt-[14px]">The only testimonial that matters is your own output.</H2>
          <p className="mt-4 font-sans text-[17px] leading-[1.6] text-ink-2">
            We&rsquo;re early, and we won&rsquo;t pretend otherwise with invented quotes. Here&rsquo;s
            the proof we&rsquo;ll actually stand behind.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {proofCards.map((c) => (
            <div
              key={c.n}
              data-reveal
              className="rounded-[14px] p-[28px]"
              style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.05)" }}
            >
              <p className="mb-[14px] font-mono text-[13px] text-ink-3">{c.n}</p>
              <h3 className="mb-2 text-[18px] font-semibold tracking-[-.01em] text-ink">{c.title}</h3>
              <p className="font-sans text-[14px] leading-[1.55] text-ink-2">{c.body}</p>

              {c.link && (
                <Link href="#logic" className="mt-3 inline-flex items-center gap-[5px] text-[13.5px] font-semibold text-action">
                  Read the accounting logic
                  <ArrowRightIcon className="h-[14px] w-[14px]" sw={2} />
                </Link>
              )}

              {c.tags && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="whitespace-nowrap rounded-full px-[11px] py-[5px] text-[12px] font-medium text-ink-2"
                      style={{ border: "1px solid var(--hairline)", background: "var(--surface-2)" }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
