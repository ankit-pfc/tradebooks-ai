# MKT-03 — Pricing & Packaging Strategy

## 1. Value Metric Recommendation

**Recommended Value Metric:** Number of Client Books (or Portfolios) Processed per Month/Year.

**Rationale:** 
- **Alignment with Value:** CAs and accounting firms charge their clients based on the number of accounts/books managed or the volume of work per client. Pricing per client book aligns TradeBooks AI's cost directly with the firm's revenue-generating units.
- **Predictability:** Measuring by "client books" is more predictable for a CA firm than tracking lines of trades or MBs of file uploads. 
- **Growth Path:** As the CA firm grows and onboards more clients, they naturally upgrade to higher tiers. It doesn't penalize them for a client having a high volume of trades, which they might not control.
- **Alternative considered (Not Recommended):** Per-transaction or per-export pricing. This introduces friction and anxiety ("Will this large export cost me extra?") which we want to avoid for recurring workflows.

## 2. Tier Proposal

We propose a three-tier architecture tailored to the primary and secondary ICPs:

### Tier 1: Solo / Independent
- **Target:** Independent accountants, advanced self-filers, and small family offices (Secondary ICPs).
- **Entitlements:** Up to 5 client books, core Zerodha-to-Tally XML export, basic reconciliation visibility, standard email support.
- **Focus:** Quick entry, easy standardized posting.

### Tier 2: CA Pro (Most Popular)
- **Target:** Small to mid-sized CA firms and dedicated accounting teams (Primary ICP).
- **Entitlements:** Up to 25 client books, advanced reconciliation dashboards, multi-user/team access (e.g., 3 seats), exception handling rules, priority support.
- **Focus:** Team collaboration, handling high volume of clients during audit seasons.

### Tier 3: Practice / Firm
- **Target:** Large CA firms managing high client volumes.
- **Entitlements:** Unlimited or high-volume client books (e.g., 100+), unlimited seats, dedicated account manager, custom workflow consulting.
- **Focus:** Scalability, firm-wide standardization, maximum efficiency.

## 3. Suggested Price Architecture

*Note: Final INR pricing depends on cost-to-serve and willingness to pay, which can be tested. This is a relative architecture.*

- **Free / Beta Entry:** Free forever for 1 client book (or a 14-day free trial on the CA Pro tier).
- **Solo:** Base rate (e.g., ₹X/month/annualized). Positioned as a no-brainer vs. the manual hourly cost of one accountant dealing with messy spreadsheets.
- **CA Pro:** ~3x to 5x the Solo price. Positioned as the optimal value for a growing firm. Includes team features.
- **Practice:** Custom pricing ("Contact Us") or a high flat rate (e.g., 10x Solo price).

Annual billing should be heavily incentivized (e.g., 20% discount or 2 months free) since accounting is highly seasonal but the tool provides year-round value.

## 4. Free Offer / Beta Entry Recommendation

**Recommendation:** "Upload Your First File Free" (Proof of Value entry)

- **Structure:** Allow users to sign up and process their first client book completely free, generating the actual Tally XML.
- **Why it works:** The biggest barrier (Anxiety) is "Will this work for my exact accounting treatment?" Allowing them to drop in a Zerodha export, see the reconciliation, and generate the XML for one client proves the value instantly without a paywall block. It explicitly targets the habit of "we already do this in Excel."
- **Alternative:** 14-day free trial. If the product requires more setup, a time-bound trial creates urgency. However, for a file-first flow, a usage-bound free tier (1 free book) is stickier and builds trust.

## 5. Pricing Page Content Blocks + FAQ

### Hero Section
- **Headline:** Pricing that scales with your practice.
- **Sub-headline:** Stop billing for manual entry. Convert Zerodha exports to Tally-ready XML in minutes. Start free, upgrade as your client list grows.
- **Toggle:** Monthly / Annually (Save 20%)

### Pricing Cards (The 3 Tiers)
- **Solo:** "For independent accountants and self-filers." (Price) -> CTA: Start Free / Upload Export
- **CA Pro:** (Highlighted) "For growing CA firms." (Price) -> CTA: Start Free Trial
- **Practice:** "For large firms." (Custom Price) -> CTA: Contact Sales

### Feature Comparison Table
- Detailed breakdown comparing Solo, CA Pro, and Practice.
- Rows: Client Books limit, Team Seats, Exception Rules, Support Level, Export Formats (Tally XML).

### Trust & Social Proof
- Insert a quote/testimonial from an early beta user or CA focusing on time saved during month-end close.

### FAQ Section
- **Do I pay per transaction or per trade?**  
  No, you only pay based on the number of client books you manage. Unlimited trades within those books.
- **What is a 'client book'?**  
  A client book represents one individual or corporate entity whose Zerodha accounts you are reconciling for Tally.
- **Is there a setup fee?**  
  No setup fees. You can upload your first Zerodha export and generate an XML in minutes.
- **Can I cancel anytime?**  
  Yes, but we recommend our annual plans which offer a significant discount and align with the typical financial reporting year.
- **Does it support brokers other than Zerodha?**  
  We are hyper-focused on providing the absolute best, most reliable Zerodha-to-Tally experience. We do not support other brokers in our V1.

### Final CTA Banner
- **Headline:** Ready to eliminate manual posting?
- **CTA:** Upload Your First File Free
