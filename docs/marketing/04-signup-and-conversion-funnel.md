# MKT-04 — Signup & Conversion Funnel

## Mission
Define end-to-end CTA destinations and signup flow to maximize activation and paid intent.

## 1. CTA Destination Map

| Placement | CTA Copy | Destination | Intent |
|---|---|---|---|
| **Global Nav** | Start Free | `/signup` | Primary: Create account & start self-serve flow |
| **Global Nav** | Book Demo | `/demo` or `#contact` | Secondary: Capture CA firm leads needing assurance |
| **Hero Section** | Upload Your First File Free | `/signup` (or direct to `/upload` if unauth allowed, routing to signup post-upload) | Primary: Immediate product usage & activation |
| **Hero Section** | See How It Works | Anchor to `#how-it-works` | Education: Build trust before asking for signup |
| **Pricing: Solo** | Start Free | `/signup` | Primary: Solo accountant onboarding |
| **Pricing: CA Pro** | Start Free Trial | `/signup?plan=pro` | Primary: Team-based firm onboarding |
| **Pricing: Practice**| Contact Sales | `/demo` (or mailto) | Secondary: High-touch enterprise sales |
| **Global Footer** | Get Started | `/signup` | Primary: Catch-all at end of page |

## 2. Recommended Signup Flow

**Philosophy:** Minimal friction. Only ask for what is absolutely necessary to create the account and map the first export. 

**Step 1: Account Creation (Keep it brief)**
- **Email Address** (Work email preferred but don't strictly block Gmail initially to reduce friction for solo accountants)
- **Password** (or Google/OAuth SSO for instant access)
- *Optional Checkbox:* "I am an accounting professional managing multiple clients." (Helps segment CA firms from individual traders)

**Step 2: Welcome & Context Setting**
- **Headline:** Welcome to TradeBooks AI. Let's automate your first Zerodha export.
- **Action:** Direct user immediately to the `/upload` interface. 
- *Friction Control:* Do NOT ask for payment details upfront. The goal is to prove value via the "Free 1st Client Book."

## 3. Activation Flow (Signup to First Value)

"Time to First Value" (TTFV) is critical. The user must experience the reconciliation engine and XML export to build trust.

1. **Upload:** User drops Zerodha CSVs (`tradebook`, `funds`, `holdings`) into the dropzone.
2. **Context Configuration:** 
   - User inputs Tally Company Name.
   - Selects Mode: Investor (Capital Gains) or Trader (Business Income).
3. **Reconciliation Engine (The "Aha!" Moment):**
   - Show a loading/processing state highlighting engine actions (e.g., "Cross-verifying trades...", "Matching funds...").
   - Display the results dashboard: X successful entries, Y exceptions found.
4. **Exception Review:** User clicks into exceptions, sees the issue (if any), and resolves it or acknowledges it.
5. **Export:** User clicks "Generate Tally XML". The file downloads.
6. **Post-Activation Prompt:** "Success! You've generated your first Tally XML. Upgrade to CA Pro to add more client books and invite your team."

## 4. Assisted Path for CA Firms (Demo/Contact)

Larger CA firms (Primary ICP) often have high anxiety about data privacy, team workflows, and exact accounting treatment before they try a new tool.

**Routing:**
- Users clicking "Book Demo" or "Contact Sales" are routed to a simple form (or Calendly embed).

**Form Fields (if using custom form):**
- Name
- Work Email
- Firm Name
- Approximate Number of Client Books (Dropdown: 1-10, 11-50, 50+)

**Sales Motion / Follow-up:**
- Automated email confirming demo time.
- Sales/Founder takes the call to do a live walkthrough of the Zerodha-to-Tally upload process, demonstrating the exception handling (which proves accuracy and builds trust).

## 5. Drop-off Risks & Mitigation Actions

| Risk / Drop-off Point | Why it happens | Mitigation Action |
|---|---|---|
| **Signup Screen Abandonment** | Too many fields, or anxiety about pricing. | Use SSO (Google). Explicitly state "No credit card required for your first file." |
| **Upload Screen (0 files uploaded)** | User doesn't have a Zerodha export handy right now. | Provide a "Download Sample Zerodha Export" button so they can test the workflow instantly without hunting for their own files. |
| **Configuration Step Friction** | Confusion about "Investor vs Trader" mode or Ledger mapping. | Add tooltips explaining the difference. Provide sensible default ledger names that map to standard Tally setups. |
| **Exception Review Anxiety** | System flags too many exceptions, making the user think the tool is broken. | Use clear copy: "Exceptions caught! We prevented these from entering Tally." Frame exceptions as a feature (a safety net), not a bug. |
| **Post-Export Inaction** | User downloads XML, but never imports to Tally or upgrades. | Send a follow-up automated email 1 hour later: "Did your XML import smoothly into Tally? Here's a quick guide on how to import it. Ready for your next client? Upgrade here." |
