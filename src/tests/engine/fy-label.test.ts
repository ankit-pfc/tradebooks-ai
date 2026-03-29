import { describe, expect, it } from 'vitest';
import { deriveFYLabel, buildProfileFromSettings } from '../../lib/engine/accounting-policy';
import { AccountingMode, ChargeTreatment, CostBasisMethod, LedgerStrategy, VoucherGranularity } from '../../lib/types/accounting';

describe('deriveFYLabel', () => {
  it('derives standard Indian FY label', () => {
    expect(deriveFYLabel('2024-04-01', '2025-03-31')).toBe('2024-25');
  });

  it('derives FY label for FY 2021-22', () => {
    expect(deriveFYLabel('2021-04-01', '2022-03-31')).toBe('2021-22');
  });

  it('handles calendar year periods', () => {
    expect(deriveFYLabel('2024-01-01', '2024-12-31')).toBe('2024-24');
  });

  it('returns empty string for empty inputs', () => {
    expect(deriveFYLabel('', '')).toBe('');
  });

  it('returns empty string for invalid dates', () => {
    expect(deriveFYLabel('abc', 'def')).toBe('');
  });

  it('handles cross-century boundaries', () => {
    expect(deriveFYLabel('2099-04-01', '2100-03-31')).toBe('2099-00');
  });
});

describe('buildProfileFromSettings', () => {
  it('builds investor profile from settings', () => {
    const profile = buildProfileFromSettings({
      accounting_mode: 'INVESTOR',
      cost_basis_method: 'FIFO',
      charge_treatment: 'HYBRID',
      voucher_granularity: 'TRADE_LEVEL',
      ledger_strategy: 'SCRIPT_LEVEL',
    });

    expect(profile.mode).toBe(AccountingMode.INVESTOR);
    expect(profile.cost_basis_method).toBe(CostBasisMethod.FIFO);
    expect(profile.charge_treatment).toBe(ChargeTreatment.HYBRID);
    expect(profile.voucher_granularity).toBe(VoucherGranularity.TRADE_LEVEL);
    expect(profile.ledger_strategy).toBe(LedgerStrategy.SCRIPT_LEVEL);
  });

  it('builds trader profile with weighted average', () => {
    const profile = buildProfileFromSettings({
      accounting_mode: 'TRADER',
      cost_basis_method: 'WEIGHTED_AVERAGE',
      charge_treatment: 'EXPENSE',
      voucher_granularity: 'DAILY_SUMMARY_BY_SCRIPT',
      ledger_strategy: 'POOLED',
    });

    expect(profile.mode).toBe(AccountingMode.TRADER);
    expect(profile.cost_basis_method).toBe(CostBasisMethod.WEIGHTED_AVERAGE);
    expect(profile.charge_treatment).toBe(ChargeTreatment.EXPENSE);
    expect(profile.voucher_granularity).toBe(VoucherGranularity.DAILY_SUMMARY_BY_SCRIPT);
    expect(profile.ledger_strategy).toBe(LedgerStrategy.POOLED);
  });

  it('preserves rounding rules from base profile', () => {
    const profile = buildProfileFromSettings({
      accounting_mode: 'INVESTOR',
      cost_basis_method: 'FIFO',
      charge_treatment: 'HYBRID',
      voucher_granularity: 'TRADE_LEVEL',
      ledger_strategy: 'SCRIPT_LEVEL',
    });

    expect(profile.rounding_rules.decimal_places).toBe(2);
  });
});
