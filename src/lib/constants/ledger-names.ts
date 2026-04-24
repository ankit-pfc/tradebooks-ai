/**
 * ledger-names.ts
 * Single source of truth for all Tally ledger names and group assignments.
 *
 * Both voucher-builder.ts and ledger-masters.ts MUST import from here.
 * When a user provides their Tally Chart of Accounts, update the names here
 * and the entire pipeline will reflect the change.
 */

// ---------------------------------------------------------------------------
// Ledger name + group pairs
// ---------------------------------------------------------------------------

export interface LedgerDef {
  readonly name: string;
  readonly group: string;
}

// ---------------------------------------------------------------------------
// Broker / Bank
// ---------------------------------------------------------------------------

export const BROKER: LedgerDef = {
  name: 'Zerodha Broking',
  group: 'Sundry Creditors',
};

export const BANK: LedgerDef = {
  name: 'Bank Account',
  group: 'Bank Accounts',
};

export const OPENING_BALANCE_EQUITY: LedgerDef = {
  name: 'Opening Stock Balance B/F',
  group: 'Capital Account',
};

// ---------------------------------------------------------------------------
// Charges
// ---------------------------------------------------------------------------

export const BROKERAGE: LedgerDef = {
  name: 'Brokerage',
  group: 'Indirect Expenses',
};

export const STT: LedgerDef = {
  name: 'Securities Transaction Tax',
  group: 'Indirect Expenses',
};

export const EXCHANGE_CHARGES: LedgerDef = {
  name: 'Exchange Transaction Charges',
  group: 'Indirect Expenses',
};

export const SEBI_CHARGES: LedgerDef = {
  name: 'SEBI Turnover Fees',
  group: 'Indirect Expenses',
};

export const GST_ON_CHARGES: LedgerDef = {
  name: 'GST on Brokerage',
  group: 'Duties & Taxes',
};

export const STAMP_DUTY: LedgerDef = {
  name: 'Stamp Duty',
  group: 'Indirect Expenses',
};

export const DP_CHARGES: LedgerDef = {
  name: 'DP Charges',
  group: 'Indirect Expenses',
};

export const IPFT: LedgerDef = {
  name: 'IPFT',
  group: 'Indirect Expenses',
};

export const CLEARING_CHARGES: LedgerDef = {
  name: 'Clearing Charges',
  group: 'Indirect Expenses',
};

/** All charge ledgers in a convenient array. */
export const ALL_CHARGE_LEDGERS: readonly LedgerDef[] = [
  BROKERAGE,
  STT,
  EXCHANGE_CHARGES,
  SEBI_CHARGES,
  GST_ON_CHARGES,
  STAMP_DUTY,
  DP_CHARGES,
  IPFT,
  CLEARING_CHARGES,
] as const;

// ---------------------------------------------------------------------------
// Investment / Asset ledgers (Investor mode)
// ---------------------------------------------------------------------------

export const INVESTMENT_GROUP = 'Investments';
export const INVESTMENT_PREFIX = 'Investment in Equity Shares - ';

export function investmentLedger(symbol: string): LedgerDef {
  return {
    name: `${INVESTMENT_PREFIX}${symbol}`,
    group: INVESTMENT_GROUP,
  };
}

// ---------------------------------------------------------------------------
// Stock-in-Trade ledgers (Trader mode)
// ---------------------------------------------------------------------------

export const STOCK_IN_TRADE_GROUP = 'Stock-in-Hand';
export const STOCK_IN_TRADE_PREFIX = 'Shares-in-Trade - ';

export function stockInTradeLedger(symbol: string): LedgerDef {
  return {
    name: `${STOCK_IN_TRADE_PREFIX}${symbol}`,
    group: STOCK_IN_TRADE_GROUP,
  };
}

// ---------------------------------------------------------------------------
// P&L ledgers — Investor mode
// ---------------------------------------------------------------------------

export const STCG_PROFIT: LedgerDef = {
  name: 'Short Term Capital Gain on Sale of Shares',
  group: 'Indirect Incomes',
};

export const LTCG_PROFIT: LedgerDef = {
  name: 'Long Term Capital Gain on Sale of Shares',
  group: 'Indirect Incomes',
};

export const STCG_LOSS: LedgerDef = {
  name: 'Short Term Capital Loss on Sale of Shares',
  group: 'Indirect Expenses',
};

export const LTCG_LOSS: LedgerDef = {
  name: 'Long Term Capital Loss on Sale of Shares',
  group: 'Indirect Expenses',
};

/** Single unified ledger for speculative (intraday) gain AND loss.
 *  Both credit (gain) and debit (loss) entries go here so the net
 *  result is automatically visible in Tally under Indirect Incomes.
 */
export const SPECULATIVE_INCOME: LedgerDef = {
  name: 'Speculative Business Income',
  group: 'Indirect Incomes',
};

/** @deprecated Use SPECULATIVE_INCOME instead — kept for backward compat in tests. */
export const SPECULATIVE_PROFIT = SPECULATIVE_INCOME;
/** @deprecated Use SPECULATIVE_INCOME instead — kept for backward compat in tests. */
export const SPECULATIVE_LOSS = SPECULATIVE_INCOME;

// ---------------------------------------------------------------------------
// P&L ledgers — Trader mode
// ---------------------------------------------------------------------------

export const TRADING_SALES: LedgerDef = {
  name: 'Trading Sales',
  group: 'Sales Accounts',
};

export const COST_OF_SHARES_SOLD: LedgerDef = {
  name: 'Cost of Shares Sold',
  group: 'Purchase Accounts',
};

// ---------------------------------------------------------------------------
// Income ledgers
// ---------------------------------------------------------------------------

export const DIVIDEND_INCOME: LedgerDef = {
  name: 'Dividend Income',
  group: 'Indirect Incomes',
};

// ---------------------------------------------------------------------------
// Pooled ledgers (when LedgerStrategy = POOLED)
// ---------------------------------------------------------------------------

export const POOLED_INVESTMENT: LedgerDef = {
  name: 'Investment in Equity Shares',
  group: INVESTMENT_GROUP,
};

export const POOLED_STOCK_IN_TRADE: LedgerDef = {
  name: 'Shares-in-Trade',
  group: STOCK_IN_TRADE_GROUP,
};

// ---------------------------------------------------------------------------
// AMC / Misc
// ---------------------------------------------------------------------------

export const AMC_CHARGES: LedgerDef = {
  name: 'Demat AMC Charges',
  group: 'Indirect Expenses',
};

export const MISC_CHARGES: LedgerDef = {
  name: 'Miscellaneous Charges',
  group: 'Indirect Expenses',
};

// ===========================================================================
// Capital Account approach — used by individual ITR-2 filers
// ===========================================================================
// Indian accountants for individual investors place capital gains, dividends,
// STT, brokerage, and DP charges under Capital Account, not P&L.
// These constants reflect real Tally Chart of Accounts structures.

// ---------------------------------------------------------------------------
// Capital Account sub-group names
// ---------------------------------------------------------------------------

export const CA_STCG_GROUP = 'STCG';
export const CA_LTCG_GROUP = 'LTCG';
export const CA_STCL_GROUP = 'STCL';
export const CA_LTCL_GROUP = 'LTCL';
export const CA_DIVIDEND_GROUP = 'Div on Shares';
export const CA_SPECULATION_GROUP = 'Speculative Business Income';
export const CA_PARENT_GROUP = 'Capital Account';
export const CA_ZERODHA_INVESTMENT_GROUP = 'INVESTMENT IN SHARES-ZERODHA';

// ---------------------------------------------------------------------------
// Capital Account — Broker / Bank
// ---------------------------------------------------------------------------

export const CA_BROKER: LedgerDef = {
  name: 'ZERODHA - KITE',
  group: 'Sundry Creditors',
};

// ---------------------------------------------------------------------------
// Capital Account — Per-scrip template functions
// ---------------------------------------------------------------------------

export function caInvestmentLedger(symbol: string): LedgerDef {
  return { name: `${symbol}-SH`, group: CA_ZERODHA_INVESTMENT_GROUP };
}

export function caStcgLedger(symbol: string): LedgerDef {
  return { name: `STCG ON ${symbol}`, group: CA_STCG_GROUP };
}

export function caLtcgLedger(symbol: string): LedgerDef {
  return { name: `LTCG ON ${symbol}`, group: CA_LTCG_GROUP };
}

export function caStclLedger(symbol: string): LedgerDef {
  return { name: `STCL ON ${symbol}`, group: CA_STCL_GROUP };
}

export function caLtclLedger(symbol: string): LedgerDef {
  return { name: `LTCL ON ${symbol}`, group: CA_LTCL_GROUP };
}

export function caDividendLedger(symbol: string): LedgerDef {
  return { name: `DIV ${symbol}`, group: CA_DIVIDEND_GROUP };
}

// ---------------------------------------------------------------------------
// Capital Account — Consolidated charges
// ---------------------------------------------------------------------------

export const CA_BROKERAGE: LedgerDef = {
  name: 'SHARE BROKERAGE',
  group: CA_PARENT_GROUP,
};

export const CA_STT: LedgerDef = {
  name: 'Stt',
  group: CA_PARENT_GROUP,
};

export const CA_EXCHANGE_AND_OTHER: LedgerDef = {
  name: 'Exchange and Other Charges',
  group: CA_PARENT_GROUP,
};

export const CA_DP_CHARGES: LedgerDef = {
  name: 'DP Charges-Zerodha',
  group: CA_PARENT_GROUP,
};

export const CA_DEMAT_CHARGES: LedgerDef = {
  name: 'DEMAT CHARGES',
  group: CA_PARENT_GROUP,
};

export const CA_AMC_CHARGES: LedgerDef = {
  name: 'AMC CHARGES-ZERODHA',
  group: CA_PARENT_GROUP,
};

// ---------------------------------------------------------------------------
// Capital Account — Speculation (intraday)
// ---------------------------------------------------------------------------

// SINGLE intraday net ledger. Per bug report items #12 and #13: intraday
// gains and losses net off in the SAME Tally ledger, no separate gain/loss
// segregation. Gains are CR-side, losses are DR-side to the same ledger,
// producing a net position on the ledger.
export const CA_SPECULATION_GAIN: LedgerDef = {
  name: 'Intraday Gain on Sale of Shares - ZERODHA',
  group: CA_SPECULATION_GROUP,
};

/** @deprecated Aliased to CA_SPECULATION_GAIN — there is no separate loss
 *  ledger. Kept exported for backwards compatibility with profile overrides
 *  that may still reference the old name. */
export const CA_SPECULATION_LOSS: LedgerDef = CA_SPECULATION_GAIN;

export const CA_STT_INTRADAY: LedgerDef = {
  name: 'STT AND OTHER CHARGES-INTRADAY',
  group: CA_SPECULATION_GROUP,
};

// ---------------------------------------------------------------------------
// Capital Account — Dividends
// ---------------------------------------------------------------------------

export const CA_DIVIDEND_INCOME: LedgerDef = {
  name: 'DIVIDEND ON SHARES',
  group: CA_PARENT_GROUP,
};

// ---------------------------------------------------------------------------
// TDS ledgers
// ---------------------------------------------------------------------------

export const TDS_ON_DIVIDEND: LedgerDef = {
  name: 'TDS ON DIVIDEND',
  group: 'Duties & Taxes',
};

export const TDS_ON_SECURITIES: LedgerDef = {
  name: 'TDS on Securities',
  group: 'Duties & Taxes',
};

export const TDS_ON_FD_INTEREST: LedgerDef = {
  name: 'TDS on FD Interest',
  group: 'Duties & Taxes',
};

// ---------------------------------------------------------------------------
// Off-market suspense
// ---------------------------------------------------------------------------

export const OFF_MARKET_SUSPENSE: LedgerDef = {
  name: 'Off-Market Transfer Suspense',
  group: 'Suspense A/c',
};

/**
 * Suspense ledger for sells where the cost-lot tracker found no prior
 * purchase (uncovered disposal). Per FY21-22 review feedback: "we cannot
 * assume that it's a STCG … instead keep such incomplete transactions in
 * suspense with narration mentioning transaction details so that the
 * person can decide what they need to do". Used for:
 *   • Sells with no opening stock and no matching buy in the batch
 *     (e.g. IEX sold 30 on 07-07-21 when only the sell was imported).
 *   • Post-split sells whose pre-split lots were not carried forward
 *     (e.g. IRCTC 12-Nov-21 sells after the 1:5 face-value split).
 *   • Prior-year holdings that exist in Tally as opening balances but
 *     were never seeded into the pipeline's cost tracker (63MOONS,
 *     FIEMIND sells in FY22-23 after FY21-22 import).
 */
export const UNMATCHED_SELL_SUSPENSE: LedgerDef = {
  name: 'Unmatched Sell Suspense',
  group: 'Suspense A/c',
};

// ---------------------------------------------------------------------------
// Custom sub-groups required for Capital Account approach
// ---------------------------------------------------------------------------

export const CA_CUSTOM_GROUPS: ReadonlyArray<{ name: string; parent: string }> = [
  { name: CA_STCG_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_LTCG_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_STCL_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_LTCL_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_DIVIDEND_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_SPECULATION_GROUP, parent: 'Indirect Incomes' },
  { name: CA_ZERODHA_INVESTMENT_GROUP, parent: INVESTMENT_GROUP },
] as const;

// ---------------------------------------------------------------------------
// System ledger keys — shared between API routes and pipeline
// ---------------------------------------------------------------------------

export interface SystemLedgerEntry {
  readonly key: string;
  readonly name: string;
  readonly group: string;
}

export const SYSTEM_LEDGERS: readonly SystemLedgerEntry[] = [
  { key: 'BROKER', name: CA_BROKER.name, group: CA_BROKER.group },
  { key: 'BANK', name: BANK.name, group: BANK.group },
  { key: 'BROKERAGE', name: CA_BROKERAGE.name, group: CA_BROKERAGE.group },
  { key: 'STT', name: CA_STT.name, group: CA_STT.group },
  { key: 'EXCHANGE_CHARGES', name: CA_EXCHANGE_AND_OTHER.name, group: CA_EXCHANGE_AND_OTHER.group },
  { key: 'GST_ON_CHARGES', name: GST_ON_CHARGES.name, group: GST_ON_CHARGES.group },
  { key: 'STAMP_DUTY', name: STAMP_DUTY.name, group: STAMP_DUTY.group },
  { key: 'DP_CHARGES', name: CA_DP_CHARGES.name, group: CA_DP_CHARGES.group },
  { key: 'DEMAT_CHARGES', name: CA_DEMAT_CHARGES.name, group: CA_DEMAT_CHARGES.group },
  { key: 'AMC_CHARGES', name: CA_AMC_CHARGES.name, group: CA_AMC_CHARGES.group },
  { key: 'STCG_PROFIT', name: STCG_PROFIT.name, group: STCG_PROFIT.group },
  { key: 'LTCG_PROFIT', name: LTCG_PROFIT.name, group: LTCG_PROFIT.group },
  { key: 'STCG_LOSS', name: STCG_LOSS.name, group: STCG_LOSS.group },
  { key: 'LTCG_LOSS', name: LTCG_LOSS.name, group: LTCG_LOSS.group },
  // Single intraday net ledger (per bug report items #12, #13). Gains
  // post CR, losses post DR — both into the same Tally ledger so they net.
  // SPECULATIVE_LOSS as a system key is intentionally omitted: there is no
  // separate loss ledger. Override handlers in accounting-policy.ts still
  // accept SPECULATIVE_LOSS as an alias for backwards compat.
  { key: 'SPECULATIVE_PROFIT', name: CA_SPECULATION_GAIN.name, group: CA_SPECULATION_GAIN.group },
  { key: 'DIVIDEND_INCOME', name: CA_DIVIDEND_INCOME.name, group: CA_DIVIDEND_INCOME.group },
  { key: 'TDS_ON_DIVIDEND', name: TDS_ON_DIVIDEND.name, group: TDS_ON_DIVIDEND.group },
  { key: 'TDS_ON_SECURITIES', name: TDS_ON_SECURITIES.name, group: TDS_ON_SECURITIES.group },
  { key: 'OFF_MARKET_SUSPENSE', name: OFF_MARKET_SUSPENSE.name, group: OFF_MARKET_SUSPENSE.group },
  { key: 'UNMATCHED_SELL_SUSPENSE', name: UNMATCHED_SELL_SUSPENSE.name, group: UNMATCHED_SELL_SUSPENSE.group },
] as const;

/** Set of all system ledger keys for quick lookup. */
export const SYSTEM_LEDGER_KEYS = new Set(SYSTEM_LEDGERS.map((s) => s.key));

/** Map from uppercase system ledger name → system key, for matching imported Tally names. */
export const SYSTEM_LEDGER_NAME_TO_KEY = new Map(
  SYSTEM_LEDGERS.map((s) => [s.name.toUpperCase(), s.key]),
);
