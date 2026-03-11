# 09 — API Export

## Goal
Implement `/api/export` to generate and return downloadable artifacts from processed batches.

## Why this matters
- Export output is the user-visible end result of processing.
- Functional V1 is not complete without reliable download flow.

## In scope
- Generate Tally XML from processed results.
- Support separate artifact types (masters, transactions, reconciliation report).
- Persist export metadata and storage locations.
- Return secure download links or streamed responses.

## Out of scope
- Deep export customization profiles beyond baseline settings.

## Dependencies
- Upstream modules: `05-shared-domain-contracts.md`, `06-supabase-foundation.md`, `08-api-process-pipeline.md`
- Blocking decisions: artifact packaging strategy (single XML vs multi-file bundle)

## Likely files to touch
- `src/app/api/export/route.ts` (new)
- `src/lib/export/*`
- `src/lib/types/*`
- `src/lib/db/*`

## Task breakdown
1. Define export request/response contract.
2. Build XML generation pipeline from processed batch outputs.
3. Store generated artifacts and persist metadata.
4. Implement secure artifact delivery endpoint behavior.

## Acceptance criteria
- [ ] Processed batches can produce downloadable export artifacts.
- [ ] Export metadata is persisted with traceable links.
- [ ] Export errors are surfaced with clear diagnostics.

## Validation steps
- `npm run test`
- Manual checks:
  - Trigger export for a processed sample batch.
  - Validate XML opens and appears structurally correct.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Is ZIP packaging required in V1 or can we ship separate files first?
