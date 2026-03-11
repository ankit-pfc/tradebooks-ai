# 08 — API Process Pipeline

## Goal
Implement `/api/process` orchestration that converts uploaded files into canonical events, vouchers, reconciliation output, and persisted batch status.

## Why this matters
- This is the core value path from uploaded broker data to accounting artifacts.
- Upload and export modules depend on reliable processing state transitions.

## In scope
- Batch-level processing trigger endpoint.
- Parser execution and canonical event generation.
- Cost basis + voucher builder pipeline execution.
- Reconciliation execution and exception capture.
- Persisted processing status and error handling.

## Out of scope
- Complex background job infra beyond V1 needs.
- Advanced user-driven exception resolution UX.

## Dependencies
- Upstream modules: `05-shared-domain-contracts.md`, `06-supabase-foundation.md`, `07-api-upload.md`
- Blocking decisions: synchronous vs async processing model and status polling approach

## Likely files to touch
- `src/app/api/process/route.ts` (new)
- `src/lib/parsers/*`
- `src/lib/engine/*`
- `src/lib/reconciliation/*`
- `src/lib/types/*`
- `src/lib/db/*`

## Task breakdown
1. Define process trigger input/output schema.
2. Load uploaded files for batch and detect file classes.
3. Execute parser -> canonical -> policy/cost basis -> voucher pipeline.
4. Run reconciliation and persist exception records.
5. Persist process state transitions and final outputs/errors.

## Acceptance criteria
- [ ] A valid batch can be processed end-to-end through real backend modules.
- [ ] Processing states are persisted (`queued/running/succeeded/failed/needs_review`).
- [ ] Failures are captured with actionable error metadata.

## Validation steps
- `npm run test`
- Manual checks:
  - Trigger processing for sample batch and verify status transitions.
  - Confirm reconciliation exceptions are persisted and queryable.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should V1 process inline in request lifecycle or via queued worker pattern?
