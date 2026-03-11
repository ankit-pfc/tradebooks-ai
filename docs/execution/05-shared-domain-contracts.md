# 05 — Shared Domain Contracts

## Goal
Define shared data contracts used by UI, API, and persistence so all modules speak the same language.

## Why this matters
- Prevents integration drift across app routes and API endpoints.
- Reduces refactor churn during backend wiring.

## In scope
- Define `Batch`, `BatchStatus`, file metadata, process result, export artifact, and exception shapes.
- Align naming conventions across upload, dashboard, batches, exceptions, and API responses.
- Document versioning/ownership expectations for shared types.

## Out of scope
- Full schema migration implementation (covered by Supabase module).

## Dependencies
- Upstream modules: none (foundational)
- Blocking decisions: status taxonomy and minimum exception fields

## Likely files to touch
- `src/lib/types/*`
- `src/lib/engine/*`
- `src/app/(app)/*`
- `src/app/api/*`

## Task breakdown
1. Inventory existing types and identify gaps.
2. Define canonical contract interfaces/enums.
3. Update consuming modules to use shared contracts.
4. Document contract usage notes in this module file.

## Acceptance criteria
- [ ] Shared batch/status/exception contracts exist and are reusable.
- [ ] UI and API reference consistent status names.
- [ ] No duplicate ad-hoc type shapes for the same entities.

## Validation steps
- `npm run test`
- Manual checks:
  - Confirm route-level status chips and API response statuses match naming.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should contracts include explicit version fields for future API evolution?
