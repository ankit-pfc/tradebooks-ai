/**
 * events.ts
 * Types for canonical financial events, security master data, and cost lots.
 * Monetary and quantity fields use string to preserve decimal precision at rest;
 * use decimal.js for arithmetic at runtime.
 */

import type { TradeClassification } from '../engine/trade-classifier';

/**
 * Exhaustive set of event categories that the engine can produce from broker data.
 * Trade events carry security/quantity; charge events carry charge_type/charge_amount.
 */
export enum EventType {
  BUY_TRADE = 'BUY_TRADE',
  SELL_TRADE = 'SELL_TRADE',
  BROKERAGE = 'BROKERAGE',
  STT = 'STT',
  EXCHANGE_CHARGE = 'EXCHANGE_CHARGE',
  SEBI_CHARGE = 'SEBI_CHARGE',
  GST_ON_CHARGES = 'GST_ON_CHARGES',
  STAMP_DUTY = 'STAMP_DUTY',
  DP_CHARGE = 'DP_CHARGE',
  BANK_RECEIPT = 'BANK_RECEIPT',
  BANK_PAYMENT = 'BANK_PAYMENT',
  DIVIDEND = 'DIVIDEND',
  TDS_ON_DIVIDEND = 'TDS_ON_DIVIDEND',
  TDS_ON_SECURITIES = 'TDS_ON_SECURITIES',
  CORPORATE_ACTION = 'CORPORATE_ACTION',
  BONUS_SHARES = 'BONUS_SHARES',
  STOCK_SPLIT = 'STOCK_SPLIT',
  RIGHTS_ISSUE = 'RIGHTS_ISSUE',
  MERGER_DEMERGER = 'MERGER_DEMERGER',
  OFF_MARKET_TRANSFER = 'OFF_MARKET_TRANSFER',
  AUCTION_ADJUSTMENT = 'AUCTION_ADJUSTMENT',
}

/**
 * Reference data for a tradeable security.
 * Populated from broker tradebooks and enriched via ISIN lookups where possible.
 */
export interface SecurityMaster {
  security_id: string;
  /** International Securities Identification Number (12-character alphanumeric). */
  isin: string | null;
  /** Exchange trading symbol (e.g. "RELIANCE", "NIFTY24JANFUT"). */
  symbol: string;
  /** Primary listing exchange (e.g. "NSE", "BSE", "MCX"). */
  exchange: string;
  /**
   * Broad instrument category.
   * E.g. "EQ", "FUT", "OPT", "ETF", "MF", "BOND".
   */
  instrument_type: string;
  /** Full security name as provided by the broker or exchange. */
  security_name: string;
}

/**
 * A normalised, broker-agnostic financial event produced by the parsing engine.
 * Each row in the broker tradebook / contract note maps to one or more canonical events.
 *
 * Monetary fields (gross_amount, rate, charge_amount) are decimal strings to avoid
 * floating-point rounding; convert with new Decimal(field) at runtime.
 */
export interface CanonicalEvent {
  event_id: string;
  import_batch_id: string;
  /** Categorised event kind driving accounting treatment. */
  event_type: EventType;
  /** Optional parser-derived trade routing hint for downstream accounting/export logic. */
  trade_classification?: TradeClassification;
  /** Optional raw broker product code (e.g. CNC, MIS, NRML, MTF) for narrow routing/review logic. */
  trade_product?: string;
  /** Trade / transaction date in ISO-8601 format ("YYYY-MM-DD"). */
  event_date: string;
  /** Settlement date in ISO-8601 format; may equal event_date for intraday. */
  settlement_date: string | null;
  /** Foreign key into SecurityMaster; null for fund/charge-only events.
   *  For equity, uses ISIN:xxx format when ISIN is available (cross-exchange matching).
   */
  security_id: string | null;
  /** Human-readable trading symbol (e.g. "RELIANCE", "HDFC") for ledger/stock naming.
   *  The security_id may be ISIN-based, so this field preserves the readable name.
   */
  security_symbol?: string | null;
  /** Signed quantity as a decimal string (positive = bought/received, negative = sold). */
  quantity: string;
  /** Per-unit rate / price as a decimal string. */
  rate: string;
  /** Total value before charges as a decimal string. */
  gross_amount: string;
  /**
   * Charge sub-category label for charge events (e.g. "STT", "GST").
   * Null for trade events.
   */
  charge_type: string | null;
  /** Charge amount as a decimal string; "0" for non-charge events. */
  charge_amount: string;
  /** FK to UploadedFile that is the primary source for this event. */
  source_file_id: string;
  /** Row IDs from RawBrokerRow that contributed to this event (may be multiple for splits). */
  source_row_ids: string[];
  /** Contract note number from the broker, if available. */
  contract_note_ref: string | null;
  /** Any other broker-assigned reference (order ID, trade ID, etc.). */
  external_ref: string | null;
  /**
   * Deterministic hash of the event's identifying fields.
   * Used for duplicate detection across re-imports of the same period.
   */
  event_hash: string;
}

/**
 * A parcel of shares acquired at a specific cost, used by FIFO / AVCO lot tracking.
 * open_quantity decreases as shares are sold; a lot is exhausted when it reaches "0".
 *
 * All quantity and cost fields are decimal strings; use decimal.js for arithmetic.
 */
export interface CostLot {
  cost_lot_id: string;
  security_id: string;
  /** Human-readable broker symbol when available. Used for carried FY ledgers. */
  security_symbol?: string | null;
  /** The BUY_TRADE canonical event that created this lot. */
  source_buy_event_id: string;
  /** Remaining unsold quantity as a decimal string. */
  open_quantity: string;
  /** Total quantity at lot creation as a decimal string. */
  original_quantity: string;
  /**
   * All-in cost per unit including capitalised charges, as a decimal string.
   * Used as the cost basis for P&L computation on disposal.
   */
  effective_unit_cost: string;
  /** Date the shares were acquired ("YYYY-MM-DD"). */
  acquisition_date: string;
  /**
   * Remaining total cost for this lot at 2dp precision, decremented on each
   * partial disposal. When the final units of a lot are consumed, this value
   * is used as the disposal cost instead of recalculating from unit_cost ×
   * quantity — preventing cumulative ₹0.01 rounding drift.
   *
   * Optional for backwards-compat with serialized lots created before this
   * field was added — CostLotTracker.fromJSON and _disposeFifo compute it
   * from effective_unit_cost × open_quantity when absent.
   */
  remaining_total_cost?: string;
}
