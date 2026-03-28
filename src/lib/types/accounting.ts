/**
 * accounting.ts
 * Types for accounting profiles and ledger mappings.
 * These drive how canonical events are transformed into Tally vouchers.
 */

import type { EventType } from './events';

/**
 * High-level accounting treatment mode for the client.
 * - INVESTOR: capital gains treatment; securities held as investments.
 * - TRADER: business income treatment; securities treated as stock-in-trade.
 */
export enum AccountingMode {
  INVESTOR = 'INVESTOR',
  TRADER = 'TRADER',
}

/**
 * How transaction charges (brokerage, STT, etc.) are accounted for.
 * - CAPITALIZE: add charges to the cost / reduce proceeds, adjusting cost basis.
 * - EXPENSE: book charges directly to a P&L expense ledger.
 * - HYBRID: capitalise some charge types, expense others (driven by per-event-type rules).
 */
export enum ChargeTreatment {
  CAPITALIZE = 'CAPITALIZE',
  EXPENSE = 'EXPENSE',
  HYBRID = 'HYBRID',
}

/**
 * Controls how granular each Tally voucher is.
 * - TRADE_LEVEL: one voucher per individual trade event.
 * - CONTRACT_NOTE_LEVEL: one voucher per contract note (groups trades settled together).
 * - DAILY_SUMMARY_BY_SCRIPT: one voucher per security per day.
 * - DAILY_SUMMARY_POOLED: one combined voucher for all trades in a day.
 */
export enum VoucherGranularity {
  TRADE_LEVEL = 'TRADE_LEVEL',
  CONTRACT_NOTE_LEVEL = 'CONTRACT_NOTE_LEVEL',
  DAILY_SUMMARY_BY_SCRIPT = 'DAILY_SUMMARY_BY_SCRIPT',
  DAILY_SUMMARY_POOLED = 'DAILY_SUMMARY_POOLED',
}

/**
 * Controls whether a separate Tally ledger is maintained per security.
 * - SCRIPT_LEVEL: individual ledger for each security (e.g. "Reliance Industries - Shares").
 * - POOLED: a single pooled ledger for all securities under the same asset class.
 */
export enum LedgerStrategy {
  SCRIPT_LEVEL = 'SCRIPT_LEVEL',
  POOLED = 'POOLED',
}

/**
 * Algorithm used to determine cost basis when matching buys to sells.
 * - FIFO: First-In First-Out — oldest lots are consumed first.
 * - WEIGHTED_AVERAGE: cost is the running weighted average across all open lots.
 */
export enum CostBasisMethod {
  FIFO = 'FIFO',
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
}

/** Rules for rounding monetary values in generated vouchers. */
export interface RoundingRules {
  /** Number of decimal places to round monetary amounts to (typically 2). */
  decimal_places: number;
}

/**
 * An accounting profile captures all configuration choices that govern how
 * a client's trades are transformed into Tally vouchers.
 * Multiple clients can share a profile, or each can have their own.
 */
export interface AccountingProfile {
  accounting_profile_id: string;
  /** Human-readable label shown in the UI (e.g. "Retail Investor - FY2025"). */
  profile_name: string;
  /** Investor vs. Trader accounting treatment. */
  mode: AccountingMode;
  /** How transaction charges are handled. */
  charge_treatment: ChargeTreatment;
  /** How granular each exported voucher should be. */
  voucher_granularity: VoucherGranularity;
  /** Whether to use per-security or pooled ledgers. */
  ledger_strategy: LedgerStrategy;
  /** Algorithm for matching buy lots to sell events. */
  cost_basis_method: CostBasisMethod;
  /** Rounding configuration applied when generating voucher line amounts. */
  rounding_rules: RoundingRules;
}

/**
 * Maps a specific event type to the Tally ledger it should be posted to,
 * within the context of a particular accounting profile.
 * One profile will have multiple mappings (one per EventType variant it handles).
 */
export interface LedgerMapping {
  ledger_mapping_id: string;
  accounting_profile_id: string;
  /** The canonical event type this mapping applies to. */
  event_type: EventType;
  /** Exact name of the Tally ledger to post to (must match Tally master exactly). */
  tally_ledger_name: string;
  /** Tally ledger group for auto-creation if the ledger does not yet exist. */
  tally_group_name: string;
  /** Whether this event type is debited or credited in the voucher entry. */
  debit_credit_rule: 'DR' | 'CR';
  /**
   * When true and ledger_strategy is SCRIPT_LEVEL, the ledger name is suffixed with
   * the security symbol to produce per-script ledgers (e.g. "Reliance Industries - Shares").
   */
  script_level_flag: boolean;
}

// ---------------------------------------------------------------------------
// Tally Profile — controls how canonical concepts map to Tally names/groups
// ---------------------------------------------------------------------------

/** Capital gain classification. */
export type GainType = 'STCG' | 'LTCG' | 'STCL' | 'LTCL';

/** A ledger name + group pair. */
export interface LedgerDef {
  readonly name: string;
  readonly group: string;
}

/**
 * A naming template with token substitution for per-scrip ledgers.
 * Tokens: {symbol} = exchange trading symbol (e.g. "RELIANCE").
 */
export interface NamingTemplate {
  /** Template string, e.g. "STCG ON {symbol}", "{symbol}-SH". */
  template: string;
  /** Tally group the resolved ledger belongs to. */
  group: string;
  /** If the group is a custom sub-group, its parent group in Tally. */
  parentGroup?: string;
}

/**
 * Maps one or more charge EventTypes to a single consolidated Tally ledger.
 * Real accountants use 2-3 charge ledgers, not 8.
 */
export interface ChargeConsolidation {
  /** Charge event types that roll into this ledger. */
  eventTypes: EventType[];
  /** The Tally ledger name. */
  ledgerName: string;
  /** The Tally group. */
  groupName: string;
}

/**
 * Controls how canonical events map to actual Tally ledger names and group
 * hierarchy for a specific client's Tally company.
 *
 * Separates the "what accounting entries to make" concern (AccountingProfile)
 * from "what to call them in Tally" concern (TallyProfile).
 */
export interface TallyProfile {
  id: string;
  name: string;

  // --- Fixed ledger overrides ---
  broker: LedgerDef;
  bank: LedgerDef;

  // --- Per-scrip naming templates ---
  investment: NamingTemplate;
  stcg: NamingTemplate;
  ltcg: NamingTemplate;
  stcl: NamingTemplate;
  ltcl: NamingTemplate;
  dividend: NamingTemplate;
  speculationGain: LedgerDef;
  speculationLoss: LedgerDef;

  // --- Charge mapping ---
  chargeConsolidation: ChargeConsolidation[];

  // --- TDS ---
  tdsOnDividend: LedgerDef;
  tdsOnSecurities: LedgerDef;

  // --- Sub-groups that need to be created before ledgers ---
  customGroups: Array<{ name: string; parent: string }>;

  // --- Flags ---
  /** When true, each sold security gets its own STCG/LTCG ledger. */
  perScripCapitalGains: boolean;
  /** When true, each security's dividend gets its own DIV ledger. */
  perScripDividends: boolean;
}
