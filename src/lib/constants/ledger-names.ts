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

export const SPECULATIVE_PROFIT: LedgerDef = {
  name: 'Speculative Profit on Shares',
  group: 'Indirect Incomes',
};

export const SPECULATIVE_LOSS: LedgerDef = {
  name: 'Speculative Loss on Shares',
  group: 'Indirect Expenses',
};

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
export const CA_SPECULATION_GROUP = 'Speculation Business';
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

export const CA_SPECULATION_GAIN: LedgerDef = {
  name: 'Intraday Gain on Sale of Shares - ZERODHA',
  group: CA_SPECULATION_GROUP,
};

export const CA_SPECULATION_LOSS: LedgerDef = {
  name: 'Intraday Loss on Sale of Shares - ZERODHA',
  group: CA_SPECULATION_GROUP,
};

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

// ---------------------------------------------------------------------------
// Custom sub-groups required for Capital Account approach
// ---------------------------------------------------------------------------

export const CA_CUSTOM_GROUPS: ReadonlyArray<{ name: string; parent: string }> = [
  { name: CA_STCG_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_LTCG_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_STCL_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_LTCL_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_DIVIDEND_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_SPECULATION_GROUP, parent: CA_PARENT_GROUP },
  { name: CA_ZERODHA_INVESTMENT_GROUP, parent: INVESTMENT_GROUP },
] as const;
