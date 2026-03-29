# TradeBooks AI — Multi-Agent Execution Guide

This file is the canonical high-level context for all agents working in this repo.

## 1) Product summary
- TradeBooks AI converts broker exports (currently Zerodha-first) into Tally-importable outputs.
- Current codebase has:
  - polished marketing shell (`src/app/(marketing)`)
  - app shell (`src/app/(app)`)
  - parser/engine/export foundations in `src/lib`
  - initial Vitest coverage for core parser/pipeline paths
- Current priority is moving from demo shell to usable V1.

## 2) V1 scope line
### In scope
- Zerodha tradebook-led pipeline
- Optional funds statement + holdings ingestion
- Real upload -> process -> export flow
- Tally XML export artifacts
- Batch history + exceptions listing
- Auth + persistence + storage

### Explicitly deferred unless nearly ready
- Multi-broker support
- Advanced exception resolution workflows
- Heavy collaboration/team controls
- Deep analytics/reporting

## 3) Current status snapshot
### Done
- Marketing page and layout exist
- Upload UI exists (currently simulated processing)
- Engine modules exist (canonical events, policy, cost basis, voucher builder)
- Export foundations exist (Tally XML helpers)

### Not done
- API routes not fully wired (`/api/upload`, `/api/process`, `/api/export`)
- Real UI-to-backend pipeline not connected
- Supabase auth/db/storage not wired
- Batch/exceptions/settings pages not fully implemented
- Production lint quality not fully clean

## 4) Execution phases
1. Landing Page
2. App Routes
3. Backend Wiring
4. Hosting Setup

Module-level plans live in `docs/execution/*.md`.

## 5) Agent operating model (low-context)
For any assigned task, read only:
1. `AGENTS.md`
2. your assigned module file in `docs/execution`
3. code files listed in that module’s “Likely files to touch” section

Do not widen scope unless dependency/handoff notes require it.

## 5a) Agent coding guardrails

These guardrails apply to every agent working in this repo. They exist because the unit of work has shifted from “write a function” to “own a feature end-to-end.” Vague prompts and unverified assumptions are now the primary failure mode.

### G1 — Tests first, always
Before writing any implementation code, write a complete test suite that defines exact behavior (valid inputs, edge cases, error paths, cross-cutting concerns). Only then implement the feature. Tests are the specification. If the behavior is not tested, it is not specified.

### G2 — Architecture review before code
For any task that introduces a new module, API route, data model, or cross-cutting concern: output a brief `plan.md` (≤1 page) describing the approach, key decisions, and alternatives rejected. Do not proceed to implementation until that plan is confirmed (either by a human reviewer or by explicit self-approval with reasoning recorded).

### G3 — Explicit trust-model and constraint awareness
Before adding any security, encryption, validation, or infrastructure mechanism, state the exact threat model it defends against. Do not add a security control unless it meaningfully addresses a real threat in this system’s trust model. Avoid security theater (e.g., encrypting data that is already protected by the transport layer).

### G4 — Post-implementation self-review
After completing a task, run a self-review answering:
- What assumptions did I make that were not explicitly stated?
- Where could this implementation be wrong?
- What edge cases or failure modes are not covered by the current tests?
- Does anything I added conflict with the existing architecture?

Record the answers in the module’s **Handoff notes** before marking the task complete.

### G5 — Human-in-the-loop for high-risk changes
If a change touches any of the following areas, pause and surface a summary to the human reviewer before finalizing:
- Auth flows or session management
- Supabase RLS policies or database migrations
- File storage access control
- Export correctness (Tally XML structure / voucher math)
- Any third-party API key or secret handling

The summary must state: what changed, why, and what breaks if the change is wrong.

### G6 — Context detection: greenfield vs legacy
At the start of each task, declare which mode applies:
- **Greenfield** — new module with no existing callers. Move fast; the main risk is wrong spec.
- **Legacy/wiring** — touching existing code with live callers or downstream dependents. Surface migration risks immediately; prefer additive changes over in-place rewrites.

This declaration must appear in the module’s **Handoff notes**.

## 6) Global engineering rules
- Prefer incremental, testable steps over broad refactors.
- Do not claim features as done unless wired end-to-end.
- Keep shared status/contract names consistent across UI + API.
- Avoid introducing `any` in new code.
- If scope shifts, update corresponding module docs and handoff notes.

## 7) V1 success criteria
- User can authenticate
- User can upload valid Zerodha files
- Batch is processed by real backend pipeline
- User can download XML output
- User can see persisted batch history and exceptions
- `npm run build` and `npm run test` pass
- App deploys on Vercel with working Supabase integration

## 8) Module dependency order
### Parallel-safe early modules
- `01-marketing-shell.md`
- `02-public-pages-seo.md`
- `04-app-shell-routes.md`
- `05-shared-domain-contracts.md`
- `06-supabase-foundation.md`

### Start after contracts/foundation clarity
- `03-auth-and-protected-routes.md`
- `07-api-upload.md`
- `08-api-process-pipeline.md`
- `09-api-export.md`

### Start after backend routes exist
- `10-upload-ui-integration.md`
- `11-batches-exceptions-wiring.md`

### Final hardening
- `12-quality-gates.md`
- `13-hosting-release.md`

## 9) Suggested milestone framing
- M1: Public launch shell (marketing + legal + pricing)
- M2: Route-complete app shell
- M3: Functional V1 (real processing + export)
- M4: Hosted beta (deploy + observability + smoke checks)

## 10) Decision log
- Canonical high-level guide = `AGENTS.md`
- `CLAUDE.md` is retained as a pointer for tool compatibility
- Execution plans split by module in `docs/execution`
