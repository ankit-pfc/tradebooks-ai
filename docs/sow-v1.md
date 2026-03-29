# Statement of Work — TradeBooks AI V1

**Version:** 1.0
**Date:** 20 March 2026
**Prepared by:** [YOUR NAME / COMPANY]
**Prepared for:** [CLIENT NAME]
**Document status:** Draft

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Scope of Work](#2-scope-of-work)
3. [Out of Scope](#3-out-of-scope)
4. [Milestones & Delivery Timeline](#4-milestones--delivery-timeline)
5. [Acceptance Criteria](#5-acceptance-criteria)
6. [Assumptions & Dependencies](#6-assumptions--dependencies)
7. [Risks & Mitigations](#7-risks--mitigations)
8. [Commercial Terms](#8-commercial-terms)
9. [Appendices](#9-appendices)

---

## 1. Project Overview

### 1.1 Product Description

TradeBooks AI is a web application that converts Zerodha broker exports (tradebook CSV, funds statement, holdings report) into Tally-importable XML files. The product targets Indian chartered accountant (CA) firms, accounting teams, and active traders who currently perform this reconciliation manually.

### 1.2 Business Objective

Deliver a functional V1 that allows authenticated users to:

- Upload Zerodha export files
- Process them through a real backend pipeline (parsing, event normalization, cost basis calculation, voucher generation, reconciliation)
- Download Tally-compatible XML output
- View persisted batch history and flagged exceptions

### 1.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16, React 19, TypeScript 5 |
| Styling | Tailwind CSS 4, shadcn/ui components |
| Auth / DB / Storage | Supabase (PostgreSQL + Auth + Storage) |
| State Management | Zustand |
| Form Validation | React Hook Form + Zod |
| CSV Parsing | PapaParse |
| XML Generation | xmlbuilder2, fast-xml-parser |
| Monetary Arithmetic | Decimal.js |
| Testing | Vitest |
| Hosting | Vercel (application), Railway (marketing site) |

### 1.4 Current State

**Completed:**

- Marketing/landing page live on Railway (homepage, pricing, privacy, terms)
- App shell routes implemented (`/dashboard`, `/upload`, `/batches`, `/exceptions`, `/settings`)
- Upload UI with 4-step workflow (currently client-side simulation only)
- Core engine modules: canonical event normalization, accounting policy (investor/trader), FIFO cost basis tracking, Tally voucher builder
- Zerodha parsers: tradebook, funds statement, holdings, file type detection
- Export modules: Tally XML generation, ledger masters, import manifest
- Reconciliation: validation checks, exception builders
- Domain type contracts across 8 type files
- Test infrastructure with Vitest

**Pending (scope of this engagement):**

- API route handlers (`/api/upload`, `/api/process`, `/api/export`)
- Supabase integration (auth, database, file storage)
- Authentication pages and session management
- UI-to-backend wiring (replace simulation with real pipeline)
- Batch/exceptions pages connected to persisted data
- Quality gates (lint, test coverage, build stability)
- Production deployment on Vercel

---

## 2. Scope of Work

Work is organized into 13 modules across 4 phases. Modules within each phase can be executed in parallel by different developers.

### Phase 1: Foundation

#### Module 01 — Marketing Shell Polish
- Audit and fix all navbar/footer navigation links
- Align CTA copy with actual V1 feature availability
- Ensure responsive behavior across mobile/tablet/desktop
- **Status:** 90% complete. Light QA pass remaining.

#### Module 02 — Public Pages & SEO Baseline
- Add page-level metadata (title, description, Open Graph tags) to `/pricing`, `/privacy`, `/terms`
- Verify no 404s from any navigation path
- Add canonical URLs and basic structured data
- **Status:** Pages exist. Metadata pass remaining.

#### Module 04 — App Shell Routes
- Validate all app routes render correctly with placeholder states
- Standardize loading, empty, and error state patterns across all routes
- Align status vocabulary (batch statuses, exception severities) between UI components
- **Status:** Routes exist. Validation and consistency pass remaining.

#### Module 05 — Shared Domain Contracts
- Audit existing types in `src/lib/types/` for completeness against API requirements
- Define/finalize canonical interfaces: `Batch`, `BatchStatus`, `BatchFileMeta`, `BatchException`, `ExportArtifact`
- Ensure UI and API modules import from a single source of truth
- Eliminate duplicate or ad-hoc type definitions
- **Deliverable:** Complete, API-ready type contracts importable by all modules.

#### Module 06 — Supabase Foundation
- Install `@supabase/supabase-js` and `@supabase/ssr`
- Create server-side and browser-side Supabase client utilities
- Design and implement database schema:
  - `users` — profile and plan tier
  - `batches` — batch metadata, status, accounting mode, period
  - `batch_files` — uploaded file references, detected types
  - `processing_results` — voucher and event output (JSONB)
  - `exceptions` — reconciliation issues with severity and source references
  - `exports` — generated artifact metadata and storage paths
- Configure Supabase storage buckets: `uploads` (raw files), `exports` (generated XML)
- Create Row-Level Security (RLS) policies for user-scoped data isolation
- Create `.env.example` documenting all required environment variables
- **Deliverable:** Working Supabase development environment with schema, storage, and RLS.

### Phase 2: Backend Wiring

#### Module 03 — Auth & Protected Routes
- Build `/login` and `/signup` pages with Supabase Auth (email/password)
- Implement server-side session handling via `@supabase/ssr` cookie strategy
- Protect `(app)` route group with middleware-level auth checks
- Implement sign-out flow and session expiry redirect
- Add auth state context for client-side components
- **Deliverable:** Working auth flow — unauthenticated users cannot access app routes.

#### Module 07 — API Upload (`POST /api/upload`)
- Implement multipart form data handler
- Accept tradebook CSV (required), optional funds statement, optional holdings
- Validate file types, sizes (max 10MB per file), and required file presence
- Run Zerodha file type detection on each upload
- Create `batch` record in Supabase with status `queued`
- Store raw files in Supabase `uploads` bucket
- Create `batch_files` records with detected types
- Return batch ID, file summary, and detected types in response
- **Deliverable:** Working upload endpoint that persists files and creates batch records.

#### Module 08 — API Process Pipeline (`POST /api/process`)
- Accept batch ID, verify ownership, retrieve stored files
- Execute full processing pipeline:
  1. Zerodha CSV parsing (tradebook, funds, holdings)
  2. Canonical event generation
  3. Accounting policy application (investor vs. trader mode)
  4. FIFO cost basis calculation
  5. Tally voucher generation
  6. Reconciliation checks
- Persist processing output (vouchers, events) to `processing_results`
- Persist exceptions to `exceptions` table
- Update batch status: `queued` → `running` → `succeeded` | `failed` | `needs_review`
- V1: synchronous processing within request lifecycle (no background workers)
- **Deliverable:** End-to-end pipeline that processes real Zerodha files and persists results.

#### Module 09 — API Export (`GET /api/export`)
- Accept batch ID and optional artifact type filter
- Generate Tally XML (masters + transactions) from persisted processing results
- Generate reconciliation summary (JSON)
- Generate import manifest with checksums and voucher counts
- Store generated artifacts in Supabase `exports` bucket
- Persist export metadata record
- Return secure download URL or stream file in response
- **Deliverable:** Working export endpoint that produces downloadable Tally XML.

### Phase 3: UI Integration

#### Module 10 — Upload UI Integration
- Replace all simulated processing in `/upload` with real API calls
- Step 1 (Configure): Wire accounting mode and period selection
- Step 2 (Upload): Send files to `POST /api/upload`, display detected file types
- Step 3 (Process): Call `POST /api/process`, poll for status updates, show real progress
- Step 4 (Results): Fetch from `GET /api/export`, enable real XML download
- Handle error states: network failure, upload rejection, processing failure, timeout
- Show exception summary before download when batch status is `needs_review`
- **Deliverable:** Complete upload-to-download flow through real backend.

#### Module 11 — Batches & Exceptions Wiring
- Connect `/batches` page to fetch batch history from Supabase
- Display batch list with status badges, timestamps, file counts
- Connect `/exceptions` page to fetch reconciliation exceptions
- Display exceptions with severity indicators, source references, affected rows
- Wire `/dashboard` summary cards to real aggregate data (batch count, exception count, recent activity)
- Implement pagination for batch and exception lists
- Standardize loading, empty, and error states
- **Deliverable:** All app pages displaying real persisted data.

### Phase 4: Hardening & Release

#### Module 12 — Quality Gates
- Resolve all critical lint errors in processing/export/reconciliation paths
- Remove unsafe `any` usage in V1-critical code paths
- Expand test coverage:
  - Parser edge cases (malformed CSV, missing columns, empty files)
  - Engine pipeline integration tests
  - Export XML structural validation
  - API route handler tests (success + error paths)
- Ensure `npm run build` passes without errors
- Ensure `npm run test` passes with meaningful coverage
- **Deliverable:** Clean build, passing tests, documented quality thresholds.

#### Module 13 — Hosting & Release
- Configure Vercel project with production environment variables
- Configure Supabase production project:
  - Auth redirect URLs for production domain
  - Storage bucket policies
  - RLS policies verified in production
- Execute deployment smoke tests:
  - Signup → Login → Upload → Process → Download → View History
- Configure custom domain (if available)
- Add basic analytics (Vercel Analytics or equivalent)
- Document release checklist for repeatable deployments
- **Deliverable:** Live, accessible V1 beta on production URL.

---

## 3. Out of Scope

The following are explicitly excluded from this engagement:

| Item | Rationale |
|------|-----------|
| Multi-broker support (Groww, Angel One, etc.) | V1 validates pipeline with Zerodha only |
| Advanced exception resolution workflows | V1 displays exceptions; resolution is manual |
| Team collaboration & role-based access | V1 targets individual users |
| Analytics & reporting dashboards | V1 focuses on core upload-process-export loop |
| Background job queue (Redis, BullMQ) | V1 uses synchronous processing |
| Payment integration (Stripe/Razorpay) | Pro tier is manually assigned during beta |
| Enterprise SSO (SAML, OpenID Connect) | Not required for target audience |
| Mobile-native application | Responsive web only |
| Batch ZIP packaging for export | Individual file downloads in V1 |
| Webhook/API integrations with Tally | Manual download workflow in V1 |
| CI/CD pipeline automation | Manual Git-push deployments in V1 |
| Content marketing (blog, SEO articles) | Basic page metadata only |

---

## 4. Milestones & Delivery Timeline

**Start date:** 23 March 2026
**Team:** 3+ developers working in parallel
**Total duration:** 4 calendar weeks

### Timeline Overview

```
Week 1 (Mar 23-28)  │  M1: Foundation
                     │  All Phase 1 modules in parallel (3 devs)
                     │  Phase 2 modules begin mid-week as contracts stabilize
─────────────────────┤
Week 2 (Mar 30-Apr 4)│  M2: Backend APIs Complete
                     │  Auth, Upload, Process, Export APIs — parallel across devs
                     │  Integration testing begins
─────────────────────┤
Week 3 (Apr 7-11)   │  M3: Full UI-Backend Integration
                     │  Upload UI wiring + Batches/Exceptions wiring in parallel
                     │  End-to-end flow testing
─────────────────────┤
Week 4 (Apr 14-18)  │  M4: Hosted Beta
                     │  Quality gates, production deploy, smoke tests
                     │  Buffer for integration issues and bug fixes
```

### Developer Allocation

| Developer | Week 1 | Week 2 | Week 3 | Week 4 |
|-----------|--------|--------|--------|--------|
| Dev 1 (Backend) | M06: Supabase Foundation | M08: API Process Pipeline | M10: Upload UI Integration | M12: Quality Gates |
| Dev 2 (Backend) | M05: Domain Contracts | M07: API Upload + M09: API Export | M11: Batches/Exceptions Wiring | M13: Hosting & Release |
| Dev 3 (Frontend) | M01 + M02 + M04: Marketing/SEO/Shell | M03: Auth & Protected Routes | M10: Upload UI (support) + M11 (support) | Bug fixes + Buffer |

### Milestone Dates

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| **M1** | 28 March 2026 | Foundation complete — Supabase configured, contracts finalized, marketing polished |
| **M2** | 4 April 2026 | All backend APIs functional — auth, upload, process, export working end-to-end |
| **M3** | 11 April 2026 | Full UI integration — real pipeline, all pages wired to persisted data |
| **M4** | 18 April 2026 | Hosted beta — deployed, smoke-tested, ready for beta users |

---

## 5. Acceptance Criteria

### M1: Foundation (28 March 2026)

- [ ] All marketing page links resolve without 404 errors
- [ ] Public pages have correct `<title>`, `<meta description>`, and OG tags
- [ ] Shared domain contracts (`Batch`, `BatchStatus`, `BatchFileMeta`, `BatchException`, `ExportArtifact`) are defined and importable
- [ ] Supabase development environment is operational with schema, storage buckets, and RLS policies
- [ ] `.env.example` documents all required environment variables
- [ ] Database schema covers: batches, batch_files, processing_results, exceptions, exports

### M2: Backend APIs (4 April 2026)

- [ ] Unauthenticated users are redirected away from `(app)` routes
- [ ] Login and signup flows work end-to-end with Supabase Auth
- [ ] `POST /api/upload` accepts a valid Zerodha tradebook CSV, creates a batch record, stores the file, and returns a batch ID
- [ ] `POST /api/upload` rejects requests missing a tradebook file with a descriptive error
- [ ] `POST /api/process` executes the full pipeline (parse → events → cost basis → vouchers → reconciliation) for a given batch ID
- [ ] Batch status transitions are persisted correctly: `queued` → `running` → `succeeded`/`failed`/`needs_review`
- [ ] Reconciliation exceptions are persisted with severity and source references
- [ ] `GET /api/export` generates valid Tally XML from a processed batch and returns a downloadable file
- [ ] All API endpoints validate authentication and batch ownership

### M3: UI Integration (11 April 2026)

- [ ] User can complete the full upload → process → download workflow through the UI with zero simulation
- [ ] Upload step sends files to the real API and displays detected file types
- [ ] Processing step reflects real backend status (not client-side timers)
- [ ] Download step retrieves real generated XML
- [ ] `/batches` page displays persisted batch history with status badges and timestamps
- [ ] `/exceptions` page displays reconciliation issues with severity indicators
- [ ] `/dashboard` shows accurate summary metrics from real data
- [ ] Error states (upload failure, processing failure, network timeout) display user-facing messages

### M4: Hosted Beta (18 April 2026)

- [ ] `npm run build` passes without errors
- [ ] `npm run test` passes with coverage of parser, engine, export, and API route paths
- [ ] Application is deployed on Vercel with production environment variables
- [ ] Supabase production project has correct auth redirects, storage policies, and RLS
- [ ] End-to-end smoke test passes on production: signup → login → upload → process → download → view history
- [ ] Release checklist is documented and repeatable

---

## 6. Assumptions & Dependencies

### Assumptions

1. **Team availability:** 3 developers working full-time for the duration of the engagement
2. **Supabase tier:** Free or Pro tier is sufficient for V1 beta traffic volumes
3. **Zerodha format stability:** Zerodha tradebook/funds/holdings CSV formats do not change during development
4. **Synchronous processing:** V1 processes files synchronously. Batch sizes are expected to be under 10MB, completing in under 30 seconds. If this assumption fails, an async pattern must be introduced (scope impact: +1 week)
5. **Single user model:** One workspace per user. No multi-entity support beyond plan tier limits
6. **Tally XML target:** Tally Prime XML import format. Compatibility validated against structural checks and sample imports
7. **No CI/CD:** Deployments via Git push to Vercel. Automated CI is a future addition
8. **Pro tier assignment:** Pro plan is manually assigned during beta — no payment gateway integration
9. **Existing code correctness:** Engine, parser, and export modules are functionally correct and need wiring, not rewriting

### Dependencies

| Dependency | Owner | Impact if Delayed |
|------------|-------|-------------------|
| Supabase project provisioning (dev + prod) | Development team | Blocks all of Phase 2 |
| Sample Zerodha CSV files for testing | Client | Blocks parser validation |
| Tally Prime documentation or sample XML | Client | Blocks export validation; structural checks used as proxy |
| Vercel project and domain setup | Development team | Blocks M4 only |
| Auth method decision (email/password assumed) | Client | Blocks Module 03 |
| Vercel plan tier (Hobby vs Pro for function timeout) | Client | Affects processing timeout limits |

---

## 7. Risks & Mitigations

### R1: Processing Timeout on Large Files

**Probability:** Medium | **Impact:** High

Vercel serverless functions have timeout limits (10s on Hobby, 60s on Pro). Large tradebooks with thousands of trades may exceed this.

**Mitigation:**
- Measure processing time with representative files early in Module 08
- Recommend Vercel Pro plan ($20/month) for 60s timeout as first defense
- If insufficient, implement async two-phase pattern (API queues task, client polls)
- Scope impact if async needed: +5 working days

### R2: Tally XML Compatibility Issues

**Probability:** Medium | **Impact:** High

Generated XML may not import cleanly into Tally Prime due to formatting edge cases or missing required fields.

**Mitigation:**
- Obtain actual Tally import documentation or known-good sample XML from client
- Build integration test validating generated XML structure
- Allocate 2 days in M4 buffer for XML debugging

### R3: Database Schema Revisions

**Probability:** Medium | **Impact:** Medium

Schema may need changes as API integration reveals gaps in the initial design.

**Mitigation:**
- Use JSONB columns for flexible metadata alongside typed columns for queryable fields
- Use Supabase migrations for all schema changes
- Front-load schema design in Module 06 with input from Module 07-09 requirements

### R4: Cross-Developer Coordination

**Probability:** Medium | **Impact:** Medium

With 3 developers working in parallel, merge conflicts and contract misalignment can slow progress.

**Mitigation:**
- Module 05 (shared contracts) is completed first and serves as the single source of truth
- Each module has documented file ownership to minimize overlap
- Daily standups during Weeks 2-3 when parallel backend work is heaviest

### R5: Existing Module Bugs Found During Integration

**Probability:** Medium | **Impact:** Medium

Engine, parser, and export modules have not been exercised through a real end-to-end pipeline. Integration may reveal bugs.

**Mitigation:**
- Module 08 is allocated the most effort (4 days) to account for integration debugging
- Write integration tests alongside API implementation, not after
- Use real Zerodha sample data from Day 1

### R6: Supabase RLS Policy Complexity

**Probability:** Low | **Impact:** Medium

Row-Level Security policies for multi-table ownership chains may be more complex than expected.

**Mitigation:**
- Use simple `user_id`-based RLS (all rows have `user_id`, policy checks `auth.uid() = user_id`)
- Denormalize `user_id` onto child tables if join-based RLS proves too complex
- Test RLS in development before production deployment

---

## 8. Commercial Terms

### 8.1 Engagement Structure

| Item | Detail |
|------|--------|
| Engagement type | Fixed-scope, milestone-based delivery |
| Duration | 4 calendar weeks (23 March — 18 April 2026) |
| Team size | 3 developers |
| Working hours | Full-time (40 hours/week per developer) |

### 8.2 Project Fee

| Component | Amount |
|-----------|--------|
| Total project fee | [₹__________] |
| Per-developer monthly rate (reference) | [₹__________] |

### 8.3 Payment Schedule

Payments are tied to milestone acceptance. Each payment is due within [__] business days of milestone sign-off.

| Milestone | % of Total | Amount | Due Date |
|-----------|-----------|--------|----------|
| Project kickoff (advance) | [__]% | [₹__________] | 23 March 2026 |
| M1: Foundation accepted | [__]% | [₹__________] | 28 March 2026 |
| M2: Backend APIs accepted | [__]% | [₹__________] | 4 April 2026 |
| M3: UI Integration accepted | [__]% | [₹__________] | 11 April 2026 |
| M4: Hosted Beta accepted (final) | [__]% | [₹__________] | 18 April 2026 |
| **Total** | **100%** | **[₹__________]** | |

### 8.4 Intellectual Property

- All code, documentation, and artifacts produced during this engagement become the exclusive property of the Client upon full payment
- The development team retains no rights to use, license, or distribute the delivered code
- Pre-existing open-source dependencies remain under their respective licenses
- The development team may reference the project in their portfolio (project name and general description only) unless the Client objects in writing

### 8.5 Warranty Period

- A warranty period of [__] calendar days begins after M4 acceptance
- During the warranty period, the development team will fix bugs in delivered functionality at no additional cost
- Bugs are defined as: delivered features not meeting the acceptance criteria specified in Section 5
- New features, scope changes, and enhancements are not covered under warranty

### 8.6 Change Request Process

- Any work outside the scope defined in Section 2 requires a written Change Request (CR)
- Each CR will include: description, effort estimate, timeline impact, and cost
- CRs must be approved by both parties before work begins
- Approved CRs are billed at [₹__________] per developer-day
- CRs that affect the critical path will adjust milestone dates by mutual agreement

### 8.7 Termination

- Either party may terminate with [__] calendar days written notice
- Upon termination:
  - Client pays for all completed milestones plus pro-rated work on the current milestone
  - Development team delivers all code and artifacts produced up to the termination date
  - Any advance payment for unstarted milestones is refunded within [__] business days

### 8.8 Confidentiality

- Both parties agree to treat all project-related information as confidential
- The development team will not share client data, business logic, or proprietary information with third parties
- Uploaded broker data is processed securely and not used for any purpose beyond this engagement
- Confidentiality obligations survive termination for a period of [__] years

### 8.9 Limitation of Liability

- The development team's total liability under this agreement shall not exceed the total project fee
- Neither party is liable for indirect, consequential, or incidental damages
- The development team is not liable for:
  - Accuracy of financial calculations based on client-provided accounting rules
  - Changes to Zerodha export formats or Tally import specifications after delivery
  - Issues arising from client modifications to the delivered code

### 8.10 Dispute Resolution

- Disputes will first be addressed through good-faith negotiation between the parties
- If unresolved within [__] business days, disputes will be referred to [arbitration/mediation] under [jurisdiction]

---

## 9. Appendices

### Appendix A: Module-to-File Mapping

| Module | Primary Files |
|--------|---------------|
| 05 — Domain Contracts | `src/lib/types/*.ts` (8 files) |
| 06 — Supabase Foundation | `src/lib/db/index.ts`, `src/lib/db/repository.ts` |
| 03 — Auth | `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/middleware.ts` |
| 07 — API Upload | `src/app/api/upload/route.ts`, `src/lib/parsers/zerodha/detect.ts` |
| 08 — API Process | `src/app/api/process/route.ts`, `src/lib/engine/*.ts`, `src/lib/parsers/zerodha/*.ts`, `src/lib/reconciliation/*.ts` |
| 09 — API Export | `src/app/api/export/route.ts`, `src/lib/export/*.ts` |
| 10 — Upload UI | `src/app/(app)/upload/page.tsx` |
| 11 — Batches/Exceptions | `src/app/(app)/batches/page.tsx`, `src/app/(app)/exceptions/page.tsx`, `src/app/(app)/dashboard/page.tsx` |

### Appendix B: V1 Pricing Tiers

| Tier | Price | Inclusions |
|------|-------|------------|
| Free | INR 0/month | 1 entity, upload + exception preview, sample export only |
| Pro | INR 2,999/month | Unlimited batches, full XML export, priority onboarding |

Note: Tier enforcement is implemented in API route handlers. Pro tier is manually assigned during beta (no payment gateway).

### Appendix C: Team Allocation Matrix

| Developer | Primary Modules | Secondary/Support |
|-----------|----------------|-------------------|
| Dev 1 (Backend Lead) | M06, M08, M12 | M05 (review), M10 (API support) |
| Dev 2 (Backend) | M05, M07, M09, M13 | M11 (data layer) |
| Dev 3 (Frontend) | M01, M02, M03, M04 | M10, M11 (UI), M12 (lint) |

### Appendix D: Execution Plan References

Detailed module-level execution plans are maintained in `docs/execution/`:

- `01-marketing-shell.md` through `13-hosting-release.md`

These documents contain file-level implementation details, handoff notes, and dependency specifications for each module.

---

**Signatures**

| | Name | Signature | Date |
|---|------|-----------|------|
| **Client** | __________________ | __________________ | __________________ |
| **Development Team** | __________________ | __________________ | __________________ |
