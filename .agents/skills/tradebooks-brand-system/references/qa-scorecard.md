# QA Scorecard — Tradebooks AI Brand System

Score each category 0–5.

- **0** = absent / broken
- **3** = acceptable but inconsistent
- **5** = strong and system-aligned

## 1) Brand & Trust Integrity

- [ ] Tone is professional, direct, and domain-expert (not startup-casual or vague).
- [ ] Messaging uses domain-native vocabulary (FIFO, ledger, voucher, STCG/LTCG, Tally XML).
- [ ] No vague AI claims — mechanism is explained, not black-box referenced.
- [ ] Trust is established before conversion ask.
- [ ] No overpromises on tax outcomes or regulatory compliance decisions.

**Score: __ / 5**

## 2) Information Architecture

- [ ] Page follows: problem → mechanism → proof → offer → CTA → FAQ sequence.
- [ ] Each section has a single clear purpose.
- [ ] Navigation reflects the professional buyer's mental model (How It Works / Pricing / Sample Output / For CAs).
- [ ] Pricing section appears after mechanism and proof, not before.

**Score: __ / 5**

## 3) CTA Hierarchy & Conversion Logic

- [ ] One primary CTA is clearly dominant ("Upload Tradebook" or "Start Free").
- [ ] Secondary CTAs support exploration, not competition ("See sample output", "How it works").
- [ ] Conversion ask appears after mechanism clarity and proof.
- [ ] Mobile sticky CTA mirrors primary and is dismissible.

**Score: __ / 5**

## 4) Design Language Fidelity

- [ ] Navy/slate base with teal/cyan primary action.
- [ ] Semantic state colors used correctly: green (success), amber (exception), red (error), blue (processing).
- [ ] Inter or equivalent sans-serif — no decorative or serif fonts.
- [ ] Monospace used for technical references (file names, data fields, format names).
- [ ] Motion is purposeful only (upload progress, hover lift) — no decorative animations.
- [ ] Spacing and radii convey professional precision (not rounded/playful consumer-app feel).

**Score: __ / 5**

## 5) Component System Quality

- [ ] Hero names the problem and solution explicitly; primary CTA is direct action-oriented.
- [ ] Trust chips immediately follow the hero with specific, verifiable claims.
- [ ] Pipeline steps (Upload → Process → Export) are clear and minimal-effort framed.
- [ ] Feature pillars explain the *mechanism* of reliability, not just feature names.
- [ ] Social proof includes specific outcomes (time saved, error reduction), not generic praise.
- [ ] FAQ addresses real blocking questions: Tally compatibility, data privacy, edge cases, broker support.

**Score: __ / 5**

## 6) Accessibility & Responsiveness

- [ ] Contrast/readability is strong across dark surfaces (WCAG AA).
- [ ] Semantic state colors paired with icon or label (not color-only).
- [ ] Keyboard/focus states are visible and usable on all interactive elements.
- [ ] Data tables and batch grids have proper ARIA roles and column headers.
- [ ] Hierarchy remains scannable on mobile.
- [ ] Upload flow is usable on mobile (touch-friendly, no tiny interaction targets).

**Score: __ / 5**

## 7) Audience Fit

- [ ] Individual trader audience is clearly addressed (pain: tax season data entry).
- [ ] CA / accountant audience is addressed (pain: handling multiple clients' broker data).
- [ ] Copy does not require financial domain expertise to understand (accessible to traders, not just accountants).
- [ ] No content that only makes sense for a different product category.

**Score: __ / 5**

---

## Scoring Bands

- **30–35**: Strong match, launch-ready.
- **22–29**: Good direction, revise weak areas before launch.
- **0–21**: Misaligned, rework positioning and architecture.

## Required Fix Rule

Regardless of total score, launch is blocked if any of these score below 3:
- Brand & Trust Integrity (vague AI claims = not launch-ready)
- CTA Hierarchy & Conversion Logic
- Accessibility & Responsiveness
- Design Language Fidelity (semantic state colors are critical for a financial tool)
