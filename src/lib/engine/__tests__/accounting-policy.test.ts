import { describe, expect, it } from 'vitest';
import {
  INVESTOR_DEFAULT,
  TRADER_DEFAULT,
  INVESTOR_TALLY_DEFAULT,
  TRADER_TALLY_DEFAULT,
  getDefaultLedgerMappings,
  getDefaultTallyProfile,
  mergeOverridesIntoProfile,
  deriveFYLabel,
  buildProfileFromSettings,
} from '../accounting-policy';
import type { LedgerOverride } from '../../db/ledger-repository';
import {
  AccountingMode,
  ChargeTreatment,
  CostBasisMethod,
  VoucherGranularity,
  LedgerStrategy,
} from '../../types/accounting';
import { EventType } from '../../types/events';
import {
  SYSTEM_LEDGERS,
  SYSTEM_LEDGER_KEYS,
  SYSTEM_LEDGER_NAME_TO_KEY,
} from '../../constants/ledger-names';

describe('INVESTOR_DEFAULT', () => {
  it('has correct mode and charge_treatment', () => {
    expect(INVESTOR_DEFAULT.mode).toBe(AccountingMode.INVESTOR);
    expect(INVESTOR_DEFAULT.charge_treatment).toBe(ChargeTreatment.HYBRID);
  });

  it('uses FIFO cost basis', () => {
    expect(INVESTOR_DEFAULT.cost_basis_method).toBe(CostBasisMethod.FIFO);
  });

  it('uses DAILY_SUMMARY_BY_SCRIPT granularity', () => {
    expect(INVESTOR_DEFAULT.voucher_granularity).toBe(VoucherGranularity.DAILY_SUMMARY_BY_SCRIPT);
  });

  it('uses SCRIPT_LEVEL ledger strategy', () => {
    expect(INVESTOR_DEFAULT.ledger_strategy).toBe(LedgerStrategy.SCRIPT_LEVEL);
  });

  it('rounds to 2 decimal places', () => {
    expect(INVESTOR_DEFAULT.rounding_rules.decimal_places).toBe(2);
  });
});

describe('TRADER_DEFAULT', () => {
  it('has TRADER mode and EXPENSE charge treatment', () => {
    expect(TRADER_DEFAULT.mode).toBe(AccountingMode.TRADER);
    expect(TRADER_DEFAULT.charge_treatment).toBe(ChargeTreatment.EXPENSE);
  });

  it('uses FIFO cost basis', () => {
    expect(TRADER_DEFAULT.cost_basis_method).toBe(CostBasisMethod.FIFO);
  });
});

describe('getDefaultLedgerMappings', () => {
  it('INVESTOR mappings include Investment ledger with {script}', () => {
    const mappings = getDefaultLedgerMappings('INVESTOR');
    const buyDr = mappings.find(m => m.event_type === EventType.BUY_TRADE && m.debit_credit_rule === 'DR');
    expect(buyDr?.tally_ledger_name).toContain('{script}');
    expect(buyDr?.script_level_flag).toBe(true);
  });

  it('INVESTOR has Profit/Loss on Sale of Investments', () => {
    const mappings = getDefaultLedgerMappings('INVESTOR');
    const names = mappings.map(m => m.tally_ledger_name);
    expect(names).toContain('Profit on Sale of Investments');
    expect(names).toContain('Loss on Sale of Investments');
  });

  it('TRADER has Trading Sales and Cost of Shares Sold', () => {
    const mappings = getDefaultLedgerMappings('TRADER');
    const names = mappings.map(m => m.tally_ledger_name);
    expect(names).toContain('Trading Sales');
    expect(names).toContain('Cost of Shares Sold');
  });

  it('both modes include all 7 charge mappings', () => {
    const chargeTypes = [
      EventType.BROKERAGE,
      EventType.STT,
      EventType.EXCHANGE_CHARGE,
      EventType.SEBI_CHARGE,
      EventType.GST_ON_CHARGES,
      EventType.STAMP_DUTY,
      EventType.DP_CHARGE,
    ];
    for (const mode of ['INVESTOR', 'TRADER'] as const) {
      const mappings = getDefaultLedgerMappings(mode);
      for (const ct of chargeTypes) {
        const found = mappings.find(m => m.event_type === ct);
        expect(found, `${mode} should have mapping for ${ct}`).toBeDefined();
      }
    }
  });

  it('includes bank and dividend mappings', () => {
    const mappings = getDefaultLedgerMappings('INVESTOR');
    const types = mappings.map(m => m.event_type);
    expect(types).toContain(EventType.BANK_RECEIPT);
    expect(types).toContain(EventType.BANK_PAYMENT);
    expect(types).toContain(EventType.DIVIDEND);
  });
});

describe('TallyProfile defaults', () => {
  it('INVESTOR has perScripCapitalGains=true', () => {
    expect(INVESTOR_TALLY_DEFAULT.perScripCapitalGains).toBe(true);
    expect(INVESTOR_TALLY_DEFAULT.perScripDividends).toBe(true);
  });

  it('INVESTOR uses {symbol}-SH investment template', () => {
    expect(INVESTOR_TALLY_DEFAULT.investment.template).toBe('{symbol}-SH');
  });

  it('INVESTOR consolidates EXCHANGE_CHARGE + SEBI_CHARGE', () => {
    const exchangeConsolidation = INVESTOR_TALLY_DEFAULT.chargeConsolidation.find(
      c => c.eventTypes.includes(EventType.EXCHANGE_CHARGE),
    );
    expect(exchangeConsolidation?.eventTypes).toContain(EventType.SEBI_CHARGE);
  });

  it('TRADER has perScripCapitalGains=false', () => {
    expect(TRADER_TALLY_DEFAULT.perScripCapitalGains).toBe(false);
    expect(TRADER_TALLY_DEFAULT.perScripDividends).toBe(false);
  });

  it('TRADER has separate charge ledgers (no consolidation of exchange+sebi)', () => {
    const exchangeEntry = TRADER_TALLY_DEFAULT.chargeConsolidation.find(
      c => c.eventTypes.includes(EventType.EXCHANGE_CHARGE),
    );
    expect(exchangeEntry?.eventTypes).not.toContain(EventType.SEBI_CHARGE);
  });
});

describe('getDefaultTallyProfile', () => {
  it('returns INVESTOR profile for INVESTOR mode', () => {
    expect(getDefaultTallyProfile(AccountingMode.INVESTOR).id).toBe('investor-tally-default');
  });

  it('returns TRADER profile for TRADER mode', () => {
    expect(getDefaultTallyProfile(AccountingMode.TRADER).id).toBe('trader-tally-default');
  });
});

describe('deriveFYLabel', () => {
  it('derives correct FY label', () => {
    expect(deriveFYLabel('2024-04-01', '2025-03-31')).toBe('2024-25');
  });

  it('returns empty for empty inputs', () => {
    expect(deriveFYLabel('', '')).toBe('');
  });
});

describe('buildProfileFromSettings', () => {
  it('builds investor profile from settings', () => {
    const profile = buildProfileFromSettings({
      accounting_mode: 'INVESTOR',
      cost_basis_method: 'FIFO',
      charge_treatment: 'HYBRID',
      voucher_granularity: 'DAILY_SUMMARY_BY_SCRIPT',
      ledger_strategy: 'SCRIPT_LEVEL',
    });
    expect(profile.mode).toBe(AccountingMode.INVESTOR);
    expect(profile.cost_basis_method).toBe(CostBasisMethod.FIFO);
  });

  it('builds trader profile with WEIGHTED_AVERAGE', () => {
    const profile = buildProfileFromSettings({
      accounting_mode: 'TRADER',
      cost_basis_method: 'WEIGHTED_AVERAGE',
      charge_treatment: 'EXPENSE',
      voucher_granularity: 'TRADE_LEVEL',
      ledger_strategy: 'POOLED',
    });
    expect(profile.mode).toBe(AccountingMode.TRADER);
    expect(profile.cost_basis_method).toBe(CostBasisMethod.WEIGHTED_AVERAGE);
    expect(profile.ledger_strategy).toBe(LedgerStrategy.POOLED);
  });
});

// ---------------------------------------------------------------------------
// mergeOverridesIntoProfile
// ---------------------------------------------------------------------------

function makeOverride(key: string, name: string, group: string, isCustom = false): LedgerOverride {
  return {
    id: `override-${key}`,
    user_id: 'user-1',
    ledger_key: key,
    name,
    parent_group: group,
    is_custom: isCustom,
    created_at: '2026-04-06T00:00:00Z',
  };
}

describe('mergeOverridesIntoProfile', () => {
  it('returns base profile unchanged when no overrides', () => {
    const result = mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, []);
    expect(result.broker).toEqual(INVESTOR_TALLY_DEFAULT.broker);
    expect(result.bank).toEqual(INVESTOR_TALLY_DEFAULT.bank);
  });

  it('overrides broker name and group', () => {
    const overrides = [makeOverride('BROKER', 'My Broker Account', 'Custom Creditors')];
    const result = mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, overrides);
    expect(result.broker).toEqual({ name: 'My Broker Account', group: 'Custom Creditors' });
    // Other fields unchanged
    expect(result.bank).toEqual(INVESTOR_TALLY_DEFAULT.bank);
  });

  it('overrides capital gain ledger template and group', () => {
    const overrides = [makeOverride('STCG_PROFIT', 'Short Term CG', 'My CG Group')];
    const result = mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, overrides);
    expect(result.stcg.template).toBe('Short Term CG');
    expect(result.stcg.group).toBe('My CG Group');
  });

  it('overrides charge consolidation entry', () => {
    const overrides = [makeOverride('BROKERAGE', 'Trading Brokerage', 'Direct Expenses')];
    const result = mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, overrides);
    const brokerageEntry = result.chargeConsolidation.find(
      (c) => c.eventTypes.includes(EventType.BROKERAGE),
    );
    expect(brokerageEntry?.ledgerName).toBe('Trading Brokerage');
    expect(brokerageEntry?.groupName).toBe('Direct Expenses');
  });

  it('does not mutate the base profile', () => {
    const originalBroker = { ...INVESTOR_TALLY_DEFAULT.broker };
    const overrides = [makeOverride('BROKER', 'Changed', 'Changed Group')];
    mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, overrides);
    expect(INVESTOR_TALLY_DEFAULT.broker).toEqual(originalBroker);
  });

  it('skips custom overrides (not system keys)', () => {
    const overrides = [makeOverride('MY_CUSTOM_LEDGER', 'Custom', 'Group', true)];
    const result = mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, overrides);
    expect(result.broker).toEqual(INVESTOR_TALLY_DEFAULT.broker);
  });

  it('handles multiple overrides at once', () => {
    const overrides = [
      makeOverride('BROKER', 'New Broker', 'Creditors'),
      makeOverride('BANK', 'HDFC Bank', 'Bank Accounts'),
      makeOverride('SPECULATIVE_PROFIT', 'Intraday Gain', 'Trading Income'),
    ];
    const result = mergeOverridesIntoProfile(INVESTOR_TALLY_DEFAULT, overrides);
    expect(result.broker.name).toBe('New Broker');
    expect(result.bank.name).toBe('HDFC Bank');
    expect(result.speculationGain.name).toBe('Intraday Gain');
  });
});

// ---------------------------------------------------------------------------
// SYSTEM_LEDGER_NAME_TO_KEY — used by upload route to match imported names
// ---------------------------------------------------------------------------

describe('SYSTEM_LEDGER_NAME_TO_KEY', () => {
  it('maps every system ledger name (uppercased) to its key', () => {
    for (const entry of SYSTEM_LEDGERS) {
      expect(SYSTEM_LEDGER_NAME_TO_KEY.get(entry.name.toUpperCase())).toBe(entry.key);
    }
  });

  it('returns undefined for unknown names', () => {
    expect(SYSTEM_LEDGER_NAME_TO_KEY.get('MY RANDOM LEDGER')).toBeUndefined();
  });

  it('SYSTEM_LEDGER_KEYS contains all system keys', () => {
    for (const entry of SYSTEM_LEDGERS) {
      expect(SYSTEM_LEDGER_KEYS.has(entry.key)).toBe(true);
    }
    expect(SYSTEM_LEDGER_KEYS.has('UNKNOWN_KEY')).toBe(false);
  });
});
