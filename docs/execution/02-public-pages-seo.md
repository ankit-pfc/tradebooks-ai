# 02 — Public Pages + SEO Baseline

## Goal
Create launch-critical public pages and baseline metadata so marketing links, legal trust, and indexing readiness are in place.

## Why this matters
- Public/legal completeness reduces friction for onboarding.
- Prevents broken links from nav/footer CTA paths.

## In scope
- Add `/pricing`, `/privacy`, `/terms`.
- Optionally add `/how-it-works` as standalone route.
- Add metadata/title/description for public pages.

## Out of scope
- Full SEO content program (blogs, deep keyword strategy).
- Long-form CMS workflow.

## Dependencies
- Upstream modules: `01-marketing-shell.md`
- Blocking decisions: route structure for pricing/how-it-works

## Likely files to touch
- `src/app/(marketing)/layout.tsx`
- `src/app/(marketing)/page.tsx`
- `src/app/pricing/page.tsx` (new)
- `src/app/privacy/page.tsx` (new)
- `src/app/terms/page.tsx` (new)

## Task breakdown
1. Create missing public route pages.
2. Add metadata for each page.
3. Update layout links to point to implemented routes.
4. Verify footer legal links and page rendering.

## Acceptance criteria
- [ ] `/pricing`, `/privacy`, and `/terms` render successfully.
- [ ] Public links do not 404.
- [ ] Metadata exists for each public page.

## Validation steps
- Manual checks:
  - Open each route directly and from navbar/footer.
  - Confirm metadata appears in page source.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Is `/how-it-works` route required in V1 or enough as an anchor section?
