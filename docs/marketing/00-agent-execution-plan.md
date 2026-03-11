# TradeBooks AI — Marketing & CRO Multi-Agent Execution Plan

Last updated: 2026-03-11

## Objective
Create a substantial, execution-ready marketing system for TradeBooks AI covering:
- market understanding
- positioning and messaging
- landing page structure and copy hierarchy
- conversion architecture for subscribe/purchase
- signup flow and funnel design
- pricing/packaging
- measurement and experiments

This plan is intentionally split so multiple agents can work in parallel without scope collision.

---

## Product truth (non-negotiable for all agents)
- TradeBooks AI is **Zerodha-first** in V1.
- Core value: convert broker exports to **reconciled, Tally-importable outputs**.
- Primary buyers: Indian **CAs/accountants** with repeat monthly workflows.
- Do not over-claim production readiness where app flows are still being wired.

---

## Strategic baseline

### Primary ICP
Indian CA firms and accountants managing client books where Zerodha activity must be reflected in Tally accurately.

### Secondary ICPs
- In-house accounting teams at small firms/family offices
- Serious active traders/self-filers

### Core JTBD
When I need to convert Zerodha exports into accurate accounting entries in Tally, help me avoid manual posting and reconciliation chaos while keeping an audit-traceable workflow.

### Positioning spine
TradeBooks AI is the Zerodha-to-Tally accounting workflow for Indian accountants: upload exports, reconcile automatically, review exceptions, and export Tally-importable XML.

### Messaging pillars
1. Remove manual posting
2. Reconcile before import
3. Tally-ready outputs
4. Built for Indian accounting reality
5. Audit confidence with traceability

---

## Agent execution order

### Run first
1. **MKT-01** Product marketing context foundation

### Then parallel-safe
2. **MKT-02** Homepage structure & copy hierarchy
3. **MKT-03** Pricing & packaging
4. **MKT-05** Trust/proof/objection handling
5. **MKT-06** Public pages + SEO baseline

### Then
6. **MKT-04** Signup + conversion funnel (depends on MKT-02/MKT-03 direction)

### Then
7. **MKT-07** Analytics + experimentation

### Final integration
8. **MKT-08** Implementation integrator

---

## Agent task list (file references)

- **MKT-01** → `docs/marketing/01-product-marketing-context.md`
- **MKT-02** → `docs/marketing/02-homepage-structure-and-copy.md`
- **MKT-03** → `docs/marketing/03-pricing-and-packaging.md`
- **MKT-04** → `docs/marketing/04-signup-and-conversion-funnel.md`
- **MKT-05** → `docs/marketing/05-trust-proof-and-objections.md`
- **MKT-06** → `docs/marketing/06-public-pages-and-seo.md`
- **MKT-07** → `docs/marketing/07-analytics-and-experiments.md`
- **MKT-08** → `docs/marketing/08-marketing-implementation-integrator.md`

Canonical task index:
- `docs/marketing/TASK-LIST.md`

---

## Reusable agent start prompt (copy/paste)

Use this exact template for each assigned agent task:

```md
You are assigned marketing task [TASK_ID] for TradeBooks AI.

Read in order:
1) AGENTS.md
2) docs/marketing/00-agent-execution-plan.md
3) docs/marketing/TASK-LIST.md
4) docs/marketing/[TASK_FILE].md

Execution rules:
- Stay strictly within the scope in [TASK_FILE].md
- Respect dependencies and out-of-scope boundaries
- Use only the listed source files unless dependency notes require expansion
- Keep all messaging aligned with V1 truth: Zerodha-first, Tally-focused, no over-claims

Output required:
- Deliverables exactly as listed in [TASK_FILE].md
- A short handoff note: what changed, what remains, risks/assumptions
```

---

## Conversion strategy baseline for all agents
- Primary near-term conversion: **beta/signup or first-import activation**
- Secondary conversion: **demo/contact for CA firms**
- CTA architecture: single dominant CTA + one secondary exploratory CTA
- Pricing path: free-first entry + paid recurring plans aligned to value metric (imports/batches/client books)

---

## Handoff format standard
Every agent must end with:
- What changed
- What remains
- Risks/assumptions
- Files touched
