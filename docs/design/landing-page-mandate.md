# TradeBooks AI — Landing Page Mandate (v2)

> **Purpose:** the brief design runs on to rebuild the landing page. Not a copy deck — a *mandate*: who we're talking to, what they need to feel and learn, the narrative arc, the IA, the creative/visual direction, and the proof strategy.
> **Companion doc:** visual system, tokens, and components live in [ui-redesign.md](docs/design/ui-redesign.md). This doc inherits that design language (hybrid: calm shell + terminal-grade data) and tells design *what story to build with it*.
> **Positioning:** unchanged (it's right). What changes is **depth, narrative, humanity, and proof** — the current page is competent but shallow and transactional.

---

## Part A — Why the current page reads "shallow & transactional"

Read of the live page ([page.tsx](src/app/(marketing)/page.tsx)). It's not broken — it's *thin*. Specific diagnosis:

1. **It's a feature checklist, not a point of view.** Hero → flow → stats → trust → problem → testimonials → how → who → proof → features → comparison → pricing → FAQ → CTA. Every section is a transactional unit ("here's a benefit, here's a CTA"). Nothing tells you *why TradeBooks exists*, what the team believes about accounting, or where this is going. There is **no narrative and no vision** — so it feels like any SaaS template.
2. **It leans on fabricated proof — a real liability.** The testimonials ("Rajesh Bhatia, Senior CA Partner"; "Shreya Iyer, Accounts Lead") and the pain stats ("18+ hrs", "3x", "87% errors discovered late") appear invented. For a product whose entire pitch is **trust, traceability, and audit-grade accuracy**, fabricated proof is both an ethical problem and a positioning contradiction. A CA will smell it instantly. **This must go.** Part E gives an honest early-stage proof strategy.
3. **It's all UI chrome, no humans, no domain texture.** One stock "subject" model image in the hero; everything else is cards, tables, and gradients. There's no face of the team, no real CA workflow, no Indian-finance texture, no founder voice. It reads like software talking about itself, not a product made by people who understand the 2 a.m. tax-audit-season grind.
4. **Density without depth.** It *looks* busy (14 sections) but says little. Generic verbs ("Standardize", "Reduce", "Improve consistency"). No specifics a CA would nod at: 44AB tax-audit pressure, FIFO grandfathering on pre-2018 holdings, charges/STT/GST ledger mapping, multi-client close calendars. **Depth = domain specificity**, and that's missing.
5. **No "who built this / why trust it" layer.** No about, no methodology, no security depth surfaced, no founder. Premium fintech earns trust by showing its work; this page hides it.

> The fix is not "more sections." It's **a narrative spine, real domain depth, human texture, and honest proof.**

---

## Part B — ICP research synthesis

Method: digital-watering-hole scan + competitive landscape + domain analysis. Confidence labeled per claim. Caveat: this is desk research — validate the starred ⚠️ items with 5–8 real customer conversations before treating as fact.

### B.1 The core insight that reframes everything

**TradeBooks is not a tax-filing tool. It's a bookkeeping/Tally-automation tool.** This matters enormously for the ICP:

- Filing tools (Quicko ₹99–/mo, ClearTax with 80+ broker auto-imports) answer *"what's my capital gains tax?"* for the **taxpayer**, once a year. `[High]`
- TradeBooks answers *"get these trades into the client's **books** in Tally, voucher-by-voucher, audit-traceable, every close"* — a **recurring practitioner workflow**, not an annual filing. `[High]`

So the primary ICP is **not the retail trader** (they're served by Quicko/ClearTax). The primary ICP is **the CA / accounting practice that maintains books in Tally for trading & investor clients** — a job the filing tools explicitly don't do. The trader is a *secondary/wedge* persona. The current page hedges across all three equally; the new page should **lead hard with the CA practice.**

### B.2 Segments (priority order)

| # | Segment | Why they're primary | Confidence |
|---|---|---|---|
| **1** | **CA firms / practitioners** maintaining client books in Tally, with ≥ a few active-trader/investor clients | Recurring pain, billable-hour math, they already live in Tally, they buy software regularly | High |
| **2** | **In-house accounting teams** at trading firms, family offices, HNI/prop desks, brokers' own back-office | Same workflow, internal not client-facing; larger volume | Medium |
| **3** | **Active/pro traders & HNIs** who maintain proper books (not just file ITR) | Smaller TAM, but a self-serve wedge and word-of-mouth into segment 1 | Medium ⚠️ |

### B.3 Primary persona — "The Practice CA"

```
The Practice CA — Partner / Senior at a small-to-mid CA firm (2–25 people)

Profile
- Runs/works at an independent practice; 30–200 clients across GST, audit, ITR, books
- A meaningful slice are traders/investors with Zerodha (and other) activity
- Lives in: TallyPrime, Excel, the income-tax & GST portals, WhatsApp (client docs),
  a filing tool (Quicko/ClearTax/Winman/CompuTax) for ITRs
- Deeply time-poor in Jul–Sep (ITR + tax audit) and at every quarter/year close

Primary JTBD
"When a trading client hands me a year of Zerodha activity, help me turn it into
correct, audit-defensible Tally books fast — without me or my juniors hand-posting
hundreds of vouchers and reconciling CSVs at midnight."
  - Functional: broker exports → correct Tally vouchers, reconciled, traceable
  - Emotional: confidence it's right; not dreading audit season; not babysitting juniors
  - Social: look sharp/modern to clients and peers; a practice that's "on top of it"

Trigger events
- A new trading client signs on (or an existing one's volume explodes — F&O boom)
- Tax-audit (44AB) applicability → books must be defensible, not just a P&L
- A junior's manual posting error surfaces during review/audit
- Filing-season crunch: too many books, too few hours
- Peer mentions a tool at an ICAI study-circle / WhatsApp group

Top pains (in their language) ⚠️ validate verbatims
- "Zerodha's P&L isn't books — I still have to create every voucher in Tally."
- "Reconciling tradebook vs funds vs contract notes across sheets is a nightmare."
- "FIFO + grandfathering + charges/STT/GST mapping by hand = errors I find too late."
- "I can't bill clients for the hours this actually takes."
- "One client = half a day of a junior's time, every close."

Desired outcome
- One repeatable upload → review → export flow across every trading client
- Vouchers that import clean into Tally Prime/ERP 9 and survive an audit
- Hours back during the worst weeks of the year

Objections & fears
- "Is the accounting actually correct? (FIFO, treatment, charges) I can't trust a black box."
- "Will I have to redo it in Tally anyway?"
- "Is my client's financial data safe? Do they need my Tally/broker login?"
- "Only Zerodha? Half my clients use other brokers."
- "Another monthly SaaS bill — is it worth ₹2,999?"

Alternatives
- Manual: juniors hand-posting in Tally from Excel (status quo, the real competitor)
- Filing tools (Quicko/ClearTax) — but those file ITRs, they don't produce Tally books
- Generic CSV → Tally importers — but they're "dumb" (no treatment logic, no reconciliation)
- Doing nothing / turning away trading clients

How to reach them
- Channels: CAclubindia, ICAI study circles & CMP portal, r/IndiaTax & r/CAStudents,
  CA-focused YouTube (tax/Tally tutorials), LinkedIn (CA practice content), Twitter/X "fintwit"
  & CA-tax accounts, WhatsApp/Telegram CA groups, Tally-partner ecosystem
- Content they trust: specific, correct, no-fluff tax/Tally how-tos; ICAI-aligned;
  peer recommendation > ads; demos & free trials > sales calls
```

### B.4 Secondary persona — "The Serious Trader" (wedge)

Active F&O/equity trader or HNI investor who keeps real books (often *because* of tax-audit applicability), not just an annual ITR. Pain: "my CA charges a lot / takes forever because my trades are a mess to account for." Job: hand my CA (or my own Tally) clean, ready books. **Use as a wedge and a word-of-mouth driver into segment 1, not the headline.** ⚠️ size unvalidated.

### B.5 What they currently use (the stack we slot into)

`[High]` Tally Prime / ERP 9 (the books — non-negotiable, #1 for CA firms), Zerodha Console (exports), Excel (the glue + the pain), a filing tool for ITRs (Quicko / ClearTax / Winman / CompuTax / KDK), the IT & GST portals, WhatsApp for client docs. **TradeBooks sits in the gap between Console exports and Tally** — a gap the filing tools deliberately don't fill. Say that explicitly.

### B.6 How they evaluate & decide

`[Medium]` CA software selection prioritizes: **compliance/accounting correctness**, **Tally compatibility**, **multi-client scalability without per-seat gouging**, **data security**, and **peer trust**. ICAI doesn't certify tools but its CMP benefits portal signals legitimacy; "ICAI-aligned" matters. Decisions are **trust-led and peer-led** — a demo they can run on their own messy client file beats any claim. They are **skeptical of black boxes** touching client money/data. Free trial + "see the actual output" + transparent methodology >> sales motion.

### B.7 Information depth they need (this is the crux of the redesign)

CAs are **detail buyers**. Unlike a consumer landing page (where less is more), this audience trusts a page **more** when it shows it understands the hard parts. They want to see:
- The **actual Tally voucher output** and that it imports clean (not a cartoon).
- The **accounting logic spelled out**: FIFO, grandfathering (pre-31 Jan 2018), Investor vs Trader treatment, how charges/STT/GST/brokerage are mapped to ledgers.
- The **reconciliation/exception model** — what happens when files don't tie out.
- **Security specifics** — no broker/Tally credentials, no AI training on their data, where it's hosted.
- **Edge-case honesty** — what it does *not* do yet (only Zerodha) builds more trust than hiding it.

> Design implication: the page should have **both** a fast, calm top (for the skim) **and** deep, expandable, domain-rich substance below (for the scrutinizer). Progressive disclosure: simple path first, depth one click away. This *is* the "more depth" the brand needs.

### B.8 Approachability cues

CAs are precise but human, and chronically overworked. Approachability = **respect their expertise + lighten their load**, not dumb it down or get cute. Warmth comes from: real faces (theirs and ours), plain language for the busy moments ("get your weekend back during audit season"), founder voice, and *not* over-claiming. Avoid: hype, fake urgency, emoji-spam, startup-bro tone, condescension about "going digital."

---

## Part C — The narrative spine (what gives it depth)

Before sections, the page needs **one through-line**. Recommended spine:

> **"Zerodha gives you a P&L. Your client's books need vouchers. We built the bridge — with an accountant's rigor, not a parser's guesswork."**

Three brand beliefs to thread through the page (this is the "vision/depth" that's missing):

1. **Books, not just numbers.** A P&L statement isn't accounting. Real practice means correct, traceable vouchers in the ledger. We respect that difference.
2. **Rigor you can audit.** Every voucher traces to a source row. We show our accounting logic; we don't hide it in a black box. Trust is earned by transparency.
3. **Built for Indian practice, by people who get it.** Tally-native, ICAI-aligned, Zerodha-first because that's where the volume is. Not a generic Western tool bent to fit.

Every section should ladder up to one of these. That's what turns a checklist into a worldview.

---

## Part D — Information architecture (new section map)

Reordered around the narrative, with depth built in. **Bold = new or substantially deepened.**

| # | Section | Job | Depth notes |
|---|---|---|---|
| 1 | **Hero** | Narrative hook + the bridge metaphor + 1 primary CTA | Lead with the CA, not "everyone." Headline carries the point of view, not just the feature. Real product glimpse + a human element. |
| 2 | Trust strip | Quiet credibility | Tally Prime/ERP 9, Zerodha Console, "No credentials, no AI training", India-hosted. Keep it calm, hairline. |
| 3 | **The gap (problem, reframed)** | Name the real problem with domain specificity | "A P&L is not your client's books." Show the manual reality (CSV→Excel→hand-posting→reconcile). Drop the fabricated stats; use an honest, illustrative cost-of-time framing clearly labeled as illustrative, or a real before/after of the workflow. |
| 4 | **How it works (deepened)** | The 4-step flow, but with real substance | Keep upload→treatment→reconcile→export. Add, per step, *what's actually happening* (FIFO, exception types, ledger mapping). Anchor with a real product screenshot per step. |
| 5 | **See the actual output** | The single most persuasive section for a CA | Real Tally voucher preview + the source-row traceability + "imports clean into Tally." Make this richer and more central than today. |
| 6 | **The accounting logic (NEW — depth anchor)** | Prove the rigor | Expandable explainers: FIFO & grandfathering, Investor vs Trader treatment, charges/STT/GST/brokerage ledger mapping, exception-first reconciliation. This is the section that earns the "premium/proprietary" read. Progressive disclosure. |
| 7 | **Who it's for** | Segment self-identification | Lead CA firms; then in-house teams; then traders as wedge. Concrete scenarios, not generic verbs. |
| 8 | **Security & trust (NEW/elevated)** | Kill the #1 objection | No broker/Tally credentials, no AI training on client data, India-hosted, audit traceability. Pull from brand-facts; make it visual and prominent, not buried. |
| 9 | **Built by / our approach (NEW — humanity + vision)** | Face + founder voice + worldview | Short founder/team note: why we built this, our accounting-rigor stance, where we're going (multi-broker roadmap, honest about today). This is where the brand becomes a *company*, not a tool. |
| 10 | **Proof** | Honest social proof | See Part E. Design partners / early practices / methodology transparency / "vs manual" — NOT fabricated quotes. |
| 11 | Comparison | Position vs the real alternatives | vs **Manual/Excel** (the true competitor) and vs **filing tools** (Quicko/ClearTax — "they file ITRs, we build books"). Honest, not strawman. |
| 12 | Pricing | Clear value math | Keep simple Free/Pro. Frame against billable-hours saved, honestly. |
| 13 | FAQ | Handle the detailed objections | Keep — it's genuinely good and serves the detail-buyer. Add: correctness/FIFO, audit-defensibility, "will I redo it in Tally," other brokers, data location. |
| 14 | Final CTA | One clear action + reassurance | "Run it on one real client file, free." Low-risk, proof-oriented. |

Net: trim transactional repetition (multiple near-identical CTAs/cards), **add the four depth/humanity anchors** (#6 logic, #8 security, #9 built-by, honest #10 proof).

---

## Part E — Social proof strategy (honest, early-stage)

You cannot use invented testimonials. Replace with proof you can actually stand behind, in rough order of power for this audience:

1. **"Run it on your own messy client file" demo/free trial** — for a skeptical CA, *their own output* is the only testimonial that matters. Make this the hero of proof.
2. **Methodology transparency as proof** — showing the FIFO/treatment/reconciliation logic openly *is* a trust signal (the "we show our work" move). Section 6 doubles as proof.
3. **Design partners / early practices** — if any real firms are using it, name them *with permission* (even "a Mumbai-based practice managing 40+ trading clients" if they prefer anonymity — but only if true). Quote real words only.
4. **Founder credibility** — who built it, relevant accounting/fintech background, why. A real face and a real name out-trusts a fake testimonial 100:1.
5. **Ecosystem/compatibility signals** — Tally-native, Zerodha Console, ICAI-aligned workflow, India-hosted, security posture. Logos/marks for *real* integrations only.
6. **Numbers only when real** — replace "18+ hrs / 3x / 87%" with either (a) clearly-labeled illustrative math ("a typical active-trader client ≈ X vouchers; hand-posting ≈ Y hours — here's the math") or (b) nothing until you have real data. Never imply measured results you don't have.

> Rule for design & copy: **every quote attributed to a person must be a real person who said it.** Every stat must be sourced or labeled illustrative. This is non-negotiable for a trust product.

---

## Part F — Creative & visual direction (humanize it)

The brief: *less SaaS-template, more "real product made by people who understand Indian practice."* Inherit the [ui-redesign.md](docs/design/ui-redesign.md) system (navy + the one azure, tinted neutrals, Geist Mono for figures, soft real depth). Then add **humanity and texture** the current page lacks.

### F.1 Photography & human imagery (the biggest humanizing lever)
- **Real people, Indian context.** The CA at a real desk during audit season; a junior and partner reviewing on a laptop; hands on a keyboard with Tally on screen; a calm "books closed" moment. Warm, documentary, *not* glossy stock-corporate. Shoot or source authentically Indian (offices, light, attire, dual monitors, chai-on-desk realism).
- **The founder/team** — a real photo in section 9. Faces build trust faster than any feature.
- Treatment: natural light, slightly warm grade, navy/azure accents pulled in via environment, not filters. Avoid blue-tinted "fintech stock" clichés.
- The existing hero "subject" model image is a placeholder-grade asset — upgrade to either a real shoot or a more intentional, less-stocky composition.

### F.2 Product imagery (the proof)
- **Real, high-fidelity screenshots** of the redesigned app — the exception review, the Tally voucher output, the source-row traceability. Shot in the new design system (mono figures, terminal-grade table). These are simultaneously proof *and* the "premium proprietary" signal.
- Annotated product shots in section 6 (callouts on FIFO, treatment, ledger mapping) — show the rigor visually.

### F.3 Illustration & diagram system (depth + brand)
- A small, **custom illustration language** for the abstract bits (the "bridge" metaphor, the reconciliation/exception concept, security). Precise, line-based, navy/azure, faintly technical — think "engineering schematic," not bouncy SaaS blobs. This is a key differentiator from template-SaaS.
- The **"bridge" hero motif**: Zerodha P&L → [TradeBooks bridge] → Tally vouchers. One strong, ownable visual idea instead of generic cards.
- Real ledger/voucher textures, T-account motifs, Tally-import visuals — domain texture that says "we speak accounting."

### F.4 Motion (restrained, premium)
- One tasteful hero moment (the bridge assembling, or a CSV row resolving into a clean voucher). Respect `prefers-reduced-motion`.
- Section reveals: subtle, staggered, fast (per the motion tokens). No carousels of fake screens; no parallax overload.

### F.5 Tone & microcopy
- Plain, precise, peer-to-peer. Talk to a CA like a sharp colleague, not a lead.
- Allowed warmth: "Get your weekend back during audit season." Not allowed: hype, fake countdowns, "revolutionary," emoji as decoration.
- Use **real domain vocabulary** (vouchers, FIFO, grandfathering, 44AB, STCG/LTCG, contract note, Console) — specificity *is* the premium signal for this buyer.

---

## Part G — Guardrails / kill list

- ❌ **Remove all fabricated testimonials and unsourced stats.** (Integrity + positioning contradiction.)
- ❌ No generic stock "diverse team pointing at a chart."
- ❌ No more than one primary CTA per section; stop repeating the same button 8×.
- ❌ Don't bury security and accounting logic — they're the *reasons to believe*, surface them.
- ❌ Don't claim multi-broker; be honest it's Zerodha-first and say why (quality).
- ❌ Don't over-simplify for this audience — depth builds trust here.
- ✅ Lead with the CA practice, treat traders as the wedge.
- ✅ Show real output, real logic, real faces, real proof.
- ✅ One narrative spine; every section ladders to a brand belief.
- ✅ Inherit the design system; add human + domain texture on top.

---

## Part H — How to run this on design + open questions to validate

**To run on design:** hand design this doc + [ui-redesign.md](docs/design/ui-redesign.md). Sequence: (1) lock narrative spine & hero concept, (2) wireframe the new IA (Part D), (3) art-direct the photography/illustration system (Part F), (4) design section-by-section, (5) copy pass with real domain depth, (6) build.

**Validate before committing (the ⚠️ items):**
1. Is the CA-practice the real primary buyer, or is it in-house trading-firm teams? (Talk to 5–8 of each.)
2. Real verbatim language — replace my placeholder quotes with actual customer words (feeds `copywriting`).
3. Do we have *any* real design partners / early users to quote or feature?
4. Founder/team willingness to be on the page (photo + voice).
5. Real product screenshots in the new design system (depends on the redesign shipping).

**Suggested next skills:** `copywriting` / `anthropic-skills:landing-page-writing` (turn this mandate into the actual copy deck once verbatims exist), `competitor-alternatives` (deepen the vs-Quicko / vs-manual pages), `seo-geo` (the page also needs to be citable by AI search — brand-facts already hints you care about this).

---

## Sources

- [Zerodha — filing with tax reports / capital gains statement](https://support.zerodha.com/category/console/reports/taxation/articles/things-to-consider-when-filing-taxes-using-zerodha-s-reports)
- [ClearTax vs Quicko comparison](https://cleartax.in/s/cleartax-vs-quicko-comparison) · [ITR platforms for traders (Angel One)](https://www.angelone.in/knowledge-center/income-tax/quicko-cleartax-itr-filing-for-traders-at-angel-one)
- [Top cloud accounting tools for CAs 2025](https://blog.camonk.com/top-cloud-accounting-tools-for-cas-in-india-2025/) · [ICAI software vendor guide / why TallyPrime](https://www.tallyatcloud.com/article/icai-software-vendor-guide-2025-approved-tools-compliance-solutions-benefits-why-tallyprime-remains-the-no1-choice-for-ca-firms/601/0/1) · [Best accounting software for CA firms](https://profitbooks.net/best-accounting-software-for-ca-firms-in-india/)
- TradeBooks current-state: [landing page.tsx](src/app/(marketing)/page.tsx), [brand-facts](src/app/(marketing)/brand-facts/page.tsx), [AGENTS.md](AGENTS.md)
