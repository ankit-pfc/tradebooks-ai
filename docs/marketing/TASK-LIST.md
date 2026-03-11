# TradeBooks AI — Marketing Agent Task List

Use this list as the canonical handoff index.

## Read first (all agents)
1. `AGENTS.md`
2. `docs/marketing/00-agent-execution-plan.md`
3. This file (`docs/marketing/TASK-LIST.md`)
4. Your assigned task file below

## Task index

| Task ID | Task File | Depends On | Status |
|---|---|---|---|
| MKT-01 | `docs/marketing/01-product-marketing-context.md` | None | Done |
| MKT-02 | `docs/marketing/02-homepage-structure-and-copy.md` | MKT-01 | Done |
| MKT-03 | `docs/marketing/03-pricing-and-packaging.md` | MKT-01 | Done |
| MKT-04 | `docs/marketing/04-signup-and-conversion-funnel.md` | MKT-02, MKT-03 | Done |
| MKT-05 | `docs/marketing/05-trust-proof-and-objections.md` | MKT-01 | Done |
| MKT-06 | `docs/marketing/06-public-pages-and-seo.md` | MKT-02, MKT-03 | Done |
| MKT-07 | `docs/marketing/07-analytics-and-experiments.md` | MKT-02, MKT-03, MKT-04 | Done |
| MKT-08 | `docs/marketing/08-marketing-implementation-integrator.md` | MKT-02..MKT-07 | Done |

## Standard start prompt

```md
You are assigned marketing task [TASK_ID] for TradeBooks AI.

Read in order:
1) AGENTS.md
2) docs/marketing/00-agent-execution-plan.md
3) docs/marketing/TASK-LIST.md
4) docs/marketing/[TASK_FILE].md

Execution rules:
- Stay strictly within scope in [TASK_FILE].md
- Respect dependencies and out-of-scope boundaries
- Keep messaging aligned with V1 truth: Zerodha-first, Tally-focused, no over-claims

Output:
- Deliverables listed in [TASK_FILE].md
- Handoff note: what changed, what remains, risks/assumptions, files touched
```
