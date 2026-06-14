"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wraps the landing page: sets the page background/ink, paints the fixed ambient
 * glow, and drives the scroll-reveal.
 *
 * Reveal is SEO-safe: the hidden state in globals.css only applies once this
 * controller adds `data-reveal-active`. Without JS — or under reduced motion —
 * `[data-reveal]` elements stay fully visible and crawlable.
 */
export function LandingShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      return; // leave everything visible, no animation
    }

    root.setAttribute("data-reveal-active", "");
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.06 },
    );
    targets.forEach((el) => observer.observe(el));

    // Safety net: reveal anything still hidden after 1.2s.
    const safety = window.setTimeout(() => {
      targets.forEach((el) => el.classList.add("is-revealed"));
    }, 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(safety);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="tb-landing relative min-h-screen overflow-x-hidden"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      {/* Fixed ambient glow behind everything */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(1100px 600px at 78% -8%, rgba(31,90,224,.07), transparent 60%)",
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
