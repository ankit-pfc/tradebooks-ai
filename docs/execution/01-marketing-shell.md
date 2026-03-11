# 01 — Marketing Shell

## Goal
Make the public landing experience accurate, consistent, and free of dead-end navigation.

## Why this matters
- First impression and trust layer for early users.
- Prevents misleading product expectations before backend wiring is complete.

## In scope
- Align navbar/footer links with implemented pages.
- Ensure CTA language matches real product readiness.
- Keep landing claims Zerodha-first and V1-accurate.

## Out of scope
- Full SEO program and long-form content strategy.
- Multi-broker positioning copy.

## Dependencies
- Upstream modules: none
- Blocking decisions: whether `#pricing` remains anchor vs separate route

## Likely files to touch
- `src/app/(marketing)/layout.tsx`
- `src/app/(marketing)/page.tsx`

## Task breakdown
1. Audit all links in marketing layout/footer.
2. Update labels/targets to match route reality.
3. Tighten hero/feature/CTA messaging against actual V1 scope.
4. Add explicit “coming soon” tags where needed.

## Acceptance criteria
- [ ] No marketing nav/footer links point to non-existent routes without clear placeholder intent.
- [ ] Landing claims do not overstate current backend readiness.
- [ ] CTA hierarchy is consistent across navbar, hero, and footer.

## Validation steps
- Manual checks:
  - Load `/` and click every marketing nav/footer link.
  - Verify mobile and desktop nav consistency.

## Handoff notes
- What changed:
- What remains:
- Risks/assumptions:

## Open questions
- Should pricing remain section-based for now or move to `/pricing` immediately?
