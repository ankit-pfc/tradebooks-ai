# 06 — Supabase Foundation

## Goal
Set up Supabase auth/database/storage foundations required for persisted, multi-user V1 workflows.

## Why this matters
- Backend APIs and protected routes depend on consistent persistence and auth primitives.
- Hosting readiness is blocked without environment + schema setup.

## In scope
- Configure Supabase clients for server and browser usage.
- Define initial schema for users/workspaces/batches/files/exceptions/exports.
- Define storage buckets for uploads and generated artifacts.
- Document environment variable contract.

## Out of scope
- Advanced tenancy/role hierarchies beyond V1 needs.

## Dependencies
- Upstream modules: `05-shared-domain-contracts.md`
- Blocking decisions: table naming and tenancy model

## Likely files to touch
- `src/lib/db/*`
- `src/lib/types/*`
- `.env.example` (new)
- `README.md` (env/setup updates)

## Task breakdown
1. Add Supabase client setup utilities.
2. Define schema and migration process.
3. Configure storage bucket conventions.
4. Document local + production env requirements.

## Acceptance criteria
- [ ] Supabase clients are usable in local development.
- [ ] V1 tables cover batches, files, processing state, exceptions, exports.
- [ ] Environment setup instructions are documented.

## Validation steps
- Manual checks:
  - Create/read a test batch record from local app context.
  - Upload a sample file to configured storage bucket.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Single workspace per user in V1, or support multiple workspaces immediately?
