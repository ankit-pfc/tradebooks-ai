import { describe, expect, it } from 'vitest';
import { matchTrades, flattenCnTradesWithDate } from '../trade-matcher';
import type {
  ZerodhaTradebookRow,
  ZerodhaContractNoteTradeRow,
} from '../../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTb(overrides: Partial<ZerodhaTradebookRow> = {}): ZerodhaTradebookRow {
  return {
    trade_date: '2024-01-15',
    exchange: 'NSE',
    segment: 'EQ',
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    trade_type: 'buy',
    quantity: '10',
    price: '2500.00',
    trade_id: '2001',
    order_id: '1001',
    order_execution_time: '10:00:01',
    ...overrides,
  };
}

function makeCn(overrides: Partial<ZerodhaContractNoteTradeRow> = {}): ZerodhaContractNoteTradeRow {
  return {
    order_no: '1001',
    order_time: '10:00:00',
    trade_no: '2001',
    trade_time: '10:00:01',
    security_description: 'RELIANCE INDUSTRIES LTD',
    buy_sell: 'B',
    quantity: '10',
    exchange: 'NSE',
    gross_rate: '2500.00',
    brokerage_per_unit: '0.05',
    net_rate: '2500.05',
    net_total: '25000.50',
    segment: 'Equity',
    ...overrides,
  };
}

function withDate(trade: ZerodhaContractNoteTradeRow, date: string) {
  return { trade, tradeDate: date };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('matchTrades', () => {
  it('matches exactly by trade_no == trade_id', () => {
    const result = matchTrades(
      [makeTb({ trade_id: '2001' })],
      [withDate(makeCn({ trade_no: '2001' }), '15-01-2024')],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].match_confidence).toBe('EXACT');
    expect(result.unmatchedTradebook).toHaveLength(0);
    expect(result.unmatchedContractNote).toHaveLength(0);
  });

  it('matches with HIGH confidence by order_no + qty + date', () => {
    const result = matchTrades(
      [makeTb({ trade_id: '9999', order_id: '1001', quantity: '10', trade_date: '2024-01-15' })],
      [withDate(makeCn({ trade_no: '8888', order_no: '1001', quantity: '10' }), '15-01-2024')],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].match_confidence).toBe('HIGH');
  });

  it('matches approximately by date + security + direction + qty + price', () => {
    const result = matchTrades(
      [makeTb({ trade_id: '9999', order_id: '5555', symbol: 'RELIANCE', price: '2500.00' })],
      [withDate(
        makeCn({ trade_no: '8888', order_no: '6666', security_description: 'RELIANCE INDUSTRIES LTD', gross_rate: '2500.02' }),
        '15-01-2024',
      )],
    );

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].match_confidence).toBe('APPROXIMATE');
  });

  it('reports unmatched rows on both sides', () => {
    const result = matchTrades(
      [
        makeTb({ trade_id: '2001' }),
        makeTb({ trade_id: '3001', symbol: 'TCS', trade_date: '2024-01-20' }),
      ],
      [
        withDate(makeCn({ trade_no: '2001' }), '15-01-2024'),
        withDate(makeCn({ trade_no: '4001', security_description: 'HDFC BANK LTD' }), '18-01-2024'),
      ],
    );

    expect(result.matched).toHaveLength(1); // only trade_no 2001 matches
    expect(result.unmatchedTradebook).toHaveLength(1);
    expect(result.unmatchedTradebook[0].trade_id).toBe('3001');
    expect(result.unmatchedContractNote).toHaveLength(1);
    expect(result.unmatchedContractNote[0].trade_no).toBe('4001');
  });

  it('handles intraday: same security bought and sold on same day', () => {
    const result = matchTrades(
      [
        makeTb({ trade_id: '2001', trade_type: 'buy' }),
        makeTb({ trade_id: '2002', trade_type: 'sell' }),
      ],
      [
        withDate(makeCn({ trade_no: '2001', buy_sell: 'B' }), '15-01-2024'),
        withDate(makeCn({ trade_no: '2002', buy_sell: 'S' }), '15-01-2024'),
      ],
    );

    expect(result.matched).toHaveLength(2);
    expect(result.matched[0].match_confidence).toBe('EXACT');
    expect(result.matched[1].match_confidence).toBe('EXACT');
    expect(result.unmatchedTradebook).toHaveLength(0);
    expect(result.unmatchedContractNote).toHaveLength(0);
  });

  it('handles partial fills: one order with multiple trades', () => {
    const result = matchTrades(
      [
        makeTb({ trade_id: '2001', order_id: '1001', quantity: '5' }),
        makeTb({ trade_id: '2002', order_id: '1001', quantity: '5' }),
      ],
      [
        withDate(makeCn({ trade_no: '2001', order_no: '1001', quantity: '5' }), '15-01-2024'),
        withDate(makeCn({ trade_no: '2002', order_no: '1001', quantity: '5' }), '15-01-2024'),
      ],
    );

    expect(result.matched).toHaveLength(2);
    expect(result.matched.every((m) => m.match_confidence === 'EXACT')).toBe(true);
  });

  it('prioritises EXACT over APPROXIMATE for same trade', () => {
    // Both rows could match approximately, but trade_no gives exact match
    const result = matchTrades(
      [makeTb({ trade_id: '2001' })],
      [withDate(makeCn({ trade_no: '2001' }), '15-01-2024')],
    );

    expect(result.matched[0].match_confidence).toBe('EXACT');
  });

  it('handles empty inputs', () => {
    expect(matchTrades([], []).matched).toHaveLength(0);
    expect(matchTrades([makeTb()], []).unmatchedTradebook).toHaveLength(1);
    expect(matchTrades([], [withDate(makeCn(), '15-01-2024')]).unmatchedContractNote).toHaveLength(1);
  });
});

describe('flattenCnTradesWithDate', () => {
  it('assigns correct dates to trades based on tradesPerSheet', () => {
    const trades = [
      makeCn({ trade_no: 'T1' }),
      makeCn({ trade_no: 'T2' }),
      makeCn({ trade_no: 'T3' }),
    ];
    const charges = [
      { contract_note_no: '', trade_date: '15-01-2024', settlement_no: '', pay_in_pay_out: '0', brokerage: '0', exchange_charges: '0', clearing_charges: '0', cgst: '0', sgst: '0', igst: '0', stt: '0', sebi_fees: '0', stamp_duty: '0', net_amount: '0' },
      { contract_note_no: '', trade_date: '16-01-2024', settlement_no: '', pay_in_pay_out: '0', brokerage: '0', exchange_charges: '0', clearing_charges: '0', cgst: '0', sgst: '0', igst: '0', stt: '0', sebi_fees: '0', stamp_duty: '0', net_amount: '0' },
    ];
    const result = flattenCnTradesWithDate(trades, charges, [2, 1]);

    expect(result).toHaveLength(3);
    expect(result[0].tradeDate).toBe('15-01-2024');
    expect(result[1].tradeDate).toBe('15-01-2024');
    expect(result[2].tradeDate).toBe('16-01-2024');
  });
});
