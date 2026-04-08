/**
 * Integration test: multi-file processing pipeline.
 * Tests the full flow from parsed data → canonical events → vouchers → XML
 * with various combinations of tradebook, contract notes, and funds statement.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import {
  buildCanonicalEvents,
  pairContractNoteData,
  type ContractNoteSheet,
} from '../canonical-events';
import { CostLotTracker } from '../cost-lots';
import { buildVouchers } from '../voucher-builder';
import { INVESTOR_DEFAULT } from '../accounting-policy';
import { matchTrades } from '../trade-matcher';
import { EventType } from '../../types/events';
import { TradeClassificationStrategy } from '../trade-classifier';
import type {
  ZerodhaTradebookRow,
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ZerodhaFundsStatementRow,
} from '../../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTradebookRow(overrides: Partial<ZerodhaTradebookRow> = {}): ZerodhaTradebookRow {
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

function makeCnTrade(overrides: Partial<ZerodhaContractNoteTradeRow> = {}): ZerodhaContractNoteTradeRow {
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

function makeCnCharges(overrides: Partial<ZerodhaContractNoteCharges> = {}): ZerodhaContractNoteCharges {
  return {
    contract_note_no: 'CN-001',
    trade_date: '15-01-2024',
    settlement_no: 'S-001',
    pay_in_pay_out: '25000.00',
    brokerage: '0.50',
    exchange_charges: '3.25',
    clearing_charges: '0.50',
    cgst: '0.34',
    sgst: '0.34',
    igst: '0',
    stt: '25.00',
    sebi_fees: '0.25',
    stamp_duty: '3.75',
    net_amount: '24966.07',
    ...overrides,
  };
}

function makeFundsRow(overrides: Partial<ZerodhaFundsStatementRow> = {}): ZerodhaFundsStatementRow {
  return {
    posting_date: '2024-01-14',
    segment: 'Equity',
    description: 'Funds received',
    debit: '0',
    credit: '50000.00',
    running_balance: '50000.00',
    instrument: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('multi-file pipeline integration', () => {
  it('tradebook-only: unchanged behavior — produces trade events and balanced vouchers', () => {
    const buyRow = makeTradebookRow({ trade_type: 'buy', trade_id: '2001' });
    const sellRow = makeTradebookRow({
      trade_type: 'sell', trade_id: '2002', trade_date: '2024-02-15',
      quantity: '5', price: '2800.00',
    });

    const events = buildCanonicalEvents({
      tradebookRows: [buyRow, sellRow],
      batchId: 'batch-tb',
      fileIds: { tradebook: 'file-tb' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe(EventType.BUY_TRADE);
    expect(events[1].event_type).toBe(EventType.SELL_TRADE);

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);
    expect(vouchers).toHaveLength(2);
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });

  it('contract notes only: produces trades + charges, vouchers balance', () => {
    const trade = makeCnTrade();
    const charges = makeCnCharges();
    const sheets: ContractNoteSheet[] = [{ charges, trades: [trade] }];

    const events = buildCanonicalEvents({
      contractNoteSheets: sheets,
      batchId: 'batch-cn',
      fileIds: { contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    const chargeEvents = events.filter(
      (e) => e.event_type !== EventType.BUY_TRADE && e.event_type !== EventType.SELL_TRADE,
    );

    expect(tradeEvents).toHaveLength(1);
    expect(chargeEvents.length).toBeGreaterThan(0);

    // Verify charge events carry contract_note_ref
    for (const ce of chargeEvents) {
      expect(ce.contract_note_ref).toBe('CN-001');
      expect(ce.external_ref).toBe('2001');
    }

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);
    expect(vouchers.length).toBeGreaterThan(0);
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });

  it('tradebook + contract notes: dedup works, charges attached, vouchers balance', () => {
    // Same trade appears in both: CN should win
    const tbRow = makeTradebookRow({ trade_id: '2001' });
    const cnTrade = makeCnTrade({ trade_no: '2001' });
    const charges = makeCnCharges();

    const events = buildCanonicalEvents({
      tradebookRows: [tbRow],
      contractNoteSheets: [{ charges, trades: [cnTrade] }],
      batchId: 'batch-both',
      fileIds: { tradebook: 'file-tb', contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    // Should have 1 trade (from CN) + N charges, NOT 2 trades
    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(1);
    expect(tradeEvents[0].contract_note_ref).toBe('CN-001');

    // Charges should be present
    const chargeEvents = events.filter(
      (e) => e.event_type !== EventType.BUY_TRADE && e.event_type !== EventType.SELL_TRADE,
    );
    expect(chargeEvents.length).toBeGreaterThan(0);

    const tracker = new CostLotTracker();
    const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker);
    for (const v of vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });

  it('tradebook + contract notes + funds statement: all sources merged', () => {
    const tbRow = makeTradebookRow({ trade_id: '2001' });
    const cnTrade = makeCnTrade({ trade_no: '2001' });
    const charges = makeCnCharges();
    const fundsRow = makeFundsRow();

    const events = buildCanonicalEvents({
      tradebookRows: [tbRow],
      contractNoteSheets: [{ charges, trades: [cnTrade] }],
      fundsRows: [fundsRow],
      batchId: 'batch-all',
      fileIds: { tradebook: 'file-tb', contractNote: 'file-cn', fundsStatement: 'file-fs' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    // Should have: 1 trade (CN) + charges + 1 BANK_RECEIPT (from funds)
    const bankEvents = events.filter((e) => e.event_type === EventType.BANK_RECEIPT);
    expect(bankEvents).toHaveLength(1);
    expect(bankEvents[0].gross_amount).toBe('50000.00');
  });

  it('trade matching: reports correct match stats', () => {
    const tbRows = [
      makeTradebookRow({ trade_id: '2001' }),
      makeTradebookRow({ trade_id: '3001', symbol: 'TCS', trade_date: '2024-01-20' }),
    ];
    const cnTradesWithDate = [
      { trade: makeCnTrade({ trade_no: '2001' }), tradeDate: '15-01-2024' },
    ];

    const result = matchTrades(tbRows, cnTradesWithDate);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].match_confidence).toBe('EXACT');
    expect(result.unmatchedTradebook).toHaveLength(1);
    expect(result.unmatchedTradebook[0].trade_id).toBe('3001');
    expect(result.unmatchedContractNote).toHaveLength(0);
  });

  it('multi-date contract notes: pairContractNoteData groups correctly', () => {
    const trades = [
      makeCnTrade({ trade_no: 'T1' }),
      makeCnTrade({ trade_no: 'T2' }),
      makeCnTrade({ trade_no: 'T3' }),
    ];
    const charges = [
      makeCnCharges({ trade_date: '15-01-2024', contract_note_no: 'CN-1' }),
      makeCnCharges({ trade_date: '16-01-2024', contract_note_no: 'CN-2' }),
    ];
    const sheets = pairContractNoteData(trades, charges, [2, 1]);

    expect(sheets).toHaveLength(2);
    expect(sheets[0].trades).toHaveLength(2);
    expect(sheets[1].trades).toHaveLength(1);

    const events = buildCanonicalEvents({
      contractNoteSheets: sheets,
      batchId: 'batch-multi',
      fileIds: { contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    // 3 trades + charges for each
    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(3);

    // Verify trades from sheet 1 have CN-1, trades from sheet 2 have CN-2
    const cn1Trades = tradeEvents.filter((e) => e.contract_note_ref === 'CN-1');
    const cn2Trades = tradeEvents.filter((e) => e.contract_note_ref === 'CN-2');
    expect(cn1Trades).toHaveLength(2);
    expect(cn2Trades).toHaveLength(1);
  });

  it('charge allocation sums match aggregate across multi-trade date', () => {
    const trades = [
      makeCnTrade({ trade_no: 'T1', quantity: '10', gross_rate: '1000.00', brokerage_per_unit: '0.10' }),
      makeCnTrade({ trade_no: 'T2', quantity: '20', gross_rate: '500.00', brokerage_per_unit: '0.05' }),
    ];
    const charges = makeCnCharges({ stt: '15.00' });
    const sheets: ContractNoteSheet[] = [{ charges, trades }];

    const events = buildCanonicalEvents({
      contractNoteSheets: sheets,
      batchId: 'batch-alloc',
      fileIds: { contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    const sttEvents = events.filter((e) => e.charge_type === 'STT');
    const totalStt = sttEvents.reduce(
      (sum, e) => sum.add(new Decimal(e.charge_amount)),
      new Decimal(0),
    );
    expect(totalStt.toFixed(2)).toBe('15.00');
  });
});
