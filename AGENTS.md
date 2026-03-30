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

## 10) Repository hygiene rules
These apply to every commit, by every agent and contributor. Violations must be fixed before merging.

### Never commit
- `temp_cache/`, `node_modules/`, `.next/`, `out/`, `dist/`, `build/` — generated/cached output
- `.env`, `.env.local`, `.env*` — secrets and environment config
- `*.pem`, `tradebooks-ai-*.json` — credentials
- `.DS_Store`, `*.tsbuildinfo`, `next-env.d.ts` — OS and tooling noise
- Any file >500KB that is not a production image asset

### Images in `public/`
- Use WebP for all photographic/hero images (not SVG/icons)
- PNG allowed for logos and icons only, must be under 300KB
- Do not commit raw design exports or high-res source files

### Before every commit
```bash
npm run build   # must pass
npm run lint    # must pass
npm run test:run  # must pass
```

## 11) Decision log
- Canonical high-level guide = `AGENTS.md`
- `CLAUDE.md` is retained as a pointer for tool compatibility
- Execution plans split by module in `docs/execution`
