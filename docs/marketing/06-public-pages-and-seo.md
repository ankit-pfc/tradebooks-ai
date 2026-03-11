# MKT-06 — Public Pages & SEO Baseline

## Mission
Ensure conversion-critical public pages and baseline SEO/trust infrastructure exist and align with positioning.

## Depends on
- MKT-02
- MKT-03

## In scope
- public route plan: pricing, privacy, terms, optional how-it-works
- metadata baseline and internal linking
- nav/footer link strategy

## Out of scope
- long-form SEO program
- blog/CMS strategy

## Read first
- `AGENTS.md`
- `docs/marketing/00-agent-execution-plan.md`
- `docs/marketing/TASK-LIST.md`
- `docs/marketing/02-homepage-structure-and-copy.md`
- `docs/marketing/03-pricing-and-packaging.md`
- `docs/execution/02-public-pages-seo.md`
- `src/app/(marketing)/layout.tsx`

---

## 1. Route-Level Content Outline

### `/pricing`
- **Hero:** "Pricing that scales with your practice." Toggle for Monthly/Annual (Save 20%).
- **Pricing Cards:**
  - **Solo:** Up to 5 client books. "For independent accountants and self-filers."
  - **CA Pro:** Up to 25 client books. "For growing CA firms." 
  - **Practice:** Unlimited. "For large firms." Contact Sales.
- **Comparison Table:** Deep dive into features (seats, export formats, priority support).
- **FAQ Section:** Questions on client book definitions, supported brokers (Zerodha only), and trial/free tiers.
- **Conversion CTA:** "Upload Your First File Free"

### `/privacy`
- **Introduction:** Outline TradeBooks AI's commitment to data privacy, specifically regarding sensitive financial data.
- **Data Collection:** Clarify that only uploaded files (Zerodha CSVs) and basic account info (email, name) are collected. No direct broker or Tally connections.
- **Data Usage:** Explain that data is strictly used for parser processing and XML generation. Explicitly state: "We do not use your financial data to train AI models."
- **Data Retention & Deletion:** Detail how long uploaded files are kept and how users can delete their batch history.
- **Third-Party Services:** List infrastructure partners (e.g., Supabase, Vercel).

### `/terms`
- **Service Description:** Define TradeBooks AI as a data-formatting utility bridging Zerodha and Tally.
- **User Responsibilities:** Users are responsible for verifying the generated XML before importing it into their accounting software. TradeBooks AI does not provide financial or tax advice.
- **Limitation of Liability:** Standard clauses protecting against errors in the source broker data or subsequent issues post-import in Tally.
- **Account Termination & Abuse:** Rules around fair usage, especially for the free tier or beta programs.
- **Subscription/Payment Terms:** Non-refundable policies, billing cycle definitions, and rules around upgrading/downgrading.

---

## 2. Optional `/how-it-works` Recommendation

**Recommendation:** **No**, do not build a standalone `/how-it-works` route for V1.

**Rationale:** The application workflow is simple enough (Upload -> Configure -> Reconcile -> Export) that it should remain front-and-center on the homepage. Creating a separate page dilutes the homepage narrative and adds an unnecessary click before conversion. Instead, rely on the `#how-it-works` anchor section defined in MKT-02. This keeps the user on the primary conversion path (the homepage) where the primary CTAs live.

---

## 3. Metadata Templates (Title & Description)

### Homepage (`/`)
- **Title:** TradeBooks AI | Convert Zerodha Exports to Tally XML
- **Description:** Stop posting Zerodha trades manually. Upload your broker exports, review reconciled exceptions, and generate a Tally-importable XML in minutes. Built for Indian CAs.

### Pricing (`/pricing`)
- **Title:** Pricing | TradeBooks AI
- **Description:** Simple pricing based on the number of client books you manage. Start free and scale your CA practice's Zerodha-to-Tally workflow without per-transaction fees.

### Privacy Policy (`/privacy`)
- **Title:** Privacy Policy | TradeBooks AI
- **Description:** Read how TradeBooks AI secures your financial data. We use a secure file-upload model, require no broker credentials, and never train AI on your trading data.

### Terms of Service (`/terms`)
- **Title:** Terms of Service | TradeBooks AI
- **Description:** Terms and conditions for using TradeBooks AI's Zerodha-to-Tally accounting utility.

### Login / Signup (`/login`, `/signup`)
- **Title:** Sign In | TradeBooks AI
- **Description:** Log in to TradeBooks AI to upload Zerodha exports, review exceptions, and download Tally XMLs.

---

## 4. Internal Linking Map (Homepage, Nav, Footer)

### Top Navigation (`<nav>`)
- **Logo:** `href="/"`
- **How it Works:** `href="/#how-it-works"` (Anchor link)
- **Features:** `href="/#features"` (Anchor link)
- **Pricing:** `href="/pricing"` *(Requires updating layout.tsx from `#pricing` to `/pricing`)*
- **Sign In:** `href="/login"`
- **Get Started:** `href="/signup"`

### Homepage Body
- **Hero CTA:** `href="/signup"`
- **Secondary Hero CTA:** `href="/#how-it-works"`
- **Bottom CTA:** `href="/signup"`

### Footer (`<footer>`)
- **Product Links:** 
  - How it Works -> `href="/#how-it-works"`
  - Features -> `href="/#features"`
  - Pricing -> `href="/pricing"`
- **Legal Links:**
  - Privacy Policy -> `href="/privacy"`
  - Terms of Service -> `href="/terms"`

---

## 5. Dead-Link Prevention Checklist

- [ ] Update `src/app/(marketing)/layout.tsx` to ensure "Pricing" points to `/pricing` instead of `#pricing`.
- [ ] Verify that `<Link>` tags are used instead of `<a>` for all internal App Router navigation.
- [ ] Create placeholder `.tsx` files for `/pricing`, `/privacy`, and `/terms` to ensure footer links resolve successfully during V1 testing.
- [ ] Confirm `#how-it-works` and `#features` ID tags exist on the corresponding container `div`s or `section`s in `src/app/(marketing)/page.tsx`.
- [ ] Test that `/login` and `/signup` point validly to the chosen auth pages (or Supabase auth UI routes).
