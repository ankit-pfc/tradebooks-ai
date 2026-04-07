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
  type TallyProfile,
} from '../types/accounting';
import { EventType } from '../types/events';
import type { LedgerOverride } from '../db/ledger-repository';
import * as L from '../constants/ledger-names';

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

// ---------------------------------------------------------------------------
// Default TallyProfiles
// ---------------------------------------------------------------------------

/**
 * Default TallyProfile for individual investors (ITR-2 filing).
 *
 * Capital gains, dividends, STT, brokerage, and DP charges are placed under
 * Capital Account — matching how Indian CAs actually structure Tally for
 * individual investors. This is NOT the P&L approach; it's the Schedule CG
 * approach used in ITR-2.
 *
 * Per-scrip ledgers: each security gets its own STCG/LTCG/dividend ledger.
 * Charges are consolidated from 8 types to ~4 ledgers.
 */
export const INVESTOR_TALLY_DEFAULT: TallyProfile = {
  id: 'investor-tally-default',
  name: 'Individual Investor — Capital Account Approach',

  broker: L.CA_BROKER,
  bank: L.BANK,

  investment: {
    template: '{symbol}-SH',
    group: L.CA_ZERODHA_INVESTMENT_GROUP,
    parentGroup: L.INVESTMENT_GROUP,
  },
  stcg: {
    template: 'STCG ON {symbol}',
    group: L.CA_STCG_GROUP,
    parentGroup: L.CA_PARENT_GROUP,
  },
  ltcg: {
    template: 'LTCG ON {symbol}',
    group: L.CA_LTCG_GROUP,
    parentGroup: L.CA_PARENT_GROUP,
  },
  stcl: {
    template: 'STCL ON {symbol}',
    group: L.CA_STCL_GROUP,
    parentGroup: L.CA_PARENT_GROUP,
  },
  ltcl: {
    template: 'LTCL ON {symbol}',
    group: L.CA_LTCL_GROUP,
    parentGroup: L.CA_PARENT_GROUP,
  },
  dividend: {
    template: 'DIV {symbol}',
    group: L.CA_DIVIDEND_GROUP,
    parentGroup: L.CA_PARENT_GROUP,
  },

  speculationGain: L.CA_SPECULATION_GAIN,
  speculationLoss: L.CA_SPECULATION_LOSS,

  chargeConsolidation: [
    {
      eventTypes: [EventType.BROKERAGE],
      ledgerName: L.CA_BROKERAGE.name,
      groupName: L.CA_BROKERAGE.group,
    },
    {
      eventTypes: [EventType.STT],
      ledgerName: L.CA_STT.name,
      groupName: L.CA_STT.group,
    },
    {
      eventTypes: [
        EventType.EXCHANGE_CHARGE,
        EventType.SEBI_CHARGE,
      ],
      ledgerName: L.CA_EXCHANGE_AND_OTHER.name,
      groupName: L.CA_EXCHANGE_AND_OTHER.group,
    },
    {
      eventTypes: [EventType.GST_ON_CHARGES],
      ledgerName: L.GST_ON_CHARGES.name,
      groupName: L.GST_ON_CHARGES.group,
    },
    {
      eventTypes: [EventType.STAMP_DUTY],
      ledgerName: L.STAMP_DUTY.name,
      groupName: L.STAMP_DUTY.group,
    },
    {
      eventTypes: [EventType.DP_CHARGE],
      ledgerName: L.CA_DP_CHARGES.name,
      groupName: L.CA_DP_CHARGES.group,
    },
  ],

  tdsOnDividend: L.TDS_ON_DIVIDEND,
  tdsOnSecurities: L.TDS_ON_SECURITIES,

  customGroups: [...L.CA_CUSTOM_GROUPS],

  perScripCapitalGains: true,
  perScripDividends: true,
};

/**
 * Default TallyProfile for traders (ITR-3, business income).
 * Keeps the P&L-centric approach with charges under Indirect Expenses.
 * Capital gains are not per-scrip (single ledger for profit/loss on sale).
 */
export const TRADER_TALLY_DEFAULT: TallyProfile = {
  id: 'trader-tally-default',
  name: 'Active Trader — P&L Approach',

  broker: L.BROKER,
  bank: L.BANK,

  investment: {
    template: 'Shares-in-Trade - {symbol}',
    group: L.STOCK_IN_TRADE_GROUP,
  },
  stcg: {
    template: L.STCG_PROFIT.name,
    group: L.STCG_PROFIT.group,
  },
  ltcg: {
    template: L.LTCG_PROFIT.name,
    group: L.LTCG_PROFIT.group,
  },
  stcl: {
    template: L.STCG_LOSS.name,
    group: L.STCG_LOSS.group,
  },
  ltcl: {
    template: L.LTCG_LOSS.name,
    group: L.LTCG_LOSS.group,
  },
  dividend: {
    template: L.DIVIDEND_INCOME.name,
    group: L.DIVIDEND_INCOME.group,
  },

  speculationGain: L.SPECULATIVE_PROFIT,
  speculationLoss: L.SPECULATIVE_LOSS,

  chargeConsolidation: [
    { eventTypes: [EventType.BROKERAGE], ledgerName: L.BROKERAGE.name, groupName: L.BROKERAGE.group },
    { eventTypes: [EventType.STT], ledgerName: L.STT.name, groupName: L.STT.group },
    { eventTypes: [EventType.EXCHANGE_CHARGE], ledgerName: L.EXCHANGE_CHARGES.name, groupName: L.EXCHANGE_CHARGES.group },
    { eventTypes: [EventType.SEBI_CHARGE], ledgerName: L.SEBI_CHARGES.name, groupName: L.SEBI_CHARGES.group },
    { eventTypes: [EventType.GST_ON_CHARGES], ledgerName: L.GST_ON_CHARGES.name, groupName: L.GST_ON_CHARGES.group },
    { eventTypes: [EventType.STAMP_DUTY], ledgerName: L.STAMP_DUTY.name, groupName: L.STAMP_DUTY.group },
    { eventTypes: [EventType.DP_CHARGE], ledgerName: L.DP_CHARGES.name, groupName: L.DP_CHARGES.group },
  ],

  tdsOnDividend: L.TDS_ON_DIVIDEND,
  tdsOnSecurities: L.TDS_ON_SECURITIES,

  customGroups: [],

  perScripCapitalGains: false,
  perScripDividends: false,
};

/**
 * Get the default TallyProfile for a given accounting mode.
 */
export function getDefaultTallyProfile(mode: AccountingMode): TallyProfile {
  return mode === AccountingMode.INVESTOR
    ? INVESTOR_TALLY_DEFAULT
    : TRADER_TALLY_DEFAULT;
}

// ---------------------------------------------------------------------------
// Merge user ledger overrides into a TallyProfile
// ---------------------------------------------------------------------------

/** Map from SYSTEM_LEDGER key → charge EventType(s) used in chargeConsolidation. */
const CHARGE_KEY_TO_EVENT_TYPES: Record<string, EventType[]> = {
  BROKERAGE: [EventType.BROKERAGE],
  STT: [EventType.STT],
  EXCHANGE_CHARGES: [EventType.EXCHANGE_CHARGE, EventType.SEBI_CHARGE],
  GST_ON_CHARGES: [EventType.GST_ON_CHARGES],
  STAMP_DUTY: [EventType.STAMP_DUTY],
  DP_CHARGES: [EventType.DP_CHARGE],
};

/**
 * Apply user-saved ledger overrides to a base TallyProfile.
 * Returns a new TallyProfile with overridden names/groups where applicable.
 * Only system-key overrides (not custom entries) affect the profile.
 */
export function mergeOverridesIntoProfile(
  base: TallyProfile,
  overrides: LedgerOverride[],
): TallyProfile {
  const profile: TallyProfile = {
    ...base,
    chargeConsolidation: base.chargeConsolidation.map((c) => ({ ...c })),
    customGroups: [...base.customGroups],
  };

  for (const o of overrides) {
    if (o.is_custom) continue;

    switch (o.ledger_key) {
      case 'BROKER':
        profile.broker = { name: o.name, group: o.parent_group };
        break;
      case 'BANK':
        profile.bank = { name: o.name, group: o.parent_group };
        break;
      case 'STCG_PROFIT':
        profile.stcg = { ...profile.stcg, template: o.name, group: o.parent_group };
        break;
      case 'LTCG_PROFIT':
        profile.ltcg = { ...profile.ltcg, template: o.name, group: o.parent_group };
        break;
      case 'STCG_LOSS':
        profile.stcl = { ...profile.stcl, template: o.name, group: o.parent_group };
        break;
      case 'LTCG_LOSS':
        profile.ltcl = { ...profile.ltcl, template: o.name, group: o.parent_group };
        break;
      case 'SPECULATIVE_PROFIT':
      case 'SPECULATIVE_LOSS':
        // Single intraday net ledger — gains and losses both post here.
        // Either override key updates BOTH fields so the profile remains
        // self-consistent regardless of which key the override uses.
        profile.speculationGain = { name: o.name, group: o.parent_group };
        profile.speculationLoss = profile.speculationGain;
        break;
      case 'DIVIDEND_INCOME':
        profile.dividend = { ...profile.dividend, template: o.name, group: o.parent_group };
        break;
      case 'TDS_ON_DIVIDEND':
        profile.tdsOnDividend = { name: o.name, group: o.parent_group };
        break;
      case 'TDS_ON_SECURITIES':
        profile.tdsOnSecurities = { name: o.name, group: o.parent_group };
        break;
      default: {
        // Check if it's a charge key
        const eventTypes = CHARGE_KEY_TO_EVENT_TYPES[o.ledger_key];
        if (eventTypes) {
          const entry = profile.chargeConsolidation.find((c) =>
            eventTypes.some((et) => c.eventTypes.includes(et)),
          );
          if (entry) {
            entry.ledgerName = o.name;
            entry.groupName = o.parent_group;
          }
        }
        break;
      }
    }
  }

  return profile;
}

/**
 * Derive Indian FY label from period dates.
 * Indian FY runs April 1 to March 31.
 * Example: "2024-04-01" to "2025-03-31" → "2024-25"
 *
 * Falls back to "{startYear}-{endYear}" for non-standard periods.
 */
export function deriveFYLabel(periodFrom: string, periodTo: string): string {
  if (!periodFrom || !periodTo) return '';
  const startYear = parseInt(periodFrom.slice(0, 4), 10);
  const endYear = parseInt(periodTo.slice(0, 4), 10);
  if (isNaN(startYear) || isNaN(endYear)) return '';
  const endShort = String(endYear).slice(-2);
  return `${startYear}-${endShort}`;
}

/**
 * Build an AccountingProfile from user settings, merging with defaults.
 */
export function buildProfileFromSettings(settings: {
  accounting_mode: 'INVESTOR' | 'TRADER';
  cost_basis_method: 'FIFO' | 'WEIGHTED_AVERAGE';
  charge_treatment: 'CAPITALIZE' | 'EXPENSE' | 'HYBRID';
  voucher_granularity: 'TRADE_LEVEL' | 'CONTRACT_NOTE_LEVEL' | 'DAILY_SUMMARY_BY_SCRIPT' | 'DAILY_SUMMARY_POOLED';
  ledger_strategy: 'SCRIPT_LEVEL' | 'POOLED';
}): AccountingProfile {
  const base = settings.accounting_mode === 'INVESTOR' ? INVESTOR_DEFAULT : TRADER_DEFAULT;
  return {
    ...base,
    mode: settings.accounting_mode === 'INVESTOR' ? AccountingMode.INVESTOR : AccountingMode.TRADER,
    cost_basis_method: CostBasisMethod[settings.cost_basis_method],
    charge_treatment: ChargeTreatment[settings.charge_treatment],
    voucher_granularity: VoucherGranularity[settings.voucher_granularity],
    ledger_strategy: LedgerStrategy[settings.ledger_strategy],
  };
}
