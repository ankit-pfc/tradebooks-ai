# 03 — Auth + Protected Routes

## Goal
Implement login/signup flows and protect app routes so only authenticated users can access product functionality.

## Why this matters
- Required for tenant-safe access to uploads, batches, and exports.
- Blocks production launch if missing.

## In scope
- Add `/login` and `/signup` routes.
- Implement auth session handling with Supabase.
- Protect `(app)` route group.
- Define unauthenticated redirect behavior.

## Out of scope
- Advanced RBAC/permissions matrix.
- Enterprise SSO.

## Dependencies
- Upstream modules: `06-supabase-foundation.md`
- Blocking decisions: auth UX details (magic link vs email/password)

## Likely files to touch
- `src/app/login/page.tsx` (new)
- `src/app/signup/page.tsx` (new)
- `src/app/(app)/layout.tsx`
- `src/lib/db/*`

## Task breakdown
1. Set up Supabase auth client/server integration.
2. Build login and signup pages.
3. Add route protection for `(app)` pages.
4. Add sign-out and session-expiry handling.

## Acceptance criteria
- [ ] Unauthenticated users cannot access app routes.
- [ ] Login/signup routes work in local environment.
- [ ] Auth redirects behave consistently.

## Validation steps
- Manual checks:
  - Attempt access to `/dashboard` without auth.
  - Login then access `/upload`, `/batches`, `/exceptions`.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should V1 use email/password only or include OTP/magic links?
