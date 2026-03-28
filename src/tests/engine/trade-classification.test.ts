import { describe, expect, it } from 'vitest';

import { tradebookRowToEvents } from '../../lib/engine/canonical-events';
import { TradeCategory } from '../../lib/types/events';
import type { ZerodhaTradebookRow } from '../../lib/parsers/zerodha/types';

/** Helper to build a minimal tradebook row with overrides. */
function makeRow(overrides: Partial<ZerodhaTradebookRow> = {}): ZerodhaTradebookRow {
  return {
    trade_date: '2024-04-01',
    exchange: 'NSE',
    segment: 'EQ',
    symbol: 'RELIANCE',
    isin: 'INE002A01018',
    trade_type: 'buy',
    quantity: '10',
    price: '2500.00',
    trade_id: 'T001',
    order_id: 'O001',
    order_execution_time: '2024-04-01 09:30:00',
    ...overrides,
  };
}

describe('trade category classification', () => {
  it('classifies CNC as DELIVERY', () => {
    const row = makeRow({ product: 'CNC' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.DELIVERY);
  });

  it('classifies MTF as DELIVERY', () => {
    const row = makeRow({ product: 'MTF' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.DELIVERY);
  });

  it('classifies MIS on equity as INTRADAY', () => {
    const row = makeRow({ product: 'MIS', segment: 'EQ' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.INTRADAY);
  });

  it('classifies MIS on F&O segment as FNO (not INTRADAY)', () => {
    const row = makeRow({ product: 'MIS', segment: 'FO' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.FNO);
  });

  it('classifies NRML on NFO segment as FNO', () => {
    const row = makeRow({ product: 'NRML', segment: 'NFO' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.FNO);
  });

  it('classifies NRML on BFO segment as FNO', () => {
    const row = makeRow({ product: 'NRML', segment: 'BFO' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.FNO);
  });

  it('classifies NRML on equity segment as DELIVERY', () => {
    const row = makeRow({ product: 'NRML', segment: 'EQ' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.DELIVERY);
  });

  it('classifies MCX exchange trades as COMMODITY regardless of product', () => {
    const row = makeRow({ exchange: 'MCX', product: 'NRML', segment: 'FO' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.COMMODITY);
  });

  it('classifies MCX with MIS as COMMODITY', () => {
    const row = makeRow({ exchange: 'MCX', product: 'MIS', segment: 'FO' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.COMMODITY);
  });

  it('defaults to DELIVERY when no product marker on equity', () => {
    const row = makeRow({ segment: 'EQ' }); // no product field
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.DELIVERY);
  });

  it('defaults to FNO when no product marker on NFO segment', () => {
    const row = makeRow({ segment: 'NFO' }); // no product field
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.FNO);
  });

  it('classifies CDS segment as FNO', () => {
    const row = makeRow({ product: 'NRML', segment: 'CDS' });
    const [event] = tradebookRowToEvents(row, 'batch-1', 'file-1');
    expect(event.trade_category).toBe(TradeCategory.FNO);
  });
});
