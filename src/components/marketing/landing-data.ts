/**
 * Static content for the marketing landing page (design handoff v2).
 *
 * The page is presentational — every "data" array below is lifted verbatim from
 * the locked hi-fi prototype. Product name is rendered as "TradeBooks AI"
 * (the canonical brand), not the prototype's "TradeBookAI".
 */

/** Where every "run a file / get started" CTA points (the real app entry). */
export const CTA_HREF = "/upload";

/** Canonical product name used throughout landing copy. */
export const PRODUCT_NAME = "TradeBooks AI";

/**
 * Format a rupee amount the way the prototype does: en-IN grouping, 2 decimals,
 * and a real Unicode minus sign (U+2212) for negatives.
 */
export function inr(n: number): string {
  const sign = n < 0 ? "−" : "";
  return (
    "₹" +
    sign +
    Math.abs(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/* ── §A. Hero reconciliation exception rows ── */
export interface HeroException {
  cp: string;
  meta: string;
  kind: "Mismatch" | "Treatment" | "Mapping";
}

export const heroExceptions: HeroException[] = [
  { cp: "Contract note vs tradebook — qty mismatch", meta: "26 Mar · INFY", kind: "Mismatch" },
  { cp: "Corporate action — bonus 1:1 not in export", meta: "18 Mar · TATAMOTORS", kind: "Treatment" },
  { cp: "Charges line has no ledger mapping", meta: "14 Mar · DP charges", kind: "Mapping" },
];

export const heroStats: { value: string; label: string; tone?: "pos" }[] = [
  { value: "1,240", label: "vouchers built" },
  { value: "1,228", label: "AI-reconciled", tone: "pos" },
  { value: "0", label: "unbalanced" },
];

/* ── Hero three-beliefs rail ── */
export const heroBeliefs: { n: string; title: string; sub: string }[] = [
  { n: "01", title: "Books, not just numbers", sub: "Correct, traceable vouchers — not a parsed statement." },
  { n: "02", title: "Rigor you can audit", sub: "Every voucher traces to a source row. No black box." },
  { n: "03", title: "Built for Indian practice", sub: "Tally-native, Zerodha-first, ICAI-aligned workflow." },
];

/* ── §B. How-it-works steps ── */
export type Tone = "action" | "cyan" | "warn" | "pos";

export interface Step {
  n: string;
  tone: Tone;
  title: string;
  lead: string;
  tags: string[];
}

export const steps: Step[] = [
  {
    n: "01",
    tone: "action",
    title: "Upload the export",
    lead: "Drop the Console tradebook, P&L and contract notes — CSV, XLSX or PDF. No login, no API key.",
    tags: ["Zerodha Console", "Contract notes", "Bank statement"],
  },
  {
    n: "02",
    tone: "cyan",
    title: "AI maps every line",
    lead: "The AI maps each row to the right ledger and 94% reconcile untouched. FIFO matches every sell to its buy lot, pre-31 Jan 2018 holdings are grandfathered, and each line is classified investor vs trader, STCG vs LTCG, speculative vs non-speculative.",
    tags: ["AI auto-mapping", "FIFO", "STCG / LTCG"],
  },
  {
    n: "03",
    tone: "warn",
    title: "Reconcile the exceptions",
    lead: "Everything that ties out is matched silently. You only touch what doesn’t — mismatched contract notes, unmapped charges, corporate actions. Exception-first, never a wall of green rows.",
    tags: ["Exception-first", "Contract-note tie-out", "Overrides logged"],
  },
  {
    n: "04",
    tone: "pos",
    title: "Export to Tally",
    lead: "Confirm, and TradeBooks AI writes proper Sales, Purchase, Receipt and Journal vouchers — Tally XML for a clean import, or Excel. Balanced, traceable, audit-ready.",
    tags: ["Tally XML", "Balanced", "Audit-ready"],
  },
];

/* ── §C. Voucher rows + source-trace data ── */
export type VoucherType = "Sales" | "Purchase" | "Journal" | "Receipt";

export interface Voucher {
  id: string;
  d: string;
  vt: VoucherType;
  ledger: string;
  amt: number;
  st: "ok" | "warn";
  src: Record<string, string>;
  resolve: { ledger: string; amt: string; lot: string; treat: string };
}

export const vouchers: Voucher[] = [
  {
    id: "v1",
    d: "31 Mar 25",
    vt: "Sales",
    ledger: "Equity Sales — sale of shares",
    amt: 221052.0,
    st: "ok",
    src: { symbol: "INFY", type: "SELL", qty: "120", price: "₹1,842.10", date: "2025-03-31" },
    resolve: { ledger: "Equity Sales", amt: "₹2,21,052.00", lot: "14 Aug 19", treat: "LTCG" },
  },
  {
    id: "v2",
    d: "31 Mar 25",
    vt: "Journal",
    ledger: "Brokerage, STT & exchange charges",
    amt: -18420.5,
    st: "ok",
    src: { symbol: "INFY", type: "CHARGES", qty: "—", price: "STT ₹2,431", date: "2025-03-31" },
    resolve: { ledger: "STT + Brokerage", amt: "₹18,420.50", lot: "—", treat: "Indirect Exp" },
  },
  {
    id: "v3",
    d: "28 Mar 25",
    vt: "Purchase",
    ledger: "Equity Purchases — investments",
    amt: -615000.0,
    st: "ok",
    src: { symbol: "TCS", type: "BUY", qty: "150", price: "₹4,100.00", date: "2025-03-28" },
    resolve: { ledger: "Investments", amt: "₹6,15,000.00", lot: "new lot", treat: "Asset" },
  },
  {
    id: "v4",
    d: "28 Mar 25",
    vt: "Journal",
    ledger: "GST input credit (18% on brokerage)",
    amt: 3315.69,
    st: "ok",
    src: { symbol: "—", type: "GST", qty: "—", price: "18% × ₹18,420", date: "2025-03-28" },
    resolve: { ledger: "GST Input Credit", amt: "₹3,315.69", lot: "—", treat: "Input" },
  },
  {
    id: "v5",
    d: "26 Mar 25",
    vt: "Receipt",
    ledger: "Suspense — contract note mismatch",
    amt: -12040.0,
    st: "warn",
    src: { symbol: "RELIANCE", type: "SELL", qty: "200 ≠ 180", price: "₹2,890.00", date: "2025-03-26" },
    resolve: { ledger: "Suspense", amt: "₹12,040.00", lot: "unmatched", treat: "Review" },
  },
];

/** Voucher-type → text color token. */
export const voucherTypeColor: Record<VoucherType, string> = {
  Sales: "var(--pos)",
  Purchase: "var(--action)",
  Journal: "var(--ink-2)",
  Receipt: "var(--warn)",
};

/* ── §D. Accounting-logic accordions ── */
export interface LogicItem {
  t: string;
  sum: string;
  paras: string[];
  miniTable?: { label: string; value: string; pos?: boolean }[];
  mapping?: [string, string][];
}

export const logicItems: LogicItem[] = [
  {
    t: "FIFO matching & grandfathering",
    sum: "Pre-31 Jan 2018 holdings, handled the way the Act intends.",
    paras: [
      "Every sell is matched to its earliest available buy lot (FIFO), so the holding period — and therefore STCG vs LTCG — is computed per lot, not in aggregate.",
      "For shares acquired before 31 January 2018, the cost is stepped up to the higher of actual cost and the fair market value on that date (the grandfathering rule), capped at the sale value. We show the original cost, the FMV used, and the resulting cost considered — line by line.",
    ],
    miniTable: [
      { label: "actual cost", value: "₹620.00" },
      { label: "FMV 31-Jan-18", value: "₹1,140.00" },
      { label: "cost considered", value: "₹1,140.00", pos: true },
    ],
  },
  {
    t: "Investor vs trader treatment",
    sum: "Capital gains or business income — classified, not guessed.",
    paras: [
      "Equity delivery is treated as capital gains (STCG / LTCG by holding period). Intraday is speculative business income; F&O is non-speculative business income. We classify each segment and post it to the right head, so the P&L and capital-gains schedules don’t blur into one another.",
      "Where a client’s facts argue for a different stance — e.g. consistent high-frequency delivery treated as business — you set the treatment at the client level and every voucher follows it. The choice, and who made it, is recorded.",
    ],
  },
  {
    t: "Charges, STT, GST & brokerage → ledgers",
    sum: "Each cost line lands in the correct account, not a lump sum.",
    paras: [
      "A contract note isn’t one number. Brokerage, STT, exchange transaction charges, SEBI fees, stamp duty, GST and DP charges are separated and mapped to their own ledgers — with GST split out as input credit where eligible.",
    ],
    mapping: [
      ["Brokerage", "Indirect Expenses"],
      ["STT", "Charges (disallowed)"],
      ["Exchange + SEBI", "Indirect Expenses"],
      ["GST 18%", "Input Credit"],
      ["Stamp duty", "Charges"],
    ],
  },
  {
    t: "Exception-first reconciliation",
    sum: "Tradebook vs contract note vs funds — only mismatches surface.",
    paras: [
      "We tie the tradebook to the contract notes and the funds statement. Anything that reconciles is posted silently. What can’t — a quantity mismatch, a missing corporate action, a charge with no ledger map, a fund movement with no trade — is raised as a typed exception for your decision.",
      "Nothing is auto-resolved into a suspense account and forgotten. The books don’t balance by hiding the problem; they balance because you cleared it.",
    ],
  },
];

/* ── §E. Comparison table ── */
export const comparisonColumns = ["", "Manual / Excel", "Filing tools", PRODUCT_NAME];

export const comparisonRows: [string, string, string, string][] = [
  ["AI auto-mapping, you review exceptions", "no", "no", "yes"],
  ["Produces Tally vouchers", "by hand", "no", "yes"],
  ["FIFO & grandfathering applied", "manual", "for the ITR only", "yes"],
  ["Charges / STT / GST → ledgers", "manual", "no", "yes"],
  ["Reconciliation & exceptions", "spreadsheet", "no", "yes"],
  ["Multi-client, repeatable", "no", "per return", "yes"],
  ["Recurring close, not annual", "no", "no", "yes"],
];

/* ── §F. Pricing feature lists ── */
export const pricingFree = {
  name: "Free",
  price: "₹0",
  suffix: "",
  desc: "One client file, end to end. The honest demo.",
  cta: "Run your first file",
  features: [
    "One client file, full flow",
    "FIFO, grandfathering & treatment",
    "Reconciliation & exceptions",
    "Tally XML + Excel export",
  ],
};

export const pricingPro = {
  name: "Pro",
  price: "₹2,999",
  suffix: "/ month",
  desc: "Unlimited client files and closes. Less than one billed hour.",
  cta: "Start Pro free for 14 days",
  badge: "FOR PRACTICES",
  features: [
    "Unlimited client files & closes",
    "Everything in Free",
    "Saved chart-of-account mappings",
    "Multi-client close calendar",
    "Priority support during audit season",
  ],
};

/* ── §G. FAQ items (single source — also feeds FAQPage JSON-LD) ── */
export interface Faq {
  q: string;
  a: string;
}

export const faqs: Faq[] = [
  {
    q: "Is the accounting actually correct — FIFO, grandfathering, treatment?",
    a: "That’s the whole product. We show every treatment openly in the accounting-logic section, and every voucher exposes the source row and the lot it matched. Where judgment is needed, you set the call and we record it. Run it on a file you already know the answer to and check.",
  },
  {
    q: "Will I just have to redo it in Tally anyway?",
    a: "No. The output is native Tally vouchers — Sales, Purchase, Receipt, Journal — exported as Tally XML that imports directly into Tally Prime and ERP 9 (or Excel if you prefer). Balanced and traceable, not a CSV you re-key.",
  },
  {
    q: "Do you need my client’s broker or Tally login?",
    a: "Never. You upload an export from Console and we hand back a file. No credentials, no API access to anyone’s account, and client data is never used to train models. Hosted in India, encrypted in transit and at rest.",
  },
  {
    q: "Only Zerodha? Half my clients use other brokers.",
    a: "Zerodha-first, on purpose — we’d rather get one broker’s accounting genuinely right than five roughly. More brokers are on the roadmap, added only when each meets the same standard. Tell us which ones you need; it shapes the order.",
  },
  {
    q: "What happens when files don’t tie out?",
    a: "They surface as typed exceptions — quantity mismatches, missing corporate actions, unmapped charges, orphan fund movements. Nothing is quietly dumped into suspense. The books balance because you cleared the exception, not because it was hidden.",
  },
  {
    q: "Is ₹2,999 a month worth it?",
    a: "It’s less than a single billed hour, against 8–14 hours of hand-posting per active-trader client, every close. Start free on one file and decide on the math, not the claim.",
  },
];

/* ── Trust strip ── */
export const trustItems: { icon: "bar" | "line" | "lock" | "globe"; title: string; sub: string; nowrap?: boolean }[] = [
  { icon: "bar", title: "Tally Prime & ERP 9", sub: "Native voucher import", nowrap: true },
  { icon: "line", title: "Zerodha Console", sub: "Tradebook & P&L exports" },
  { icon: "lock", title: "No credentials", sub: "No AI training on your data" },
  { icon: "globe", title: "India-hosted", sub: "Data stays in-country" },
];

/* ── The Gap section ── */
export const gapSteps: { n: string; title: string; body: string; tone: "neutral" | "neg" }[] = [
  {
    n: "1",
    tone: "neutral",
    title: "Export the P&L from Console",
    body: "A tradebook and a capital-gains statement. Useful for the ITR — not a single ledger entry.",
  },
  {
    n: "2",
    tone: "neutral",
    title: "Rebuild it in Excel",
    body: "FIFO by hand. Grandfather the pre-2018 lots. Split STT, brokerage, GST and stamp duty into the right heads.",
  },
  {
    n: "3",
    tone: "neutral",
    title: "Hand-post every voucher into Tally",
    body: "Hundreds of entries, one ledger at a time. A junior’s whole day, per client, per close.",
  },
  {
    n: "4",
    tone: "neg",
    title: "Find the error during review — or worse, in audit",
    body: "A mismatched contract note, a wrong head. Found too late, under 44AB pressure.",
  },
];

export const gapCosts: { label: string; value: string; tone?: "neg" | "pos"; border?: boolean }[] = [
  { label: "One active-trader client ≈", value: "1,200 lines" },
  { label: "Hand-posting ≈", value: "8–14 hrs", tone: "neg", border: true },
  { label: `With ${PRODUCT_NAME} ≈`, value: "1 upload + review", tone: "pos", border: true },
];

/* ── Who it's for ── */
export const whoCards: {
  icon: "building" | "store" | "trend";
  accent: Tone;
  title: string;
  badge?: string;
  suffix?: string;
  body: string;
  quote: string;
  primary?: boolean;
}[] = [
  {
    icon: "building",
    accent: "action",
    title: "CA firms & practitioners",
    badge: "PRIMARY",
    primary: true,
    body: "2–25 people, dozens of clients on Tally, a handful of them active traders. The recurring close is where the hours vanish.",
    quote:
      "A new F&O client just handed me a year of trades. One upload, review the dozen exceptions, export — instead of half a junior’s week.",
  },
  {
    icon: "store",
    accent: "cyan",
    title: "In-house finance teams",
    body: "Trading firms, family offices, HNI desks and broker back-offices keeping their own books — same workflow, higher volume, internal.",
    quote:
      "Our prop desk’s trades close into books every month, not once at filing. We needed something that runs on a schedule.",
  },
  {
    icon: "trend",
    accent: "pos",
    title: "Serious traders",
    suffix: "· the wedge",
    body: "Active F&O / HNI investors who keep real books — often because 44AB applies — not just an annual ITR.",
    quote:
      "I’d rather hand my CA clean, ready books than a messy export they bill me extra hours to untangle.",
  },
];

/* ── Security & trust ── */
export const securityCards: { icon: "lock" | "cog" | "globe" | "shield"; title: string; desc: string }[] = [
  {
    icon: "lock",
    title: "No credentials",
    desc: "We never ask for your broker or Tally login. You upload an export; we hand back a file.",
  },
  {
    icon: "cog",
    title: "No AI training on your data",
    desc: "Client files are processed, never used to train models. Your books are yours.",
  },
  {
    icon: "globe",
    title: "India-hosted",
    desc: "Data stays in-country, encrypted in transit and at rest.",
  },
  {
    icon: "shield",
    title: "Audit traceability",
    desc: "Every voucher links to its source row and every override is logged.",
  },
];

/* ── Our approach ── */
export const approachItems: { kind: "today" | "roadmap"; label: string; text: string }[] = [
  {
    kind: "today",
    label: "Today:",
    text: "Zerodha Console → Tally Prime & ERP 9, equity & F&O.",
  },
  {
    kind: "roadmap",
    label: "On the roadmap:",
    text: "more brokers, once we can do each one to the same standard — not before.",
  },
];

/* ── Proof ── */
export const proofCards: { n: string; title: string; body: string; link?: boolean; tags?: string[] }[] = [
  {
    n: "01",
    title: "Run it on your own file",
    body: "Bring a real, messy client export. The output you get back is the only demo that should convince you.",
  },
  {
    n: "02",
    title: "We show the method",
    body: "Every treatment is documented and open above. Transparency is the trust signal — not a logo wall.",
    link: true,
  },
  {
    n: "03",
    title: "Real compatibility",
    body: "It imports into the tools you already run, with no lock-in.",
    tags: ["Tally Prime", "ERP 9", "Zerodha Console", "Excel"],
  },
];

/** Tailwind-friendly resolver for the tone tokens used across sections. */
export const toneVar: Record<Tone, string> = {
  action: "var(--action)",
  cyan: "var(--cyan)",
  warn: "var(--warn)",
  pos: "var(--pos)",
};
