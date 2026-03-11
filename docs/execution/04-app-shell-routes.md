# 04 — App Shell Routes

## Goal
Complete core app route pages so dashboard/upload/batches/exceptions/settings form a coherent product surface.

## Why this matters
- Removes placeholder navigation gaps.
- Prepares UI for backend data wiring with minimal rework.

## In scope
- Implement `/batches`, `/exceptions`, `/settings` route pages.
- Standardize empty/loading/error states.
- Align route-level status language.

## Out of scope
- Full data wiring (handled in backend/UI integration modules).
- Advanced detail drilldowns like `/batches/[id]` beyond scaffold.

## Dependencies
- Upstream modules: `05-shared-domain-contracts.md`
- Blocking decisions: status taxonomy and page-level information architecture

## Likely files to touch
- `src/app/(app)/batches/page.tsx` (new)
- `src/app/(app)/exceptions/page.tsx` (new)
- `src/app/(app)/settings/page.tsx` (new)
- `src/app/(app)/dashboard/page.tsx`

## Task breakdown
1. Add missing route page files for batches/exceptions/settings.
2. Implement consistent “no data yet” and “loading” states.
3. Align dashboard quick links and statuses with app routes.
4. Add TODO markers where backend data will be bound later.

## Acceptance criteria
- [x] All app nav links resolve to implemented pages.
- [x] No route appears as incomplete placeholder folder only.
- [x] UI status terms are consistent across app routes.

## Validation steps
- Manual checks:
  - Open `/dashboard`, `/upload`, `/batches`, `/exceptions`, `/settings`.
  - Confirm no missing-page errors.

## Handoff notes
- What changed:
  - Added concrete route pages for `/batches`, `/exceptions`, and `/settings`.
  - Added consistent empty-state messaging and TODO markers for backend binding.
  - Aligned status/severity vocabulary in route UIs with shared domain contracts (`queued/running/succeeded/failed/needs_review`, `error/warning/info`).
  - Updated `/dashboard` route actions to point to working app routes and removed unsupported `asChild` usage.
- What remains:
  - Wire pages to persisted backend data in modules `10` and `11`.
  - Optional future scaffold for `/batches/[id]` when persistence details are finalized.
- Risks/assumptions:
  - Current pages intentionally use static placeholders; data states may evolve once real APIs are integrated.

## Open questions
- Should `/batches/[id]` be scaffolded now or deferred until persistence is live?
