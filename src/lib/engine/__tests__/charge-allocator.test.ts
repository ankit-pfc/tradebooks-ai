import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { allocateCharges } from '../charge-allocator';
import type {
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
} from '../../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrade(overrides: Partial<ZerodhaContractNoteTradeRow> = {}): ZerodhaContractNoteTradeRow {
  return {
    order_no: '1001',
    order_time: '10:00:00',
    trade_no: '2001',
    trade_time: '10:00:01',
    security_description: 'RELIANCE INDUSTRIES LTD',
    buy_sell: 'B',
    quantity: '10',
    exchange: 'NSE',
    gross_rate: '100.00',
    brokerage_per_unit: '0.05',
    net_rate: '100.05',
    net_total: '1000.50',
    segment: 'Equity',
    ...overrides,
  };
}

function makeCharges(overrides: Partial<ZerodhaContractNoteCharges> = {}): ZerodhaContractNoteCharges {
  return {
    contract_note_no: 'CN-001',
    trade_date: '2024-01-15',
    settlement_no: 'S-001',
    pay_in_pay_out: '10000.00',
    brokerage: '10.00',
    exchange_charges: '5.00',
    clearing_charges: '1.00',
    cgst: '0.90',
    sgst: '0.90',
    igst: '0',
    stt: '10.00',
    sebi_fees: '0.10',
    stamp_duty: '1.50',
    net_amount: '9970.60',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('allocateCharges', () => {
  it('allocates 100% of charges to a single trade', () => {
    const trades = [makeTrade()];
    const charges = makeCharges();
    const result = allocateCharges(trades, charges);

    expect(result).toHaveLength(1);
    const r = result[0];

    // Brokerage: 0.05 * 10 = 0.50 (per-unit, not aggregate)
    expect(r.brokerage).toBe('0.50');
    // All proportional charges go to the single trade
    expect(r.stt).toBe('10.00');
    expect(r.exchange_charges).toBe('5.00');
    expect(r.clearing_charges).toBe('1.00');
    expect(r.cgst).toBe('0.90');
    expect(r.sgst).toBe('0.90');
    expect(r.igst).toBe('0.00');
    expect(r.sebi_fees).toBe('0.10');
    expect(r.stamp_duty).toBe('1.50');
  });

  it('splits 50/50 for two equal-value trades', () => {
    const trades = [
      makeTrade({ trade_no: '2001', quantity: '10', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2002', quantity: '10', gross_rate: '100.00', security_description: 'TCS LTD' }),
    ];
    const charges = makeCharges({ stt: '10.00', exchange_charges: '6.00' });
    const result = allocateCharges(trades, charges);

    expect(result).toHaveLength(2);
    expect(result[0].stt).toBe('5.00');
    expect(result[1].stt).toBe('5.00');
    expect(result[0].exchange_charges).toBe('3.00');
    expect(result[1].exchange_charges).toBe('3.00');
  });

  it('splits proportionally for unequal-value trades', () => {
    // Trade A: 10 * 100 = 1000 (25%)
    // Trade B: 30 * 100 = 3000 (75%)
    const trades = [
      makeTrade({ trade_no: '2001', quantity: '10', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2002', quantity: '30', gross_rate: '100.00' }),
    ];
    const charges = makeCharges({ stt: '100.00' });
    const result = allocateCharges(trades, charges);

    expect(result[0].stt).toBe('25.00');
    expect(result[1].stt).toBe('75.00');
  });

  it('falls back to proportional brokerage when all brokerage_per_unit are zero', () => {
    // XML contract notes do not carry per-unit brokerage rates — they only have
    // aggregate brokerage in grandtotals.  When all brokerage_per_unit = 0,
    // the allocator must distribute charges.brokerage proportionally by trade
    // value so no brokerage is silently dropped.
    //
    // Trade A: 10 * 100 = 1000 (25%)
    // Trade B: 30 * 100 = 3000 (75%)
    // Aggregate brokerage: 100 → A gets 25, B gets 75
    const trades = [
      makeTrade({ trade_no: '2001', quantity: '10', gross_rate: '100.00', brokerage_per_unit: '0' }),
      makeTrade({ trade_no: '2002', quantity: '30', gross_rate: '100.00', brokerage_per_unit: '0' }),
    ];
    const charges = makeCharges({ brokerage: '100.00' });
    const result = allocateCharges(trades, charges);

    expect(result[0].brokerage).toBe('25.00');
    expect(result[1].brokerage).toBe('75.00');

    // Sum must equal the aggregate exactly
    const total = new Decimal(result[0].brokerage).add(new Decimal(result[1].brokerage));
    expect(total.toFixed(2)).toBe('100.00');
  });

  it('uses per-unit brokerage calculation, not proportional', () => {
    // Trade A: brokerage_per_unit=0.10, qty=10 -> 1.00
    // Trade B: brokerage_per_unit=0.20, qty=5  -> 1.00
    // Aggregate brokerage in charges is ignored for per-trade calc
    const trades = [
      makeTrade({ trade_no: '2001', quantity: '10', brokerage_per_unit: '0.10' }),
      makeTrade({ trade_no: '2002', quantity: '5', brokerage_per_unit: '0.20' }),
    ];
    const charges = makeCharges({ brokerage: '999.99' }); // should be ignored
    const result = allocateCharges(trades, charges);

    expect(result[0].brokerage).toBe('1.00');
    expect(result[1].brokerage).toBe('1.00');
  });

  it('ensures allocated charges sum exactly to aggregate (remainder correction)', () => {
    // Three trades with values that cause rounding: 1000, 1000, 1000
    // STT=10.01 -> naive 10.01/3 = 3.3366... -> round to 3.34, 3.34, remainder = 3.33
    const trades = [
      makeTrade({ trade_no: '2001', quantity: '10', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2002', quantity: '10', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2003', quantity: '10', gross_rate: '100.00' }),
    ];
    const charges = makeCharges({ stt: '10.01' });
    const result = allocateCharges(trades, charges);

    const totalStt = result.reduce((sum, r) => sum.add(new Decimal(r.stt)), new Decimal(0));
    expect(totalStt.toFixed(2)).toBe('10.01');
  });

  it('allocates zero to a zero-value trade', () => {
    // Trade A: 0 * 100 = 0 (exercise/corporate action placeholder)
    // Trade B: 10 * 100 = 1000
    const trades = [
      makeTrade({ trade_no: '2001', quantity: '0', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2002', quantity: '10', gross_rate: '100.00' }),
    ];
    const charges = makeCharges({ stt: '10.00' });
    const result = allocateCharges(trades, charges);

    expect(result[0].stt).toBe('0.00');
    expect(result[1].stt).toBe('10.00');
  });

  it('allocates stamp duty only across buy-side turnover', () => {
    // Buy trade value = 1000, sell trade value = 1000.
    // Stamp duty must apply only to the buy side.
    const trades = [
      makeTrade({ trade_no: '2001', buy_sell: 'B', quantity: '10', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2002', buy_sell: 'S', quantity: '10', gross_rate: '100.00' }),
    ];
    const charges = makeCharges({ stamp_duty: '12.34' });
    const result = allocateCharges(trades, charges);

    expect(result[0].stamp_duty).toBe('12.34');
    expect(result[1].stamp_duty).toBe('0.00');
  });

  it('falls back to all-trades proportional split when stamp duty exists without any buy-side turnover', () => {
    // Edge case: a sell-only CN (reversal, broker batching quirk) still
    // carries a stamp-duty aggregate. Rather than block the pipeline, the
    // allocator falls back to proportional split across all trades so the
    // charge posts — user can reclassify in Tally.
    const trades = [
      makeTrade({ trade_no: '2001', buy_sell: 'S', quantity: '10', gross_rate: '100.00' }),
      makeTrade({ trade_no: '2002', buy_sell: 'S', quantity: '30', gross_rate: '100.00' }),
    ];
    const charges = makeCharges({ stamp_duty: '1.00' });

    const result = allocateCharges(trades, charges);
    // Proportional split: 1000/4000 * 1.00 = 0.25, 3000/4000 * 1.00 = 0.75
    expect(result[0].stamp_duty).toBe('0.25');
    expect(result[1].stamp_duty).toBe('0.75');
  });

  it('handles all-zero charges gracefully', () => {
    const trades = [makeTrade({ brokerage_per_unit: '0' })];
    const charges = makeCharges({
      brokerage: '0', stt: '0', exchange_charges: '0', clearing_charges: '0',
      cgst: '0', sgst: '0', igst: '0', sebi_fees: '0', stamp_duty: '0',
    });
    const result = allocateCharges(trades, charges);

    expect(result).toHaveLength(1);
    expect(result[0].stt).toBe('0.00');
    expect(result[0].brokerage).toBe('0.00');
    expect(result[0].exchange_charges).toBe('0.00');
  });

  it('returns empty array for empty trades', () => {
    const result = allocateCharges([], makeCharges());
    expect(result).toHaveLength(0);
  });

  it('populates trade metadata correctly', () => {
    const trades = [makeTrade({ trade_no: 'T99', order_no: 'O55', buy_sell: 'S' })];
    const result = allocateCharges(trades, makeCharges({ stamp_duty: '0' }));

    expect(result[0].trade_no).toBe('T99');
    expect(result[0].order_no).toBe('O55');
    expect(result[0].buy_sell).toBe('S');
    expect(result[0].security_description).toBe('RELIANCE INDUSTRIES LTD');
    expect(result[0].trade_value).toBe('1000.00');
    expect(result[0].allocation_weight).toBe('1.000000');
  });
});
