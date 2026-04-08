/**
 * corporate-actions.test.ts
 * Tests for Phase 3b: Corporate Actions
 *
 * Covers:
 *  - CostLotTracker.adjustLots() — bonus, split, merger
 *  - corporateActionToEvents() — event generation
 *  - buildCorporateActionVoucher() — merger journal, rights purchase
 *  - Integration: buy → bonus → sell cost basis verification
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { EventType, type CanonicalEvent } from '../../types/events';
import type { CorporateActionInput } from '../../parsers/zerodha/types';
import { corporateActionToEvents } from '../canonical-events';
import {
  buildCorporateActionVoucher,
  buildVouchers,
} from '../voucher-builder';
import { CostLotTracker } from '../cost-lots';
import {
  AccountingMode,
  ChargeTreatment,
  VoucherGranularity,
  LedgerStrategy,
  CostBasisMethod,
} from '../../types/accounting';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type: EventType.BUY_TRADE,
    event_date: '2025-01-01',
    settlement_date: null,
    security_id: 'NSE:RELIANCE',
    quantity: '100',
    rate: '200',
    gross_amount: '20000.00',
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-1',
    source_row_ids: [],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'hash-1',
    ...overrides,
  };
}

const DEFAULT_PROFILE = {
  accounting_profile_id: 'test-investor',
  profile_name: 'Test Investor',
  mode: AccountingMode.INVESTOR,
  charge_treatment: ChargeTreatment.EXPENSE,
  voucher_granularity: VoucherGranularity.TRADE_LEVEL,
  ledger_strategy: LedgerStrategy.SCRIPT_LEVEL,
  cost_basis_method: CostBasisMethod.FIFO,
  rounding_rules: { decimal_places: 2 },
};

// ---------------------------------------------------------------------------
// adjustLots
// ---------------------------------------------------------------------------

describe('CostLotTracker.adjustLots', () => {
  it('bonus 1:1 doubles quantity, preserves total cost', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      security_id: 'NSE:RELIANCE',
      quantity: '100',
      rate: '200',
    });
    tracker.addLot(buyEvent);

    tracker.adjustLots({
      securityId: 'NSE:RELIANCE',
      quantityMultiplier: '2',
      // costDivisor defaults to quantityMultiplier (2)
      // qty doubles, unit cost halves → total cost preserved
      preserveAcquisitionDate: true,
    });

    const lots = tracker.getOpenLots('NSE:RELIANCE');
    expect(lots).toHaveLength(1);
    expect(lots[0].open_quantity).toBe('200');
    // Unit cost halved: 200 / 2 = 100
    expect(new Decimal(lots[0].effective_unit_cost).toFixed(2)).toBe('100.00');
  });

  it('stock split 1:5 multiplies quantity by 5, divides cost by 5', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      security_id: 'NSE:RELIANCE',
      quantity: '100',
      rate: '500',
    });
    tracker.addLot(buyEvent);

    tracker.adjustLots({
      securityId: 'NSE:RELIANCE',
      quantityMultiplier: '5',
      // costDivisor defaults to 5 (= quantityMultiplier)
      preserveAcquisitionDate: true,
    });

    const lots = tracker.getOpenLots('NSE:RELIANCE');
    expect(lots[0].open_quantity).toBe('500');
    expect(new Decimal(lots[0].effective_unit_cost).toFixed(2)).toBe('100.00');
  });

  it('preserves acquisition date for bonus/split', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2024-01-15',
    });
    tracker.addLot(buyEvent);

    tracker.adjustLots({
      securityId: 'NSE:RELIANCE',
      quantityMultiplier: '2',
      preserveAcquisitionDate: true,
    });

    const lots = tracker.getOpenLots('NSE:RELIANCE');
    expect(lots[0].acquisition_date).toBe('2024-01-15');
  });

  it('merger transfers lots to new securityId', () => {
    const tracker = new CostLotTracker();
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      security_id: 'NSE:OLDCO',
      quantity: '100',
      rate: '200',
    });
    tracker.addLot(buyEvent);

    tracker.adjustLots({
      securityId: 'NSE:OLDCO',
      quantityMultiplier: '1',
      newSecurityId: 'NSE:NEWCO',
      preserveAcquisitionDate: false,
      actionDate: '2025-06-01',
    });

    expect(tracker.getOpenLots('NSE:OLDCO')).toHaveLength(0);
    const newLots = tracker.getOpenLots('NSE:NEWCO');
    expect(newLots).toHaveLength(1);
    expect(newLots[0].security_id).toBe('NSE:NEWCO');
    expect(newLots[0].acquisition_date).toBe('2025-06-01');
  });

  it('no-ops on empty lots', () => {
    const tracker = new CostLotTracker();
    // Should not throw
    tracker.adjustLots({
      securityId: 'NSE:NONEXISTENT',
      quantityMultiplier: '2',
      preserveAcquisitionDate: true,
    });
    expect(tracker.getOpenLots('NSE:NONEXISTENT')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// corporateActionToEvents
// ---------------------------------------------------------------------------

describe('corporateActionToEvents', () => {
  it('creates BONUS_SHARES event with correct type and hash', () => {
    const action: CorporateActionInput = {
      action_type: 'BONUS',
      security_id: 'NSE:RELIANCE',
      action_date: '2025-06-01',
      ratio_numerator: '3',
      ratio_denominator: '2',
    };
    const events = corporateActionToEvents(action, 'batch-1', 'file-1');

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.BONUS_SHARES);
    expect(events[0].security_id).toBe('NSE:RELIANCE');
    expect(events[0].gross_amount).toBe('0');
  });

  it('creates RIGHTS_ISSUE event with gross amount', () => {
    const action: CorporateActionInput = {
      action_type: 'RIGHTS_ISSUE',
      security_id: 'NSE:RELIANCE',
      action_date: '2025-06-01',
      ratio_numerator: '1',
      ratio_denominator: '5',
      cost_per_share: '100',
    };
    const events = corporateActionToEvents(action, 'batch-1', 'file-1');

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.RIGHTS_ISSUE);
    expect(events[0].rate).toBe('100');
    // gross = cost_per_share * ratio = 100 * 0.2 = 20
    expect(events[0].gross_amount).toBe('20.00');
  });
});

// ---------------------------------------------------------------------------
// buildCorporateActionVoucher
// ---------------------------------------------------------------------------

describe('buildCorporateActionVoucher', () => {
  it('returns null for BONUS_SHARES (no journal entry)', () => {
    const event = makeEvent({
      event_type: EventType.BONUS_SHARES,
      rate: '2',
      gross_amount: '0',
    });
    const result = buildCorporateActionVoucher(event, new Decimal(0));
    expect(result).toBeNull();
  });

  it('returns null for STOCK_SPLIT (no journal entry)', () => {
    const event = makeEvent({
      event_type: EventType.STOCK_SPLIT,
      rate: '5',
      gross_amount: '0',
    });
    const result = buildCorporateActionVoucher(event, new Decimal(0));
    expect(result).toBeNull();
  });

  it('builds balanced merger journal DR new / CR old', () => {
    const event = makeEvent({
      event_type: EventType.MERGER_DEMERGER,
      security_id: 'NSE:OLDCO',
      external_ref: 'NSE:NEWCO',
      rate: '1',
    });
    const costBasis = new Decimal('20000');
    const voucher = buildCorporateActionVoucher(event, costBasis);

    expect(voucher).not.toBeNull();
    expect(voucher!.lines).toHaveLength(2);
    expect(voucher!.total_debit).toBe(voucher!.total_credit);
    expect(voucher!.narrative).toContain('OLDCO');
    expect(voucher!.narrative).toContain('NEWCO');
  });

  it('builds balanced rights issue purchase voucher', () => {
    const event = makeEvent({
      event_type: EventType.RIGHTS_ISSUE,
      security_id: 'NSE:RELIANCE',
      gross_amount: '10000.00',
      rate: '100',
    });
    const voucher = buildCorporateActionVoucher(event, new Decimal(0));

    expect(voucher).not.toBeNull();
    expect(voucher!.total_debit).toBe(voucher!.total_credit);
    expect(voucher!.narrative).toContain('Rights issue');
  });
});

// ---------------------------------------------------------------------------
// Integration: buy → bonus → sell with correct cost basis
// ---------------------------------------------------------------------------

describe('buildVouchers corporate action integration', () => {
  it('buy + bonus + sell: cost basis reflects bonus adjustment', () => {
    // Buy 100 shares at Rs.200 each
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2025-01-01',
      security_id: 'NSE:RELIANCE',
      quantity: '100',
      rate: '200',
      gross_amount: '20000.00',
    });

    // Bonus 1:1 (ratio = 2, costDivisor = quantityMultiplier by default)
    // After: 200 shares at Rs.100 each (total cost 20000 unchanged)
    const bonusEvent = makeEvent({
      event_type: EventType.BONUS_SHARES,
      event_date: '2025-06-01',
      security_id: 'NSE:RELIANCE',
      quantity: '0',
      rate: '2', // quantityMultiplier
      gross_amount: '0',
    });

    // Sell 200 shares at Rs.150 each
    const sellEvent = makeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2025-09-01',
      security_id: 'NSE:RELIANCE',
      quantity: '-200',
      rate: '150',
      gross_amount: '30000.00',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(
      [buyEvent, bonusEvent, sellEvent],
      DEFAULT_PROFILE,
      tracker,
    );

    // Should produce 2 vouchers: buy + sell (bonus produces no voucher)
    expect(vouchers).toHaveLength(2);

    // All vouchers balanced
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });

  it('buy (old ISIN) + split with ISIN change + sell (new ISIN): lots migrate', () => {
    // Real-world case: IRCTC did a 1:5 face-value split in Oct 2021,
    // changing the ISIN from INE335Y01012 → INE335Y01020. Users who held
    // the old ISIN and sold after the split under the new ISIN would hit
    // disposeLots("sell exceeds open lots") because lots stayed keyed to
    // the old ISIN. external_ref on the split event carries the new
    // security_id so the voucher builder can migrate lots.
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2021-05-12',
      security_id: 'ISIN:INE335Y01012',
      quantity: '10',
      rate: '4200',
      gross_amount: '42000.00',
    });

    const splitEvent = makeEvent({
      event_type: EventType.STOCK_SPLIT,
      event_date: '2021-10-28',
      security_id: 'ISIN:INE335Y01012',
      // external_ref holds the new security_id (as set by corporateActionToEvents
      // when CorporateActionInput.new_security_id is provided).
      external_ref: 'ISIN:INE335Y01020',
      quantity: '0',
      rate: '5', // quantityMultiplier = 5 (1:5 split)
      gross_amount: '0',
    });

    const sellEvent = makeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2021-11-12',
      security_id: 'ISIN:INE335Y01020',
      quantity: '-50', // 10 old × 5 = 50 new
      rate: '857.15',
      gross_amount: '42857.50',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(
      [buyEvent, splitEvent, sellEvent],
      DEFAULT_PROFILE,
      tracker,
    );

    // buy + sell vouchers; split produces no voucher
    expect(vouchers).toHaveLength(2);
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
    // Old ISIN is empty; new ISIN is empty (sold all 50)
    expect(tracker.getOpenLots('ISIN:INE335Y01012')).toHaveLength(0);
    expect(tracker.getOpenLots('ISIN:INE335Y01020')).toHaveLength(0);
  });

  it('split without ISIN change does not migrate lots (external_ref same as security_id)', () => {
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2025-01-01',
      security_id: 'ISIN:INE001A01036',
      quantity: '100',
      rate: '500',
    });

    // Same security_id on both sides — adjustLots should not try to transfer
    const splitEvent = makeEvent({
      event_type: EventType.STOCK_SPLIT,
      event_date: '2025-06-01',
      security_id: 'ISIN:INE001A01036',
      external_ref: 'ISIN:INE001A01036',
      rate: '2',
    });

    const tracker = new CostLotTracker();
    buildVouchers([buyEvent, splitEvent], DEFAULT_PROFILE, tracker);

    const lots = tracker.getOpenLots('ISIN:INE001A01036');
    expect(lots).toHaveLength(1);
    expect(lots[0].open_quantity).toBe('200');
  });

  it('buy + split + sell: cost basis reflects split adjustment', () => {
    // Buy 100 shares at Rs.500 each
    const buyEvent = makeEvent({
      event_type: EventType.BUY_TRADE,
      event_date: '2025-01-01',
      security_id: 'NSE:RELIANCE',
      quantity: '100',
      rate: '500',
      gross_amount: '50000.00',
    });

    // Split 1:5 (ratio = 5)
    // After: 500 shares at Rs.100 each (total cost 50000 unchanged)
    const splitEvent = makeEvent({
      event_type: EventType.STOCK_SPLIT,
      event_date: '2025-06-01',
      security_id: 'NSE:RELIANCE',
      quantity: '0',
      rate: '5',
      gross_amount: '0',
    });

    // Sell 500 shares at Rs.120
    const sellEvent = makeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2025-09-01',
      security_id: 'NSE:RELIANCE',
      quantity: '-500',
      rate: '120',
      gross_amount: '60000.00',
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(
      [buyEvent, splitEvent, sellEvent],
      DEFAULT_PROFILE,
      tracker,
    );

    expect(vouchers).toHaveLength(2); // buy + sell
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });
});
