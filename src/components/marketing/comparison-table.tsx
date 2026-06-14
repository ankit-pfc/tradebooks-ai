import { Container, Eyebrow, H2 } from "./section-primitives";
import { CheckIcon, XIcon } from "./icons";
import { comparisonColumns, comparisonRows } from "./landing-data";

const GRID = "grid grid-cols-[1.6fr_1fr_1fr_1fr]";

function Cell({ value }: { value: string }) {
  if (value === "yes") {
    return (
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: "color-mix(in srgb, var(--pos) 15%, transparent)", color: "var(--pos)" }}>
        <CheckIcon className="h-[13px] w-[13px]" sw={2.2} />
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="grid h-[22px] w-[22px] place-items-center rounded-full" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>
        <XIcon className="h-[12px] w-[12px]" sw={2} />
      </span>
    );
  }
  return <span className="font-sans text-[12.5px] text-ink-3">{value}</span>;
}

export function ComparisonTable() {
  return (
    <section className="py-[60px]">
      <Container>
        <div data-reveal className="mb-10 max-w-[640px]">
          <Eyebrow>VS THE ALTERNATIVES</Eyebrow>
          <H2 className="mt-[14px]">Honestly, against what you&rsquo;d use instead.</H2>
          <p className="mt-4 font-sans text-[17px] leading-[1.6] text-ink-2">
            The real competitor is a junior and a spreadsheet. Filing tools are great — at filing.
            Neither builds books.
          </p>
        </div>

        <div data-reveal className="overflow-x-auto rounded-[14px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 1px 2px rgba(11,31,51,.05)" }}>
          <div className="min-w-[640px]">
            {/* header */}
            <div className={`${GRID}`} style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--hairline)" }}>
              {comparisonColumns.map((col, i) => (
                <div
                  key={i}
                  className={`px-[18px] py-[15px] text-[13px] font-semibold ${i === 0 ? "" : "text-center"}`}
                  style={
                    i === 3
                      ? { color: "var(--action)", background: "color-mix(in srgb, var(--action) 6%, transparent)" }
                      : i === 0
                        ? undefined
                        : { color: "var(--ink-2)" }
                  }
                >
                  {col || " "}
                </div>
              ))}
            </div>

            {/* rows */}
            {comparisonRows.map((row) => (
              <div key={row[0]} className={`${GRID}`} style={{ borderTop: "1px solid var(--hairline)" }}>
                {row.map((cell, i) => (
                  <div
                    key={i}
                    className={`flex items-center px-[18px] py-[14px] ${i === 0 ? "text-[14px] text-ink" : "justify-center"}`}
                    style={i === 3 ? { background: "color-mix(in srgb, var(--action) 5%, transparent)" } : undefined}
                  >
                    {i === 0 ? cell : <Cell value={cell} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
