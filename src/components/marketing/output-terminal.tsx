"use client";

import { useState } from "react";
import { Container, Eyebrow, H2 } from "./section-primitives";
import { LinkIcon } from "./icons";
import { inr, vouchers, voucherTypeColor } from "./landing-data";

const GRID = "grid grid-cols-[80px_104px_1fr_140px_56px]";

export function OutputTerminal() {
  const [selectedId, setSelectedId] = useState("v1");
  const selected = vouchers.find((v) => v.id === selectedId) ?? vouchers[0];

  return (
    <section id="output" className="py-[60px]">
      <Container>
        <div data-reveal className="mb-10 max-w-[680px]">
          <Eyebrow color="var(--cyan)">SEE THE ACTUAL OUTPUT</Eyebrow>
          <H2 className="mt-[14px]">Real Tally vouchers. Every one traces to a source row.</H2>
          <p className="mt-4 font-sans text-[17px] leading-[1.6] text-ink-2">
            Not a cartoon and not a CSV dump — proper Sales, Purchase, Receipt and Journal vouchers
            that import clean into Tally Prime and ERP 9. Click any voucher to see the Console row it
            came from.
          </p>
        </div>

        <div data-reveal className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Left: voucher terminal */}
          <div
            className="overflow-hidden rounded-[14px]"
            style={{ border: "1px solid var(--hairline)", background: "var(--surface)", boxShadow: "0 30px 70px -34px rgba(11,31,51,.4)" }}
          >
            {/* chrome */}
            <div className="flex items-center gap-3 px-[18px] py-3" style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
              <div className="flex items-center gap-[6px]">
                {["#E2867C", "#E3B341", "#5FB37E"].map((c) => (
                  <span key={c} className="h-[10px] w-[10px] rounded-full" style={{ background: c }} />
                ))}
              </div>
              <span className="ml-1 rounded-[7px] px-3 py-[5px] font-mono text-[11.5px] text-ink-3" style={{ background: "var(--surface-3)" }}>
                app.tradebooks.ai / vouchers
              </span>
              <span className="ml-auto rounded-[6px] px-[11px] py-[5px] text-[11.5px] font-semibold text-white" style={{ background: "var(--action)" }}>
                Export to Tally →
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* column header */}
                <div className={`${GRID} px-[18px] py-[9px] text-[10px] uppercase tracking-[.05em] text-ink-3`} style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
                  <span>Date</span>
                  <span>Vch type</span>
                  <span>Ledger / particulars</span>
                  <span className="text-right">Amount</span>
                  <span className="text-right">Source</span>
                </div>

                {/* rows */}
                {vouchers.map((v) => {
                  const isSel = v.id === selectedId;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      aria-pressed={isSel}
                      onClick={() => setSelectedId(v.id)}
                      className={`${GRID} w-full cursor-pointer items-center px-[18px] py-[11px] text-left text-[13px]`}
                      style={{
                        borderBottom: "1px solid var(--hairline)",
                        background: v.st === "warn" ? "color-mix(in srgb, var(--warn) 5%, transparent)" : undefined,
                        boxShadow: isSel ? "inset 3px 0 0 var(--action)" : undefined,
                      }}
                    >
                      <span className="font-mono text-[12px] text-ink-2">{v.d}</span>
                      <span>
                        <span className="rounded-[5px] px-2 py-[2px] text-[11px] font-semibold" style={{ background: "var(--surface-3)", color: voucherTypeColor[v.vt] }}>
                          {v.vt}
                        </span>
                      </span>
                      <span className="truncate pr-2 text-ink">{v.ledger}</span>
                      <span className="text-right font-mono text-[12.5px]" style={{ color: v.amt < 0 ? "var(--neg)" : "var(--pos)" }}>
                        {inr(v.amt)}
                      </span>
                      <span className="flex justify-end">
                        {v.st === "warn" ? (
                          <span className="h-[7px] w-[7px] rounded-full" style={{ background: "var(--warn)" }} />
                        ) : (
                          <LinkIcon className="h-[15px] w-[15px] text-ink-3" sw={1.8} />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between px-[18px] py-[11px] font-mono text-[11px] text-ink-3" style={{ borderTop: "1px solid var(--hairline)" }}>
              <span>Tally XML · Excel · 1,240 vouchers</span>
              <span>balanced ✓</span>
            </div>
          </div>

          {/* Right: source trace */}
          <div className="overflow-hidden rounded-[14px]" style={{ border: "1px solid var(--hairline)", background: "var(--surface)" }}>
            <div className="flex items-center gap-[9px] px-[18px] py-[14px]" style={{ borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
              <LinkIcon className="h-[18px] w-[18px] text-action" sw={1.9} />
              <span className="text-[13px] font-semibold text-ink">Source trace</span>
              <span className="ml-auto font-mono text-[10.5px] text-ink-3" data-testid="trace-vch">{selected.vt} · {selected.d}</span>
            </div>
            <div className="p-[18px]">
              <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">Console tradebook row</p>
              <div className="mt-2 rounded-[9px] px-[14px] py-3 font-mono text-[12px] leading-[1.7]" style={{ border: "1px solid var(--hairline)", background: "var(--surface-2)" }} data-testid="trace-body">
                {Object.entries(selected.src).map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="text-ink-3">{k}</span>
                    <span style={{ color: k === "type" && val.includes("SELL") ? "var(--neg)" : "var(--ink)" }}>{val}</span>
                  </div>
                ))}
              </div>

              {/* resolves to */}
              <div className="my-4 flex items-center gap-2 font-sans text-[12px] text-ink-3">
                <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
                resolves to
                <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
              </div>

              <div className="flex flex-col gap-2 text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--pos)" }} />
                  <span className="text-ink">{selected.resolve.ledger}</span>
                  <span className="ml-auto font-mono" data-testid="trace-amt">{selected.resolve.amt}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--cyan)" }} />
                  <span className="text-ink">Holding lot · FIFO matched</span>
                  <span className="ml-auto font-mono text-ink-3">{selected.resolve.lot}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--ink-3)" }} />
                  <span className="text-ink">Treatment</span>
                  <span className="ml-auto font-mono">{selected.resolve.treat}</span>
                </div>
              </div>

              <p className="mt-4 font-sans text-[12px] leading-[1.5] text-ink-3">
                Click a different voucher on the left to trace it. Nothing posts to your books until
                you&rsquo;ve seen where it came from.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
