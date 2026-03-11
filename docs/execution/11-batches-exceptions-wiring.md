# 11 — Batches + Exceptions Wiring

## Goal
Connect `/batches` and `/exceptions` pages to persisted backend data and status models.

## Why this matters
- Makes post-processing outputs operationally usable.
- Gives users visibility into history, failures, and reconciliation issues.

## In scope
- Fetch and render batch history records.
- Fetch and render reconciliation exception records.
- Align dashboard summaries with same data model.
- Add consistent empty/loading/error views.

## Out of scope
- Advanced manual resolution workflows for exceptions.
- Rich batch drilldown UX beyond V1 essentials.

## Dependencies
- Upstream modules: `04-app-shell-routes.md`, `05-shared-domain-contracts.md`, `08-api-process-pipeline.md`
- Blocking decisions: API response shape for paginated history

## Likely files to touch
- `src/app/(app)/batches/page.tsx`
- `src/app/(app)/exceptions/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/lib/types/*`

## Task breakdown
1. Implement batch history query and rendering.
2. Implement exceptions query and rendering.
3. Align status badges and severity display conventions.
4. Add resilient empty/error/retry states.

## Acceptance criteria
- [ ] `/batches` shows persisted batch list with statuses.
- [ ] `/exceptions` shows persisted reconciliation issues.
- [ ] Dashboard summary metrics align with same backend data source.

## Validation steps
- Manual checks:
  - Create sample batches and verify list ordering/status updates.
  - Confirm exception severities render correctly.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Is pagination needed for V1 or can we ship capped recent-history first?
