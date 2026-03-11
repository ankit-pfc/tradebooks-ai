# MKT-07 — Analytics Tracking & Experiment Backlog

## Mission
Define what to measure and what to test so conversion improvements can be proven over time. Focuses on tracking the Zerodha-to-Tally workflow from visitor to activated user.

## 1. Funnel Definition

The core journey we need to measure, going from initial awareness to proven value and purchase intent.

1. **Visit:** User lands on the marketing site (Homepage, Pricing, etc.) from organic search, direct, or referral.
2. **Signup Intent:** User clicks a primary CTA ("Get Started Free", "Upload Your First File") navigating them to the signup page.
3. **Account Creation / Signup:** User successfully completes the registration form and enters the application shell.
4. **First Action (Upload):** User accesses the `/upload` route and drops their first Zerodha CSVs into the processing pipeline.
5. **Activation (The "Aha" Moment):** User successfully completes the reconciliation and clicks to download the Tally-importable XML for their first client book. *This is the most critical step in the funnel.*
6. **Habit Formation:** User logs in for a subsequent session or uploads data for a second client book (hitting the free tier limit).
7. **Purchase Intent / Upgrade:** User hits a paywall or actively navigates to the billing section to upgrade to the CA Pro or Solo tier.
8. **Conversion:** Successful payment and transition to a paid subscription.

## 2. Event Tracking Plan

Key events to implement via a tracking SDK (e.g., PostHog, Mixpanel, or GA4 custom events).

| Event Name | Trigger Location | Key Event Properties | Purpose |
|---|---|---|---|
| `page_view` | Global (All Pages) | `path`, `referrer`, `utm_source`, `utm_campaign` | Volume and source tracking. |
| `cta_clicked` | Marketing Site | `cta_name` (e.g., 'Hero_Upload_Free', 'Nav_Pricing'), `destination` | Measure intent and CTA effectiveness. |
| `signup_completed` | `/signup` success | `user_type` (if declared, e.g., 'CA Firm' vs 'Individual') | Track top-of-funnel acquisition. |
| `upload_started` | `/upload` dropzone | `file_types` (e.g., ['tradebook', 'funds']) | Measure friction in the critical first step. |
| `reconciliation_viewed`| Post-upload dashboard | `entry_count`, `exception_count`, `mode` (Investor/Trader) | Indicates the user sees the engine's value. |
| **`xml_downloaded`** | Dashboard Export | `client_book_id` (anonymized), `row_count` | **Core Activation Event.** Proves the JTBD is fulfilled. |
| `upgrade_initiated` | In-app paywall / Billing | `current_plan`, `target_plan` | Measure bottom-of-funnel intent. |
| `demo_requested` | `/demo` or Contact form | `firm_size` (e.g., '10-50 books') | Lead generation for the Practice tier. |

## 3. KPI Set

The metrics the team will monitor rhythmically to gauge business health.

### Primary North Star Metric
- **Activated Accounts:** The number of unique accounts that have successfully generated at least one Tally XML (`xml_downloaded` event). This proves the core Zerodha-to-Tally value proposition has been delivered.

### Secondary Metrics (Conversion Rates)
- **Visitor to Signup Rate (%):** Marketing site effectiveness.
- **Signup to Activation Rate (%):** Application onboarding health. A low number here means the upload or reconciliation steps are too difficult or failing.
- **Free to Paid Conversion Rate (%):** Monetization health measure of the Solo/CA Pro tiers.

### Guardrail Health Metrics
- **Time To First Value (TTFV):** The average time elapsed between `signup_completed` and the first `xml_downloaded`. Our goal is < 5 minutes. High TTFV indicates workflow friction.
- **Average Exception Rate:** The percentage of rows flagged as exceptions during reconciliation. If consistently too high, it may indicate a parsing engine failure rather than true accounting discrepancies, which destroys user trust.

## 4. Prioritized A/B Experiment Backlog

A queue of tests designed to improve conversion at specific funnel bottlenecks.

### Experiment 1: Hero CTA Specificity (High Impact, Low Effort)
- **Target:** Homepage Hero Section
- **Control:** "Get Started Free"
- **Variant:** "Upload Your First File Free"
- **Hypothesis:** By making the CTA highly specific to the immediate next action (uploading), we reduce ambiguity and increase click-through rates compared to generic SaaS copy.

### Experiment 2: Sample Data Onboarding (High Impact, Medium Effort)
- **Target:** `/upload` empty state (post-signup)
- **Control:** Standard empty dropzone waiting for a user's Zerodha CSV.
- **Variant:** Addition of a "Try it with sample data" button that pre-loads a dummy Zerodha tradebook.
- **Hypothesis:** Users who sign up out of curiosity but don't have a CSV immediately available will drop off. Sample data allows them to experience the reconciliation dashboard ("Aha" moment) immediately, increasing the likelihood they return later with real data.

### Experiment 3: Annual Billing Default (Medium Impact, Low Effort)
- **Target:** Pricing Page & Checkout
- **Control:** Monthly billing toggle selected by default.
- **Variant:** Annual billing toggle selected by default (with the 20% discount visually highlighted).
- **Hypothesis:** Since accounting and audits run on annual cycles, CAs are primed for annual commitments. Defaulting to annual will increase Average Revenue Per User (ARPU) upfront without significantly hurting conversion.

### Experiment 4: The Gated vs. Ungated Upload (High Impact, High Effort)
- **Target:** Marketing Site to App Transition
- **Control:** User must create an account *before* accessing the upload tool.
- **Variant:** User can drop a file directly on the homepage. They are prompted to create an account only *after* processing to download the XML.
- **Hypothesis:** Reversing the friction (letting them input data before creating an account) leverages the "Sunk Cost Fallacy" and proves value earlier, drastically increasing the visitor-to-activation rate. (Note: May require significant engineering changes to anonymous session handling).

## 5. Reporting Cadence Recommendation

- **Weekly Dashboard Review (Marketing & Product):** Focus on Visitor -> Signup -> Activation conversion rates. The goal is to spot any breakages in the Zerodha upload pipeline immediately.
- **Real-time Activation Alerts (Slack/Discord):** Fire a webhook whenever an `xml_downloaded` event occurs. Crucial for early-stage morale and manual verification of successful user journeys.
- **Monthly Growth Sync:** Deeper dive into Free-to-Paid upgrade rates, review finalized A/B test results, and prioritize the next experiments from the backlog.
