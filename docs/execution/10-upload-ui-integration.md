# 10 — Upload UI Integration

## Goal
Replace `/upload` simulation with real backend-driven upload/process/export flow.

## Why this matters
- Current upload experience is visually polished but functionally simulated.
- This module converts demo UX into product UX.

## In scope
- Connect file upload form to `/api/upload`.
- Trigger processing via `/api/process`.
- Display real progress/status and error states.
- Wire result downloads to `/api/export`.

## Out of scope
- Advanced real-time streaming/status websockets unless required.

## Dependencies
- Upstream modules: `07-api-upload.md`, `08-api-process-pipeline.md`, `09-api-export.md`
- Blocking decisions: polling interval and UX for long-running batches

## Likely files to touch
- `src/app/(app)/upload/page.tsx`
- `src/components/upload/*`
- `src/lib/types/*`

## Task breakdown
1. Replace simulated timers with API calls.
2. Persist and reuse batch id through upload/process steps.
3. Add status polling or equivalent refresh mechanism.
4. Bind result cards/download buttons to real artifacts.
5. Add robust error and retry UX.

## Acceptance criteria
- [ ] `/upload` uses real API routes end-to-end.
- [ ] Processing step indicators reflect backend status, not timers.
- [ ] Download actions return real generated files.

## Validation steps
- Manual checks:
  - Run a full upload -> process -> download cycle.
  - Verify failures show meaningful user-facing errors.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should user remain on upload page during processing, or redirect to batch detail page later?
