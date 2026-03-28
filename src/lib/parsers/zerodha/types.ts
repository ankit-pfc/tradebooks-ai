/**
 * types.ts
 * Raw row types for each Zerodha file format.
 *
 * Numeric fields are stored as strings so callers can pass them directly to
 * `new Decimal(value)` without any intermediate coercion.  The parsers
 * validate that each string represents a finite number before returning rows.
 */

// ---------------------------------------------------------------------------
// Zerodha Tradebook
// ---------------------------------------------------------------------------

/**
 * One row from a Zerodha tradebook CSV or XLSX.
 *
 * Column mapping
 *   "Trade Date"           -> trade_date
 *   "Exchange"             -> exchange
 *   "Segment"              -> segment
 *   "Symbol/Scrip"         -> symbol
 *   "ISIN"                 -> isin
 *   "Trade Type"           -> trade_type
 *   "Quantity"             -> quantity     (numeric string)
 *   "Price"                -> price        (numeric string)
 *   "Trade ID"             -> trade_id
 *   "Order ID"             -> order_id
 *   "Order Execution Time" -> order_execution_time
 */
export interface ZerodhaTradebookRow {
  trade_date: string;
  exchange: string;
  segment: string;
  symbol: string;
  isin: string;
  /** "buy" or "sell" (normalised to lowercase) */
  trade_type: 'buy' | 'sell';
  /** Numeric string — safe to pass to `new Decimal(quantity)` */
  quantity: string;
  /** Numeric string — safe to pass to `new Decimal(price)` */
  price: string;
  trade_id: string;
  order_id: string;
  order_execution_time: string;
  /**
   * Product / order type marker from Zerodha.
   * - CNC: Cash & Carry (delivery / investment)
   * - MIS: Margin Intraday Square-off (intraday / speculative business)
   * - NRML: Normal (F&O carry-forward / non-speculative business)
   * - MTF: Margin Trading Facility (leveraged delivery)
   * Optional — absent in older CSV exports.
   */
  product?: 'CNC' | 'MIS' | 'NRML' | 'MTF';
  /** Series code (e.g. "EQ", "T") — present in XLSX exports, absent in CSV */
  series?: string;
  /** Auction flag (e.g. "False") — present in XLSX exports, absent in CSV */
  auction?: string;
  /** Pre-calculated amount (Quantity × Price) as numeric string — present in XLSX exports, absent in CSV */
  amount?: string;
}

// ---------------------------------------------------------------------------
// Zerodha Tax P&L
// ---------------------------------------------------------------------------

export interface ZerodhaTaxPnlExitRow {
  symbol: string;
  isin: string;
  entry_date: string;
  exit_date: string;
  /** Numeric string */
  quantity: string;
  /** Numeric string */
  buy_value: string;
  /** Numeric string */
  sell_value: string;
  /** Numeric string */
  profit: string;
  /** Period of holding in days as string */
  period_of_holding: string;
  /** Numeric string — fair market value for grandfathering */
  fair_market_value: string;
  /** Numeric string */
  taxable_profit: string;
  /** Numeric string */
  turnover: string;
}

export interface ZerodhaTaxPnlChargeRow {
  particulars: string;
  posting_date: string;
  /** Numeric string */
  debit: string;
  /** Numeric string */
  credit: string;
}

export interface ZerodhaTaxPnlDividendRow {
  symbol: string;
  isin: string;
  date: string;
  /** Numeric string */
  quantity: string;
  /** Numeric string */
  dividend_per_share: string;
  /** Numeric string */
  net_dividend_amount: string;
}

export interface ZerodhaTaxPnlEquitySummaryRow {
  symbol: string;
  /** Numeric string */
  quantity: string;
  /** Numeric string */
  buy_value: string;
  /** Numeric string */
  sell_value: string;
  /** Numeric string */
  realized_pnl: string;
}

export interface TaxPnlParseResult {
  exits: ZerodhaTaxPnlExitRow[];
  charges: ZerodhaTaxPnlChargeRow[];
  dividends: ZerodhaTaxPnlDividendRow[];
  equity_summary: ZerodhaTaxPnlEquitySummaryRow[];
  metadata: ParseMetadata;
}

// ---------------------------------------------------------------------------
// Zerodha AGTS (Aggregate Trade Summary)
// ---------------------------------------------------------------------------

export interface ZerodhaAgtsRow {
  symbol: string;
  exchange: string;
  segment: string;
  /** Numeric string */
  buy_quantity: string;
  /** Numeric string */
  buy_value: string;
  /** Numeric string */
  sell_quantity: string;
  /** Numeric string */
  sell_value: string;
}

export interface AgtsParseResult {
  rows: ZerodhaAgtsRow[];
  metadata: ParseMetadata;
}

// ---------------------------------------------------------------------------
// Zerodha Funds Statement
// ---------------------------------------------------------------------------

/**
 * One row from a Zerodha funds-statement CSV or XLSX.
 *
 * Column mapping
 *   "Posting Date"    -> posting_date
 *   "Segment"         -> segment
 *   "Description"     -> description
 *   "Debit"           -> debit           (numeric string)
 *   "Credit"          -> credit          (numeric string)
 *   "Running Balance" -> running_balance (numeric string)
 *   "Instrument"      -> instrument      (may be absent / empty)
 */
export interface ZerodhaFundsStatementRow {
  posting_date: string;
  segment: string;
  description: string;
  /** Numeric string — safe to pass to `new Decimal(debit)` */
  debit: string;
  /** Numeric string — safe to pass to `new Decimal(credit)` */
  credit: string;
  /** Numeric string — safe to pass to `new Decimal(running_balance)` */
  running_balance: string;
  /** Instrument name/symbol, or null when the column is absent or blank */
  instrument: string | null;
}

// ---------------------------------------------------------------------------
// Zerodha Holdings
// ---------------------------------------------------------------------------

/**
 * One row from a Zerodha holdings XLSX.
 *
 * Column mapping
 *   "Instrument" -> instrument
 *   "ISIN"       -> isin
 *   "Qty."       -> quantity        (numeric string)
 *   "Avg. cost"  -> avg_cost        (numeric string)
 *   "LTP"        -> ltp             (numeric string)
 *   "Cur. val"   -> current_value   (numeric string)
 *   "P&L"        -> pnl             (numeric string)
 *   "Net chg."   -> net_change      (numeric string)
 *   "Day chg."   -> day_change      (numeric string)
 */
export interface ZerodhaHoldingsRow {
  instrument: string;
  isin: string;
  /** Numeric string — safe to pass to `new Decimal(quantity)` */
  quantity: string;
  /** Numeric string — safe to pass to `new Decimal(avg_cost)` */
  avg_cost: string;
  /** Numeric string — safe to pass to `new Decimal(ltp)` */
  ltp: string;
  /** Numeric string — safe to pass to `new Decimal(current_value)` */
  current_value: string;
  /** Numeric string — safe to pass to `new Decimal(pnl)` */
  pnl: string;
  /** Numeric string — safe to pass to `new Decimal(net_change)` */
  net_change: string;
  /** Numeric string — safe to pass to `new Decimal(day_change)` */
  day_change: string;
}

// ---------------------------------------------------------------------------
// Shared metadata shape returned alongside every parse result
// ---------------------------------------------------------------------------

export interface ParseMetadata {
  /** Total number of data rows (excluding headers / metadata lines) */
  row_count: number;
  /**
   * ISO date strings for the earliest and latest date found in the file.
   * null when the file type does not carry date information (e.g. holdings).
   */
  date_range: { from: string; to: string } | null;
  /** Semver string of the parser that produced this result */
  parser_version: string;
}
