# 12 — Quality Gates

## Goal
Bring the codebase to a safe beta quality baseline with passing build/tests and controlled lint debt.

## Why this matters
- Production confidence requires predictable CI-local parity.
- Current lint debt can hide regressions in critical flows.

## In scope
- Resolve critical lint issues affecting core paths.
- Prioritize removal of unsafe `any` usage in reconciliation and API flow.
- Expand tests for high-risk parser/engine/export paths.
- Define minimum pre-release verification checklist.

## Out of scope
- Perfect lint cleanliness in non-critical, low-risk areas.
- Exhaustive test matrix for every edge case before beta.

## Dependencies
- Upstream modules: `08-api-process-pipeline.md`, `09-api-export.md`, `10-upload-ui-integration.md`
- Blocking decisions: acceptable temporary lint exceptions (if any)

## Likely files to touch
- `eslint.config.mjs`
- `src/lib/reconciliation/*`
- `src/tests/parsers/*`
- `src/tests/engine/*`
- `src/tests/export/*` (new)

## Task breakdown
1. Run lint/build/tests and categorize failures by severity.
2. Fix critical lint/type issues in processing/export/reconciliation paths.
3. Add missing tests for funds statement, holdings, and export validity.
4. Document quality gate commands and release thresholds.

## Acceptance criteria
- [ ] `npm run build` passes.
- [ ] `npm run test` passes with expanded high-risk coverage.
- [ ] Critical lint issues in V1-critical paths are fixed or explicitly documented.

## Validation steps
- `npm run lint`
- `npm run test`
- `npm run build`

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should CI block on full lint clean, or allow scoped temporary exceptions for non-critical modules?
