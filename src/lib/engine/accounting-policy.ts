/**
 * accounting-policy.ts
 * Default accounting profiles and ledger mappings for Investor and Trader modes.
 *
 * Profiles are pure configuration objects — no database I/O here.
 * The engine imports these as sensible defaults that can be overridden per client.
 */

import {
  AccountingMode,
  ChargeTreatment,
  VoucherGranularity,
  LedgerStrategy,
  CostBasisMethod,
  type AccountingProfile,
  type LedgerMapping,
} from '../types/accounting';
import { EventType } from '../types/events';

// ---------------------------------------------------------------------------
// Default profiles
// ---------------------------------------------------------------------------

/**
 * Default profile for a retail investor.
 * - Securities held as capital assets (investments).
 * - Buy charges capitalised into cost basis; sell charges expensed.
 * - FIFO cost-basis method.
 * - One voucher per security per day (DAILY_SUMMARY_BY_SCRIPT).
 * - Individual ledger per script (SCRIPT_LEVEL).
 */
export const INVESTOR_DEFAULT: AccountingProfile = {
  accounting_profile_id: 'investor-default',
  profile_name: 'Retail Investor — Default',
  mode: AccountingMode.INVESTOR,
  charge_treatment: ChargeTreatment.HYBRID, // buy=CAPITALIZE, sell=EXPENSE
  voucher_granularity: VoucherGranularity.DAILY_SUMMARY_BY_SCRIPT,
  ledger_strategy: LedgerStrategy.SCRIPT_LEVEL,
  cost_basis_method: CostBasisMethod.FIFO,
  rounding_rules: { decimal_places: 2 },
};

/**
 * Default profile for a trader (business income treatment).
 * - Securities treated as stock-in-trade.
 * - All charges expensed directly to P&L.
 * - FIFO cost-basis method.
 * - One voucher per security per day.
 * - Individual ledger per script.
 */
export const TRADER_DEFAULT: AccountingProfile = {
  accounting_profile_id: 'trader-default',
  profile_name: 'Active Trader — Default',
  mode: AccountingMode.TRADER,
  charge_treatment: ChargeTreatment.EXPENSE,
  voucher_granularity: VoucherGranularity.DAILY_SUMMARY_BY_SCRIPT,
  ledger_strategy: LedgerStrategy.SCRIPT_LEVEL,
  cost_basis_method: CostBasisMethod.FIFO,
  rounding_rules: { decimal_places: 2 },
};

// ---------------------------------------------------------------------------
// Ledger mapping helpers
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic mapping ID from profile + event type + dr_cr.
 * Keeps IDs stable across re-imports so Tally master comparisons work.
 */
function mappingId(
  profileId: string,
  eventType: EventType,
  drCr: 'DR' | 'CR',
): string {
  return `${profileId}::${eventType}::${drCr}`;
}

// ---------------------------------------------------------------------------
// getDefaultLedgerMappings
// ---------------------------------------------------------------------------

/**
 * Return the complete set of LedgerMappings for the given accounting mode.
 *
 * The `{script}` token in ledger names is a placeholder.  The voucher
 * builder must replace it with the actual security symbol when
 * `script_level_flag` is true.
 *
 * Charge ledger names are identical for both modes; only the asset/income
 * ledgers differ.
 */
export function getDefaultLedgerMappings(
  mode: 'INVESTOR' | 'TRADER',
): LedgerMapping[] {
  const isInvestor = mode === 'INVESTOR';
  const profileId = isInvestor ? 'investor-default' : 'trader-default';

  // -------------------------------------------------------------------------
  // Asset / stock-in-trade ledger
  // -------------------------------------------------------------------------
  const assetLedgerName = isInvestor
    ? 'Investment in Equity Shares - {script}'
    : 'Shares-in-Trade - {script}';
  const assetGroupName = isInvestor ? 'Investments' : 'Stock-in-Trade';

  // -------------------------------------------------------------------------
  // Broker payable ledger (used as the settlement leg for all trades)
  // -------------------------------------------------------------------------
  const brokerLedger: LedgerMapping = {
    ledger_mapping_id: mappingId(profileId, EventType.BUY_TRADE, 'CR'),
    accounting_profile_id: profileId,
    event_type: EventType.BUY_TRADE,
    tally_ledger_name: 'Zerodha Broking',
    tally_group_name: 'Sundry Creditors',
    debit_credit_rule: 'CR',
    script_level_flag: false,
  };

  // -------------------------------------------------------------------------
  // BUY_TRADE
  // -------------------------------------------------------------------------
  const buyDr: LedgerMapping = {
    ledger_mapping_id: mappingId(profileId, EventType.BUY_TRADE, 'DR'),
    accounting_profile_id: profileId,
    event_type: EventType.BUY_TRADE,
    tally_ledger_name: assetLedgerName,
    tally_group_name: assetGroupName,
    debit_credit_rule: 'DR',
    script_level_flag: true,
  };

  // -------------------------------------------------------------------------
  // SELL_TRADE
  // -------------------------------------------------------------------------
  const sellCrAsset: LedgerMapping = {
    ledger_mapping_id: mappingId(profileId, EventType.SELL_TRADE, 'CR'),
    accounting_profile_id: profileId,
    event_type: EventType.SELL_TRADE,
    tally_ledger_name: assetLedgerName,
    tally_group_name: assetGroupName,
    debit_credit_rule: 'CR',
    script_level_flag: true,
  };

  const sellDrBroker: LedgerMapping = {
    ledger_mapping_id: mappingId(profileId, EventType.SELL_TRADE, 'DR'),
    accounting_profile_id: profileId,
    event_type: EventType.SELL_TRADE,
    tally_ledger_name: 'Zerodha Broking',
    tally_group_name: 'Sundry Debtors',
    debit_credit_rule: 'DR',
    script_level_flag: false,
  };

  // -------------------------------------------------------------------------
  // Gain / loss / sales / cost-of-sales ledgers
  // -------------------------------------------------------------------------
  const gainLossMappings: LedgerMapping[] = isInvestor
    ? [
        {
          ledger_mapping_id: `${profileId}::PROFIT_ON_SALE`,
          accounting_profile_id: profileId,
          event_type: EventType.SELL_TRADE,
          tally_ledger_name: 'Profit on Sale of Investments',
          tally_group_name: 'Indirect Income',
          debit_credit_rule: 'CR',
          script_level_flag: false,
        },
        {
          ledger_mapping_id: `${profileId}::LOSS_ON_SALE`,
          accounting_profile_id: profileId,
          event_type: EventType.SELL_TRADE,
          tally_ledger_name: 'Loss on Sale of Investments',
          tally_group_name: 'Indirect Expenses',
          debit_credit_rule: 'DR',
          script_level_flag: false,
        },
      ]
    : [
        {
          ledger_mapping_id: `${profileId}::TRADING_SALES`,
          accounting_profile_id: profileId,
          event_type: EventType.SELL_TRADE,
          tally_ledger_name: 'Trading Sales',
          tally_group_name: 'Sales Accounts',
          debit_credit_rule: 'CR',
          script_level_flag: false,
        },
        {
          ledger_mapping_id: `${profileId}::COST_OF_SHARES_SOLD`,
          accounting_profile_id: profileId,
          event_type: EventType.SELL_TRADE,
          tally_ledger_name: 'Cost of Shares Sold',
          tally_group_name: 'Purchase Accounts',
          debit_credit_rule: 'DR',
          script_level_flag: false,
        },
      ];

  // -------------------------------------------------------------------------
  // Charge ledgers — identical for both modes
  // -------------------------------------------------------------------------
  const chargeMappings: LedgerMapping[] = [
    {
      ledger_mapping_id: mappingId(profileId, EventType.BROKERAGE, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.BROKERAGE,
      tally_ledger_name: 'Brokerage',
      tally_group_name: 'Indirect Expenses',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.STT, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.STT,
      tally_ledger_name: 'STT',
      tally_group_name: 'Indirect Expenses',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.EXCHANGE_CHARGE, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.EXCHANGE_CHARGE,
      tally_ledger_name: 'Exchange Transaction Charges',
      tally_group_name: 'Indirect Expenses',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.SEBI_CHARGE, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.SEBI_CHARGE,
      tally_ledger_name: 'SEBI Charges',
      tally_group_name: 'Indirect Expenses',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.GST_ON_CHARGES, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.GST_ON_CHARGES,
      tally_ledger_name: 'GST on Brokerage/Charges',
      tally_group_name: 'Duties & Taxes',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.STAMP_DUTY, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.STAMP_DUTY,
      tally_ledger_name: 'Stamp Duty',
      tally_group_name: 'Duties & Taxes',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.DP_CHARGE, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.DP_CHARGE,
      tally_ledger_name: 'DP Charges',
      tally_group_name: 'Indirect Expenses',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
  ];

  // -------------------------------------------------------------------------
  // Bank / receipt / payment ledgers
  // -------------------------------------------------------------------------
  const bankMappings: LedgerMapping[] = [
    {
      ledger_mapping_id: mappingId(profileId, EventType.BANK_RECEIPT, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.BANK_RECEIPT,
      tally_ledger_name: 'Bank Account',
      tally_group_name: 'Bank Accounts',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.BANK_RECEIPT, 'CR'),
      accounting_profile_id: profileId,
      event_type: EventType.BANK_RECEIPT,
      tally_ledger_name: 'Zerodha Broking',
      tally_group_name: 'Sundry Creditors',
      debit_credit_rule: 'CR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.BANK_PAYMENT, 'CR'),
      accounting_profile_id: profileId,
      event_type: EventType.BANK_PAYMENT,
      tally_ledger_name: 'Bank Account',
      tally_group_name: 'Bank Accounts',
      debit_credit_rule: 'CR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.BANK_PAYMENT, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.BANK_PAYMENT,
      tally_ledger_name: 'Zerodha Broking',
      tally_group_name: 'Sundry Debtors',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
  ];

  // -------------------------------------------------------------------------
  // Dividend ledger
  // -------------------------------------------------------------------------
  const dividendMappings: LedgerMapping[] = [
    {
      ledger_mapping_id: mappingId(profileId, EventType.DIVIDEND, 'CR'),
      accounting_profile_id: profileId,
      event_type: EventType.DIVIDEND,
      tally_ledger_name: 'Dividend Income',
      tally_group_name: 'Indirect Income',
      debit_credit_rule: 'CR',
      script_level_flag: false,
    },
    {
      ledger_mapping_id: mappingId(profileId, EventType.DIVIDEND, 'DR'),
      accounting_profile_id: profileId,
      event_type: EventType.DIVIDEND,
      tally_ledger_name: 'Bank Account',
      tally_group_name: 'Bank Accounts',
      debit_credit_rule: 'DR',
      script_level_flag: false,
    },
  ];

  return [
    buyDr,
    brokerLedger,
    sellCrAsset,
    sellDrBroker,
    ...gainLossMappings,
    ...chargeMappings,
    ...bankMappings,
    ...dividendMappings,
  ];
}
