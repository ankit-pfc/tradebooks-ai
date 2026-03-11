# 13 — Hosting + Release

## Goal
Deploy a stable hosted beta on Vercel with Supabase-backed auth/storage/database and a repeatable release checklist.

## Why this matters
- Converts local functionality into a real user-accessible product.
- Reduces launch risk with explicit smoke tests and environment controls.

## In scope
- Configure Vercel project and environment variables.
- Configure Supabase production settings (auth redirects, storage, db access).
- Define deployment smoke tests for auth/upload/process/export.
- Add domain/analytics/basic monitoring readiness checklist.

## Out of scope
- Full SRE-grade observability stack.
- Multi-region or enterprise deployment topology.

## Dependencies
- Upstream modules: `03-auth-and-protected-routes.md`, `06-supabase-foundation.md`, `10-upload-ui-integration.md`, `12-quality-gates.md`
- Blocking decisions: production domain and analytics provider selection

## Likely files to touch
- `README.md`
- `next.config.ts`
- Vercel project settings (external)
- Supabase project settings (external)

## Task breakdown
1. Set production env var matrix and secure secrets handling.
2. Configure Supabase auth redirects and storage permissions.
3. Create deployment + post-deploy smoke-test checklist.
4. Configure custom domain, analytics, and baseline monitoring.

## Acceptance criteria
- [ ] Production deployment succeeds with required env vars.
- [ ] Hosted auth flow works end-to-end.
- [ ] Hosted upload -> process -> export flow is smoke-tested.
- [ ] Release checklist is documented and reusable.

## Validation steps
- `npm run build`
- Manual checks on deployed environment:
  - Login/signup
  - Upload sample batch
  - Process batch
  - Download export artifact

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should we perform a marketing-only deploy immediately while backend V1 hardening continues?
