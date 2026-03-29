export interface GlossaryTerm {
  slug: string;
  title: string;
  metaDescription: string;
  shortDefinition: string;
  detailedExplanation: string; // HTML format for easy rendering
  targetAudience: "CA" | "Trader" | "Both";
  relatedTerms: string[];
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    slug: "what-is-stcg-ltcg-in-tally",
    title: "What is STCG and LTCG in Tally? | Tradebooks AI",
    metaDescription: "Understand Short-Term (STCG) and Long-Term Capital Gains (LTCG) in the context of Tally, holding periods, and tax rates for Indian equity, mutual funds, and F&O trading.",
    shortDefinition: "Capital gains are profits earned from the sale of assets like stocks and mutual funds. Short-Term Capital Gains (STCG) apply to assets held for a shorter period (typically ≤ 12 months for equity), while Long-Term Capital Gains (LTCG) apply to assets held longer, often qualifying for different tax rates under the Income Tax Act.",
    detailedExplanation: `
      <h2>Holding Period Rules for STCG vs. LTCG</h2>
      <p>For Indian tax purposes, the classification between STCG and LTCG depends on the holding period of the asset:</p>
      <ul>
        <li><strong>Equity Shares & Equity Mutual Funds:</strong> If held for 12 months or less, the gain is STCG. If held for more than 12 months, the gain is LTCG.</li>
        <li><strong>Other Assets (e.g., Unlisted Shares, Property):</strong> The threshold is typically 24 months.</li>
      </ul>
      <h2>Tax Rates under the New Budget</h2>
      <p>As per recent provisions (always verify the latest Finance Act):</p>
      <ul>
        <li><strong>STCG on Listed Equity:</strong> Taxed at a flat rate of 20% (Sec 111A).</li>
        <li><strong>LTCG on Listed Equity:</strong> Taxed at 12.5% on gains exceeding ₹1.25 lakh per financial year (Sec 112A).</li>
      </ul>
      <h2>Accounting for STCG & LTCG in Tally</h2>
      <p>When computing capital gains in Tally, it's critical to accurately group your direct/indirect incomes and maintain precise cost basis ledgers. Automating broker contract note imports (like Zerodha to Tally) specifically calculates holding periods on a FIFO basis to correctly classify gains, saving CAs significant manual effort.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["fifo-cost-basis", "business-income-vs-capital-gains"],
  },
  {
    slug: "zerodha-tradebook-explanation",
    title: "Understanding the Zerodha Tradebook for CAs | Tradebooks AI",
    metaDescription: "A comprehensive guide on the Zerodha tradebook report, how to download it, and how tax professionals use it to automate Tally entries and audit retail traders.",
    shortDefinition: "The Zerodha Tradebook is an official ledger of all executed buy and sell orders in an investor's account across various segments (Equity, F&O, Currency, Commodity) within a specific date range.",
    detailedExplanation: `
      <h2>Why is the Tradebook Important?</h2>
      <p>Unlike the P&L statement, which provides consolidated figures, the Tradebook offers a granular, execution-level breakdown. It contains essential fields like Trade Date, Scrip Name, Quantity, Trade Price, Trade Type (Buy/Sell), and Order ID. This granularity makes it the primary source document for rigorous financial audits and cost-basis computations.</p>
      <h2>Challenges for CAs using Tradebooks</h2>
      <ul>
        <li><strong>Volume of Transactions:</strong> Intraday and F&O traders can generate thousands of lines, impossible to manually punch into accounting software like Tally.</li>
        <li><strong>Missing Meta-Data:</strong> Broker exports don't come pre-mapped to chart of accounts, requiring complex transformations.</li>
      </ul>
      <h2>Tradebook to Tally Automation</h2>
      <p>Tools like Tradebooks AI ingest raw Zerodha Tradebook CSV/Excel files, classify transactions by segment (intraday, delivery, derivatives), applying FIFO-logic to calculate basis, and generate Tally-compliant XML vouchers for seamless import.</p>
    `,
    targetAudience: "Both",
    relatedTerms: ["zerodha-contract-note-tally"],
  },
  {
    slug: "fifo-cost-basis",
    title: "FIFO Cost Basis & Capital Gains Calculation | Tradebooks AI",
    metaDescription: "Learn how the First-In, First-Out (FIFO) method is applied in Indian taxation for calculating cost basis on stock and mutual fund investments.",
    shortDefinition: "FIFO (First-In, First-Out) is an accounting method mandated for determining the cost basis of investment holdings. It assumes that the first shares purchased are the first shares sold when calculating realized gains or losses.",
    detailedExplanation: `
      <h2>How FIFO Calculation Works in Demat Accounts</h2>
      <p>If you purchase 100 shares of Reliance at ₹2,500 in January and another 100 shares at ₹2,600 in March, and then sell 50 shares in July, the FIFO method dictates that the 50 sold shares are drawn from the January lot. Your cost basis for those 50 shares is ₹2,500.</p>
      <h2>Tax Implications of FIFO</h2>
      <p>By enforcing FIFO, the Income Tax Department standardizes how the holding period is calculated. This strictly determines whether the realized profit is categorized as a Short-Term Capital Gain (STCG) or Long-Term Capital Gain (LTCG).</p>
      <h2>FIFO in Automated Tally Accounting</h2>
      <p>For CAs and accountants, running a manual FIFO check across multiple partial sells/buys over a financial year is highly error-prone. Modern accounting tools parse historical trade records, simulate the FIFO queue, and output precise gain ledgers directly into Tally XML formats.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["what-is-stcg-ltcg-in-tally"],
  },
  {
    slug: "intraday-trading-taxation",
    title: "Intraday Trading Taxation rules for Indian Traders | Tradebooks AI",
    metaDescription: "Understand how speculative business income from intraday trading is taxed in India. Learn the compliance and audit requirements for intraday traders.",
    shortDefinition: "In India, income generated from intraday equity trading (buying and selling stocks on the same day without taking delivery) is classified as Speculative Business Income under Section 43(5) of the Income Tax Act.",
    detailedExplanation: `
      <h2>Capital Gains vs. Speculative Business Income</h2>
      <p>While delivery-based stock investments yield Capital Gains, intraday profits/losses are considered Speculative Business Income. They are added to the taxpayer's total income and taxed at applicable slab rates.</p>
      <h2>Loss Carry-forward Rules</h2>
      <p>A crucial rule in Indian taxation is that speculative business losses can only be set off against speculative business profits. Unlike short-term capital losses, they cannot be offset against ordinary business income or salary. Furthermore, speculative losses can only be carried forward for 4 subsequent assessment years.</p>
      <h2>Tax Audit Applicability</h2>
      <p>If the trading turnover (calculated as the sum of absolute profits and losses) exceeds ₹10 Crores (subject to 95% digital transactions criteria), a tax audit under Section 44AB becomes mandatory. Even if turnover is below the limit, an audit may be required if the trader declares a profit lower than the presumptive taxation scheme layout (if applicable) or carries over business losses.</p>
    `,
    targetAudience: "Both",
    relatedTerms: ["business-income-vs-capital-gains", "fno-turnover-audit-tally"],
  },
  {
    slug: "fno-turnover-audit-tally",
    title: "F&O Turnover Calculation & Audit compliance | Tradebooks AI",
    metaDescription: "Learn how Futures and Options (F&O) turnover is calculated in India, when tax audits apply, and how to record these non-speculative trades in Tally.",
    shortDefinition: "Futures and Options (F&O) trading is classified as Non-Speculative Business Income. The turnover for F&O is specifically calculated as the aggregate of absolute profits and absolute losses from all trades during the year.",
    detailedExplanation: `
      <h2>The Turnover Calculation Formula</h2>
      <p>Unlike equity delivery turnover (which focuses on sell value), F&O turnover calculation is unique:</p>
      <ul>
        <li>Sum of total favorable differences (Profits)</li>
        <li>Sum of total unfavorable differences (Losses - taken as an absolute positive figure)</li>
        <li>Premium received on sale of options is also included</li>
      </ul>
      <h2>When is a Tax Audit Mandatory?</h2>
      <p>If the F&O trading turnover exceeds ₹10 Crores (assuming 95% of transactions are via banking channels), a tax audit by a CA is mandatory. However, traders often fall into audit criteria at lower thresholds if they want to carry forward F&O business losses and their total income exceeds the basic exemption limit.</p>
      <h2>Accounting F&O in Tally</h2>
      <p>Recording individual F&O legs in Tally is notoriously difficult due to MTM (Mark-to-Market) settlements and option premiums. The best practice is to pass consolidated net profit/loss journal vouchers matched with ledger balances, utilizing broker tax P&L reports for precise figures.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["intraday-trading-taxation"],
  },
  {
    slug: "zerodha-contract-note-tally",
    title: "Importing Zerodha Contract Notes into Tally | Tradebooks AI",
    metaDescription: "Guide on parsing Zerodha Contract Notes and integrating transaction details, STT, brokerage, and GST data natively into Tally ERP/Prime.",
    shortDefinition: "A Contract Note is the legal record of any transaction on a stock exchange. Importing Zerodha Contract Notes into Tally ensures that brokerage, GST, STT, and stamp duty are accurately capitalized into the asset cost or booked as expenses.",
    detailedExplanation: `
      <h2>The Importance of the Contract Note</h2>
      <p>For a Chartered Accountant, the contract note is the highest fidelity document. While a tradebook only lists the trade price, the contract note lists all statutory levies. If these levies (like brokerage on delivery) are not capitalized into the cost of the share, the resulting capital gains calculations will be fundamentally incorrect.</p>
      <h2>Components of a Contract Note to account for:</h2>
      <ul>
        <li><strong>Securities Transaction Tax (STT):</strong> Not a deductible expense for Capital Gains, but claimable for Business Income.</li>
        <li><strong>Brokerage & GST:</strong> Needs separate expense ledger tracking.</li>
        <li><strong>Stamp Duty & Exchange Charges.</strong></li>
      </ul>
      <h2>Automation Workflows</h2>
      <p>Tradebooks AI bypasses PDFs by utilizing the raw Tradebook alongside charge settlement files to mathematically reverse-engineer contract note data, providing a clean Tally XML output that categorizes investments vs. expenses automatically.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["zerodha-tradebook-explanation"],
  },
  {
    slug: "tax-loss-harvesting-india",
    title: "Tax Loss Harvesting for Indian Investors | Tradebooks AI",
    metaDescription: "What is Tax Loss Harvesting? Discover how Indian traders utilize this strategy under the Income Tax Act to minimize liability on realized capital gains.",
    shortDefinition: "Tax Loss Harvesting is a legal strategy involving selling securities at a loss to offset a capital gains tax liability realized from selling other profitable assets within the same financial year.",
    detailedExplanation: `
      <h2>How Tax Loss Harvesting Reduces Liability</h2>
      <p>If you have booked ₹2,000,000 in Short Term Capital Gains (STCG) in a financial year, you will owe 20% tax on those gains. However, if you hold other stocks currently trading ₹50,000 below your purchase price, you can sell them before March 31st to realize that loss. Your net taxable STCG drops to ₹1,50,000. You can then immediately repurchase those same valid stocks the next day to maintain your portfolio asset allocation.</p>
      <h2>Crucial Rules for Set-Off in India</h2>
      <ul>
        <li><strong>Short-Term Capital Losses (STCL):</strong> Can be set off against both STCG and LTCG.</li>
        <li><strong>Long-Term Capital Losses (LTCL):</strong> Can ONLY be set off against LTCG. You cannot offset long term losses against short term gains.</li>
      </ul>
      <h2>Carry Forward rules</h2>
      <p>Unabsorbed capital losses can be carried forward for 8 assessment years, provided the income tax return is filed before the due date (Section 139(1)). Tracking these carryovers year-over-year in Tally requires meticulous ledger maintenance.</p>
    `,
    targetAudience: "Both",
    relatedTerms: ["what-is-stcg-ltcg-in-tally"],
  },
  {
    slug: "delivery-vs-intraday-tally",
    title: "Delivery vs. Intraday Trading: Tally Accounting Guide",
    metaDescription: "Understand the structural accounting differences between delivery trading (capital gains) and intraday trading (speculative business) for Tally entries.",
    shortDefinition: "Delivery trades involve taking actual ownership of a security in your Demat account (assessed as Capital Gains/Investments). Intraday trades are squared off on the same day without taking delivery (assessed as Speculative Business Income).",
    detailedExplanation: `
      <h2>Structural Differences in Accounting</h2>
      <p>Because the Income Tax Act treats these two activities differently, your Chart of Accounts in Tally must reflect that separation:</p>
      <ul>
        <li><strong>Delivery Trading:</strong> Requires Investment ledgers (under 'Investments'). Buying/Selling goes to trading/capital gains ledgers. STT is capitalized or ignored as expense based on non-business status.</li>
        <li><strong>Intraday Speculation:</strong> Requires P&L ledgers (under 'Direct Incomes / Direct Expenses'). Here, STT and Brokerage are valid business expenses and can be claimed to reduce taxable speculative profit.</li>
      </ul>
      <h2>Reconciliation Challenges</h2>
      <p>A single broker account (e.g., Zerodha) will merge both activities into a single bank payout/payin ledger. Reconciling a single bank entry against dozens of delivery capital gains and hundreds of speculative intraday lines is manually intensive. Specialized automation software acts as the middleware ensuring these streams are separated before the XML reaches Tally.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["intraday-trading-taxation"],
  },
  {
    slug: "business-income-vs-capital-gains",
    title: "Classifying Trading as Business Income vs Capital Gains",
    metaDescription: "A guide for CAs on determining when a client's share trading frequency transitions from Capital Gains (Investment) to Business Income (Trading).",
    shortDefinition: "The classification dispute between 'Investor' (Capital Gains) and 'Trader' (Business Income) depends on intention, frequency of trades, volume, and holding period, guided by CBDT circulars.",
    detailedExplanation: `
      <h2>The CBDT Demarcation</h2>
      <p>The Central Board of Direct Taxes (CBDT) issued clarifications to reduce litigation on this matter. A taxpayer can hold two separate portfolios: one for investment (capital gains) and one for trading (business income). However, consistency is strictly required. You cannot treat a specific security as an investment one year and stock-in-trade the next just to minimize tax liability.</p>
      <h2>Why the Distinction Matters</h2>
      <ul>
        <li><strong>Tax Rates:</strong> Capital Gains enjoy concessional rates (12.5% for LTCG, 20% for STCG on equities). Business Income is taxed at standard slab rates (up to 30%+).</li>
        <li><strong>Allowable Expenses:</strong> A 'Trader' can deduct STT, internet charges, advisory fees, and computer depreciation. An 'Investor' can only deduct transfer expenses like brokerage (STT is explicitly disallowed).</li>
      </ul>
      <h2>Audit Trails</h2>
      <p>CAs recommending Business Income classification for high-volume delivery clients must maintain rigorous ledgers (Stock-in-Trade) in Tally to prove to assessing officers that the activity constitutes a systematic business operation.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["intraday-trading-taxation", "delivery-vs-intraday-tally"],
  },
  {
    slug: "tally-xml-voucher-import",
    title: "Understanding Tally XML Voucher Imports | Tradebooks AI",
    metaDescription: "Detailed guide on how Tally XML works, the structure of a generic XML voucher, and how it automates bulk broker trade data imports.",
    shortDefinition: "Tally XML is the standard data exchange format used to import and export accounting data (Masters and Vouchers) into Tally ERP 9 and Tally Prime programmatically without manual data entry.",
    detailedExplanation: `
      <h2>Why use XML over Excel?</h2>
      <p>While Tally has basic Excel import utilities, XML allows for high-fidelity multi-line journal vouchers with exact cost-center tagging, bill-wise details, and intricate credit/debit combinations. For automated platforms like Tradebooks AI, constructing an XML payload is the safest way to guarantee compliance with Tally's internal database rules.</p>
      <h2>Anatomy of a Tally XML Voucher</h2>
      <p>A standard import payload wraps <code>&lt;VOUCHER&gt;</code> tags inside a <code>&lt;TALLYMESSAGE&gt;</code> envelope. Crucial fields include:</p>
      <ul>
        <li><code>VCHTYPE</code> (e.g., Journal, Receipt)</li>
        <li><code>DATE</code></li>
        <li><code>NARRATION</code></li>
        <li><code>ALLLEDGERENTRIES.LIST</code> (containing individual LedgerNames, Amounts, and ISDEEMEDPOSITIVE flags for Dr/Cr classification)</li>
      </ul>
      <h2>Bulk Broker Integration</h2>
      <p>Instead of manually making thousands of entries for a client's active Zerodha account, a CA simply uploads the raw tradebook into an ingestion engine, which computes FIFO, segregates STCG/LTCG, and then returns a perfectly formatted <code>.xml</code> file ready to be synced to Tally Prime.</p>
    `,
    targetAudience: "CA",
    relatedTerms: ["zerodha-tradebook-explanation"],
  }
];
