# 07 — API Upload

## Goal
Implement `/api/upload` to accept files and import metadata, validate inputs, persist batch context, and store raw uploads.

## Why this matters
- This is the first backend step replacing frontend simulation.
- Downstream processing depends on reliable batch + file intake.

## In scope
- Multipart upload endpoint for import payload.
- Validation of required files (at least tradebook).
- File type detection + metadata capture.
- Batch creation and file storage bookkeeping.

## Out of scope
- Actual parsing/processing logic execution.

## Dependencies
- Upstream modules: `05-shared-domain-contracts.md`, `06-supabase-foundation.md`
- Blocking decisions: upload size limits and accepted MIME/extension policies

## Likely files to touch
- `src/app/api/upload/route.ts` (new)
- `src/lib/parsers/detect.ts`
- `src/lib/types/*`
- `src/lib/db/*`

## Task breakdown
1. Define request schema and validation strategy.
2. Implement multipart ingestion and file classification.
3. Persist batch + uploaded file metadata.
4. Store raw files in configured storage backend.
5. Return stable API response with batch id and file summary.

## Acceptance criteria
- [ ] Upload endpoint accepts valid payloads and rejects invalid ones with clear errors.
- [ ] Batch and file metadata records are created.
- [ ] At least one tradebook file is enforced as required input.

## Validation steps
- Manual checks:
  - Send valid and invalid multipart requests.
  - Verify stored files and DB metadata integrity.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should duplicate filenames in one batch be rejected or auto-renamed?
