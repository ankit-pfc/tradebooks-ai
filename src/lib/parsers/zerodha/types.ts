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
// Zerodha Holdings (actual XLSX format from Console reports)
// ---------------------------------------------------------------------------

/**
 * One row from a Zerodha holdings XLSX (Equity sheet).
 *
 * Column mapping (data starts in column B):
 *   "Symbol"                  -> symbol
 *   "ISIN"                    -> isin
 *   "Sector"                  -> sector
 *   "Quantity Available"      -> quantity_available    (numeric string)
 *   "Quantity Discrepant"     -> quantity_discrepant   (numeric string)
 *   "Quantity Long Term"      -> quantity_long_term    (numeric string)
 *   "Quantity Pledged (Margin)" -> quantity_pledged_margin (numeric string)
 *   "Quantity Pledged (Loan)" -> quantity_pledged_loan (numeric string)
 *   "Average Price"           -> average_price         (numeric string)
 *   "Previous Closing Price"  -> previous_closing_price (numeric string)
 *   "Unrealized P&L"          -> unrealized_pnl        (numeric string)
 *   "Unrealized P&L Pct."     -> unrealized_pnl_pct    (numeric string)
 */
export interface ZerodhaHoldingsRow {
  symbol: string;
  isin: string;
  sector: string;
  quantity_available: string;
  quantity_discrepant: string;
  quantity_long_term: string;
  quantity_pledged_margin: string;
  quantity_pledged_loan: string;
  average_price: string;
  previous_closing_price: string;
  unrealized_pnl: string;
  unrealized_pnl_pct: string;
}

export interface HoldingsParseResult {
  equity: ZerodhaHoldingsRow[];
  mutual_funds: ZerodhaMFHoldingsRow[];
  metadata: ParseMetadata;
}

/**
 * One row from the Mutual Funds sheet of Zerodha holdings XLSX.
 */
export interface ZerodhaMFHoldingsRow {
  symbol: string;
  isin: string;
  instrument_type: string;
  quantity_available: string;
  quantity_discrepant: string;
  quantity_pledged_margin: string;
  quantity_pledged_loan: string;
  average_price: string;
  previous_closing_price: string;
  unrealized_pnl: string;
  unrealized_pnl_pct: string;
}

// ---------------------------------------------------------------------------
// Zerodha Ledger
// ---------------------------------------------------------------------------

export interface ZerodhaLedgerRow {
  particulars: string;
  posting_date: string;
  cost_center: string;
  voucher_type: string;
  debit: string;
  credit: string;
  net_balance: string;
}

export interface LedgerParseResult {
  rows: ZerodhaLedgerRow[];
  opening_balance: string;
  metadata: ParseMetadata;
}

// ---------------------------------------------------------------------------
// Zerodha Contract Notes
// ---------------------------------------------------------------------------

export interface ZerodhaContractNoteTradeRow {
  order_no: string;
  order_time: string;
  trade_no: string;
  trade_time: string;
  security_description: string;
  buy_sell: 'B' | 'S';
  quantity: string;
  exchange: string;
  gross_rate: string;
  brokerage_per_unit: string;
  net_rate: string;
  net_total: string;
  segment: string;
}

export interface ZerodhaContractNoteCharges {
  contract_note_no: string;
  trade_date: string;
  settlement_no: string;
  pay_in_pay_out: string;
  brokerage: string;
  exchange_charges: string;
  clearing_charges: string;
  cgst: string;
  sgst: string;
  igst: string;
  stt: string;
  sebi_fees: string;
  stamp_duty: string;
  net_amount: string;
}

export interface ContractNoteParseResult {
  trades: ZerodhaContractNoteTradeRow[];
  charges: ZerodhaContractNoteCharges[];
  /** Number of trades per sheet, in the same order as charges[]. */
  tradesPerSheet: number[];
  metadata: ParseMetadata;
}

// ---------------------------------------------------------------------------
// Zerodha Dividends (standalone file)
// ---------------------------------------------------------------------------

export interface ZerodhaDividendRow {
  symbol: string;
  isin: string;
  ex_date: string;
  quantity: string;
  dividend_per_share: string;
  net_dividend_amount: string;
}

export interface DividendsParseResult {
  rows: ZerodhaDividendRow[];
  metadata: ParseMetadata;
}

// ---------------------------------------------------------------------------
// Corporate Actions (manual input — not parsed from Zerodha exports)
// ---------------------------------------------------------------------------

export interface CorporateActionInput {
  action_type: 'BONUS' | 'STOCK_SPLIT' | 'RIGHTS_ISSUE' | 'MERGER_DEMERGER';
  security_id: string;
  action_date: string;
  /** Numerator of the ratio (e.g. 3 for 1:2 bonus means 3 shares for every 2 held) */
  ratio_numerator: string;
  /** Denominator of the ratio (e.g. 2 for 1:2 bonus) */
  ratio_denominator: string;
  /** For merger/demerger: the new security to receive lots */
  new_security_id?: string;
  /** For rights issue: the subscription/issue price per share */
  cost_per_share?: string;
  notes?: string;
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
