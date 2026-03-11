# Measurement & Operations (Validation-First Search Growth)

Use this reference to move from “implemented” to “proven.”

## 1) Status Model

Track every initiative at three levels:

1. **Implemented** — built in code/content
2. **Validated** — confirmed by external systems (GSC/GA4/indexing providers)
3. **Successful** — measurable growth outcome (impressions, clicks, conversions)

## 2) Minimum Validation Stack

### GSC Validation
- Group URLs by template/cluster
- Track indexed vs submitted
- Record impressions, clicks, CTR, and average position
- Inspect representative sample URLs per template type

### GA4 Validation
- Confirm key events in DebugView and standard reports
- Mark core outcomes as conversions where applicable
- Verify attribution from organic landing pages to downstream actions

### Indexing Validation
- Confirm publish → submission flow is operational
- Capture provider submission responses
- Track publish-to-first-impression latency

## 3) KPI Snapshot (Monthly)

Recommended baseline table:

| Metric | Direction | Notes |
|---|---|---|
| Organic sessions | Up | Overall search growth |
| Indexed pages | Up | Coverage health |
| Avg CTR | Up | Snippet relevance quality |
| Keywords in top 10 | Up | Ranking progress |
| Organic-to-conversion rate | Up | Business impact |
| Publish-to-impression time | Down | Discovery speed |

## 4) Recurring Cadence

### Weekly
- Publish/refine priority pages
- Ensure metadata/schema/internal links are complete
- Submit URLs for indexing
- Review top organic landing pages and immediate refresh candidates

### Monthly
- Refresh low-CTR or page-2 opportunities
- Reconcile sitemap coverage vs indexed coverage
- Update KPI snapshot and compare MoM movement

### Quarterly
- Reprioritize clusters/templates based on evidence
- Expand only families with indexation + impression proof
- Retire low-leverage activities

## 5) Failure Patterns to Watch

- New pages published but not submitted/indexed quickly
- Strong implementation but no non-homepage visibility
- Events instrumented in code but absent in GA4 reports
- pSEO volume growth without template-level evidence

## 6) Operating Principle

> Build enough to learn, validate enough to decide, and scale only what proves signal.
