# MKT-05 — Trust, Proof & Objection Handling

## Mission
Design the credibility layer that reduces buyer anxiety and improves conversion confidence.

## Depends on
- MKT-01

## In scope
- trust signal framework
- proof hierarchy (what to show where)
- objection handling blocks
- alternatives/comparison framing

## Out of scope
- legal policy writing details
- pricing mechanics

---

## 1. Trust Strip Recommendations

### Above-the-Fold (Hero Section)
**Goal:** Establish immediate baseline credibility before the user scrolls.
- **Micro-copy near CTA:** "No credit card required. Import your first file free."
- **Trust badge strip (under CTA):** 
  - *Format:* A muted, single-row strip of text or icons.
  - *Content:* 
    - "✓ Built for Indian Tax/Audit Workflows"
    - "✓ Secure Processing (No AI training on your data)"
    - "✓ 100% Compliant with Tally Prime & ERP 9"

### Near Secondary CTAs (Pricing & Signup Funnel)
**Goal:** Reduce anxiety at the moment of commitment.
- **Copy:** "Export perfectly formatted Tally XML, or your time back."
- **SSL/Security Signal:** "Bank-grade 256-bit encryption. We don't ask for your broker or Tally credentials."
- **Audit Signal:** "Every generated voucher links directly back to the original Zerodha row."

---

## 2. Proof Blocks List

Since V1 lacks massive customer logos or heavy case studies, we must rely on **Product Proof** (showing the product actually works and is built precisely for the user's workflow).

### Proof of Audit Trail
- **Visual:** A split-screen or connecting-line graphic. 
- **Left side:** A raw Zerodha `tradebook.csv` row.
- **Right side:** The exact corresponding Tally Journal/Voucher XML entry with matched figures.
- **Caption:** "Every generated voucher traces exactly back to its source row. Full audit confidence."

### Proof of Exception Workflow
- **Visual:** A screenshot of the `upload` page UI showing the "Exceptions (3)" summary block (e.g., "Missing P&L entry", "Amount mismatch").
- **Caption:** "We don't just blindly import. TradeBooks AI stops and flags mismatches (like missing funds or duplicate contracts) before they pollute your Tally books."

### Proof of Output Artifacts
- **Visual:** A looping GIF or lightweight 3-step timeline of importing the XML into Tally Prime.
- **Caption:** "No weird mappings needed. The generated XML fits Tally natively."

---

## 3. Comparison Framework (Versus Alternatives)

Use a conceptual table or a feature-comparison grid.

| Feature / Need | **Manual Excel & Data Entry** | **Generic Accounting Parsers** | **TradeBooks AI (V1)** |
|----------------|-------------------------------|--------------------------------|-------------------------|
| **Zerodha Native** | ❌ Formatting nightmare | ❌ Breaks on edge cases | ✅ Built specifically for Zerodha exports |
| **Time to Reconcile** | ❌ Hours per client | ⚠️ Requires manual rule-mapping | ✅ Seconds (Auto-reconciliation) |
| **Exception Flagging** | ❌ Discovered during audit | ❌ Blind import / Silent failures | ✅ Flagged explicitly before export |
| **Tally Ready XML** | ❌ Manual Journal Posting | ⚠️ Needs secondary formatting | ✅ 100% Tally Prime & ERP 9 Native |
| **Accounting Modes** | ❌ Manual tag separation | ❌ Flat treatment | ✅ Investor (LTCG/STCG) & Trader modes |

---

## 4. Top Objections + Placement Guidance

| Objection | Addressing Response | Where to Place It |
|-----------|--------------------|-------------------|
| **"Will this mess up my client's Tally files?"** | TradeBooks AI focuses on *Exception Review* before generation. It forces you to validate missing entries (like missing funds) so nothing incorrect is imported. | Below the "How it Works" processing step. |
| **"Is it hard to configure or map ledgers?"** | You map your Tally Company Name, Period, and choose Investor/Trader mode once. No complex logic-building required. | Near the "Configure" section on the Homepage / Features. |
| **"We are comfortable with Excel."** | You can keep your source exports. We just replace the repetitive data entry and give you an immediate exception report. | Pricing Page (to justify the switch/cost) or Comparison block. |
| **"What about data privacy/security?"** | We do not train AI on your trading data. Processing is secure, and outputs are strictly scoped to your session/company. | Footer trust strip & Signup page form. |

---

## 5. FAQ Inputs Tied to Trust Concerns

**Q: Does TradeBooks AI connect directly to my Zerodha account?**
A: No. We intentionally use a file-upload approach. You upload the exports (Tradebook, Funds, Holdings) you already download from Zerodha Console. We do not require your Zerodha login credentials, keeping your account 100% secure.

**Q: Does it connect directly to my Tally database?**
A: No. We generate standard Tally-importable XML. You simply import this XML into Tally yourself. We do not need remote access to your Tally server or local network.

**Q: What if the uploaded export has missing data or mismatched funds?**
A: The engine auto-reconciles across your uploaded files. If a trade has no matching funds debit, or if a contract note amount mismatches the tradebook, it highlights it as an "Exception" with a distinct warning so you can review it before exporting.

**Q: Can I verify the entries being created?**
A: Yes. Every generated entry provides an audit trail pointing back to the specific row in your Zerodha export. You review the summary before you download the XML.

**Q: Which Tally versions are supported?**
A: The generated XML conforms to Tally's standard import format, which works seamlessly with both Tally Prime and Tally ERP 9.
