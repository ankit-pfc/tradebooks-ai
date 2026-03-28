import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';

import {
  INVESTOR_DEFAULT,
  TRADER_DEFAULT,
} from '../../lib/engine/accounting-policy';
import { CostLotTracker } from '../../lib/engine/cost-lots';
import {
  buildBuyVoucher,
  buildSellVoucher,
  buildVouchers,
} from '../../lib/engine/voucher-builder';
import { EventType, TradeCategory } from '../../lib/types/events';
import type { CanonicalEvent } from '../../lib/types/events';
import type { VoucherLine } from '../../lib/types/vouchers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTradeEvent(
  overrides: Partial<CanonicalEvent> = {},
): CanonicalEvent {
  return {
    event_id: crypto.randomUUID(),
    import_batch_id: 'batch-1',
    event_type: EventType.BUY_TRADE,
    trade_category: TradeCategory.DELIVERY,
    event_date: '2024-01-15',
    settlement_date: null,
    security_id: 'NSE:INFY',
    quantity: '10',
    rate: '1500',
    gross_amount: '15000.00',
    charge_type: null,
    charge_amount: '0',
    source_file_id: 'file-1',
    source_row_ids: ['row-1'],
    contract_note_ref: null,
    external_ref: null,
    event_hash: 'hash-1',
    ...overrides,
  };
}

function makeChargeEvent(
  eventType: EventType,
  amount: string,
  overrides: Partial<CanonicalEvent> = {},
): CanonicalEvent {
  return makeTradeEvent({
    event_type: eventType,
    trade_category: null,
    security_id: 'NSE:INFY',
    quantity: '0',
    rate: '0',
    gross_amount: '0',
    charge_type: eventType,
    charge_amount: amount,
    ...overrides,
  });
}

function findLine(
  lines: VoucherLine[],
  ledger: string,
  drCr?: 'DR' | 'CR',
): VoucherLine | undefined {
  return lines.find(
    (l) =>
      l.ledger_name === ledger && (drCr === undefined || l.dr_cr === drCr),
  );
}

// ---------------------------------------------------------------------------
// INVESTOR MODE — Buy with STT separation
// ---------------------------------------------------------------------------

describe('investor mode — buy voucher', () => {
  it('capitalises allowable charges but keeps STT separate (Capital A/c)', () => {
    const buyEvent = makeTradeEvent();
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.STT, '15.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '3.60'),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '2.50'),
      makeChargeEvent(EventType.SEBI_CHARGE, '0.30'),
      makeChargeEvent(EventType.STAMP_DUTY, '7.50'),
    ];

    const voucher = buildBuyVoucher(buyEvent, INVESTOR_DEFAULT, charges);

    // Asset line should have gross + allowable charges (NOT STT)
    // Allowable = 20 + 3.60 + 2.50 + 0.30 + 7.50 = 33.90
    const assetLine = findLine(
      voucher.lines,
      'Investment in Equity Shares - INFY',
      'DR',
    )!;
    expect(assetLine).toBeDefined();
    expect(assetLine.amount).toBe('15033.90'); // 15000 + 33.90

    // STT goes to its own DR line (Capital A/c per accounting-policy)
    const sttLine = findLine(voucher.lines, 'STT', 'DR')!;
    expect(sttLine).toBeDefined();
    expect(sttLine.amount).toBe('15.00');

    // CR: Zerodha Broking = gross + ALL charges including STT
    const brokerLine = findLine(voucher.lines, 'Zerodha Broking', 'CR')!;
    expect(brokerLine).toBeDefined();
    expect(brokerLine.amount).toBe('15048.90'); // 15000 + 33.90 + 15

    // Voucher balanced
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('handles buy with no charges', () => {
    const buyEvent = makeTradeEvent();
    const voucher = buildBuyVoucher(buyEvent, INVESTOR_DEFAULT, []);
    expect(voucher.lines).toHaveLength(2); // asset DR + broker CR
    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// INVESTOR MODE — Sell with STCG/LTCG
// ---------------------------------------------------------------------------

describe('investor mode — sell voucher with STCG/LTCG', () => {
  it('books Short Term Capital Gain when holding < 12 months', () => {
    const tracker = new CostLotTracker();

    // Buy on Jan 15, 2024
    const buyEvent = makeTradeEvent({
      event_date: '2024-01-15',
      quantity: '10',
      rate: '1500',
      gross_amount: '15000.00',
    });
    tracker.addLot(buyEvent);

    // Sell on Jun 15, 2024 (5 months — short term)
    const sellEvent = makeTradeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2024-06-15',
      quantity: '-10',
      rate: '1600',
      gross_amount: '16000.00',
    });
    const disposals = tracker.disposeLots(sellEvent, 'FIFO');

    const voucher = buildSellVoucher(
      sellEvent,
      INVESTOR_DEFAULT,
      [],
      disposals,
    );

    // Should have Short Term Capital Gain ledger
    const stcgLine = findLine(
      voucher.lines,
      'Short Term Capital Gain',
      'CR',
    );
    expect(stcgLine).toBeDefined();
    expect(stcgLine!.amount).toBe('1000.00'); // 16000 - 15000

    // Should NOT have Long Term Capital Gain
    const ltcgLine = findLine(voucher.lines, 'Long Term Capital Gain', 'CR');
    expect(ltcgLine).toBeUndefined();

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('books Long Term Capital Gain when holding >= 12 months', () => {
    const tracker = new CostLotTracker();

    // Buy on Jan 15, 2023
    const buyEvent = makeTradeEvent({
      event_date: '2023-01-15',
      quantity: '10',
      rate: '1500',
      gross_amount: '15000.00',
    });
    tracker.addLot(buyEvent);

    // Sell on Feb 15, 2024 (13 months — long term)
    const sellEvent = makeTradeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2024-02-15',
      quantity: '-10',
      rate: '1800',
      gross_amount: '18000.00',
    });
    const disposals = tracker.disposeLots(sellEvent, 'FIFO');

    const voucher = buildSellVoucher(
      sellEvent,
      INVESTOR_DEFAULT,
      [],
      disposals,
    );

    const ltcgLine = findLine(
      voucher.lines,
      'Long Term Capital Gain',
      'CR',
    );
    expect(ltcgLine).toBeDefined();
    expect(ltcgLine!.amount).toBe('3000.00'); // 18000 - 15000

    const stcgLine = findLine(
      voucher.lines,
      'Short Term Capital Gain',
      'CR',
    );
    expect(stcgLine).toBeUndefined();

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('books Short Term Capital Loss on investor sell at a loss', () => {
    const tracker = new CostLotTracker();

    const buyEvent = makeTradeEvent({
      event_date: '2024-01-15',
      quantity: '10',
      rate: '1500',
      gross_amount: '15000.00',
    });
    tracker.addLot(buyEvent);

    // Sell at loss (holding < 12 months)
    const sellEvent = makeTradeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2024-03-15',
      quantity: '-10',
      rate: '1400',
      gross_amount: '14000.00',
    });
    const disposals = tracker.disposeLots(sellEvent, 'FIFO');

    const voucher = buildSellVoucher(
      sellEvent,
      INVESTOR_DEFAULT,
      [],
      disposals,
    );

    // Should have Short Term Capital Loss (DR to Capital Account)
    const stclLine = findLine(
      voucher.lines,
      'Short Term Capital Loss',
      'DR',
    );
    expect(stclLine).toBeDefined();
    expect(stclLine!.amount).toBe('1000.00'); // |14000 - 15000|

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('investor sell: STT goes to Capital A/c, allowable charges reduce sale proceeds', () => {
    const tracker = new CostLotTracker();

    const buyEvent = makeTradeEvent({
      event_date: '2024-01-15',
      quantity: '10',
      rate: '1500',
      gross_amount: '15000.00',
    });
    tracker.addLot(buyEvent);

    const sellEvent = makeTradeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2024-06-15',
      quantity: '-10',
      rate: '1600',
      gross_amount: '16000.00',
    });

    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00', {
        event_date: '2024-06-15',
      }),
      makeChargeEvent(EventType.STT, '16.00', { event_date: '2024-06-15' }),
      makeChargeEvent(EventType.EXCHANGE_CHARGE, '2.50', {
        event_date: '2024-06-15',
      }),
    ];

    const disposals = tracker.disposeLots(sellEvent, 'FIFO');

    const voucher = buildSellVoucher(
      sellEvent,
      INVESTOR_DEFAULT,
      charges,
      disposals,
    );

    // STT should appear as a separate DR line (Capital A/c)
    const sttLine = findLine(voucher.lines, 'STT', 'DR');
    expect(sttLine).toBeDefined();
    expect(sttLine!.amount).toBe('16.00');

    // For investors, allowable charges do NOT appear as separate DR lines.
    // They are "reduced from sale price" and thus embedded in the capital gain calculation.
    expect(findLine(voucher.lines, 'Brokerage', 'DR')).toBeUndefined();
    expect(
      findLine(voucher.lines, 'Exchange Transaction Charges', 'DR'),
    ).toBeUndefined();

    // Zerodha Broking DR = gross - all charges (net proceeds)
    const brokerLine = findLine(voucher.lines, 'Zerodha Broking', 'DR')!;
    expect(brokerLine.amount).toBe('15961.50'); // 16000 - 20 - 16 - 2.50

    // STCG should be reduced by allowable charges (brokerage + exchange = 22.50)
    // Raw gain = 1000, net gain = 1000 - 22.50 = 977.50
    const stcgLine = findLine(
      voucher.lines,
      'Short Term Capital Gain',
      'CR',
    );
    expect(stcgLine).toBeDefined();
    expect(stcgLine!.amount).toBe('977.50');

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// TRADER MODE — Business income entries
// ---------------------------------------------------------------------------

describe('trader mode — business income entries', () => {
  it('expenses all charges including STT on buy', () => {
    const buyEvent = makeTradeEvent();
    const charges = [
      makeChargeEvent(EventType.BROKERAGE, '20.00'),
      makeChargeEvent(EventType.STT, '15.00'),
      makeChargeEvent(EventType.GST_ON_CHARGES, '3.60'),
    ];

    const voucher = buildBuyVoucher(buyEvent, TRADER_DEFAULT, charges);

    // Asset at gross (no charges capitalised in trader mode)
    const assetLine = findLine(
      voucher.lines,
      'Shares-in-Trade - INFY',
      'DR',
    )!;
    expect(assetLine.amount).toBe('15000.00');

    // Each charge is a separate DR line
    expect(findLine(voucher.lines, 'Brokerage', 'DR')!.amount).toBe('20.00');
    expect(findLine(voucher.lines, 'STT', 'DR')!.amount).toBe('15.00');
    expect(
      findLine(voucher.lines, 'GST on Brokerage/Charges', 'DR')!.amount,
    ).toBe('3.60');

    // Broker CR = gross + all charges
    const brokerLine = findLine(voucher.lines, 'Zerodha Broking', 'CR')!;
    expect(brokerLine.amount).toBe('15038.60'); // 15000 + 38.60

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });

  it('trader sell: uses Trading Sales and Cost of Shares Sold ledgers', () => {
    const tracker = new CostLotTracker();

    const buyEvent = makeTradeEvent({
      event_date: '2024-01-15',
      quantity: '10',
      rate: '1500',
      gross_amount: '15000.00',
    });
    tracker.addLot(buyEvent);

    const sellEvent = makeTradeEvent({
      event_type: EventType.SELL_TRADE,
      event_date: '2024-01-15', // same day — intraday
      quantity: '-10',
      rate: '1550',
      gross_amount: '15500.00',
    });

    const disposals = tracker.disposeLots(sellEvent, 'FIFO');

    const voucher = buildSellVoucher(
      sellEvent,
      TRADER_DEFAULT,
      [],
      disposals,
    );

    // Should use Trading Sales and Cost of Shares Sold (NOT capital gains)
    expect(findLine(voucher.lines, 'Trading Sales', 'CR')).toBeDefined();
    expect(findLine(voucher.lines, 'Cost of Shares Sold', 'DR')).toBeDefined();
    expect(
      findLine(voucher.lines, 'Shares-in-Trade - INFY', 'CR'),
    ).toBeDefined();

    // Should NOT have any capital gain/loss ledgers
    expect(
      findLine(voucher.lines, 'Short Term Capital Gain', 'CR'),
    ).toBeUndefined();
    expect(
      findLine(voucher.lines, 'Long Term Capital Gain', 'CR'),
    ).toBeUndefined();

    expect(voucher.total_debit).toBe(voucher.total_credit);
  });
});

// ---------------------------------------------------------------------------
// buildVouchers orchestrator — STT cost basis exclusion
// ---------------------------------------------------------------------------

describe('buildVouchers orchestrator', () => {
  it('investor: STT is NOT included in cost basis for lot tracker', () => {
    const buyEvent = makeTradeEvent({
      event_id: 'buy-1',
      event_date: '2024-01-15',
      quantity: '10',
      rate: '1500',
      gross_amount: '15000.00',
    });

    const sttCharge = makeChargeEvent(EventType.STT, '15.00', {
      event_id: 'stt-1',
      event_date: '2024-01-15',
      security_id: 'NSE:INFY',
    });
    const brokerageCharge = makeChargeEvent(EventType.BROKERAGE, '20.00', {
      event_id: 'brok-1',
      event_date: '2024-01-15',
      security_id: 'NSE:INFY',
    });

    const sellEvent = makeTradeEvent({
      event_id: 'sell-1',
      event_type: EventType.SELL_TRADE,
      event_date: '2024-06-15',
      quantity: '-10',
      rate: '1500',
      gross_amount: '15000.00', // sell at same price
    });

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(
      [buyEvent, sttCharge, brokerageCharge, sellEvent],
      INVESTOR_DEFAULT,
      tracker,
    );

    expect(vouchers).toHaveLength(2);

    // Check cost basis: lot should be 15000 + 20 (brokerage) = 15020, NOT 15035
    const sellVoucher = vouchers[1];
    const assetCrLine = findLine(
      sellVoucher.lines,
      'Investment in Equity Shares - INFY',
      'CR',
    )!;
    expect(assetCrLine.amount).toBe('15020.00'); // gross + brokerage only (no STT)

    expect(sellVoucher.total_debit).toBe(sellVoucher.total_credit);
  });
});
