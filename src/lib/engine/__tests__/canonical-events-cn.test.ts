import { describe, expect, it } from 'vitest';
import {
  contractNoteToEvents,
  buildCanonicalEvents,
  pairContractNoteData,
  buildSecurityIdFromDescription,
  reclassifyIntradayTrades,
} from '../canonical-events';
import { EventType } from '../../types/events';
import { TradeClassification, TradeClassificationStrategy } from '../trade-classifier';
import type {
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ZerodhaTradebookRow,
} from '../../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
    brokerage: '10.00',
    exchange_charges: '5.00',
    clearing_charges: '1.00',
    cgst: '0.90',
    sgst: '0.90',
    igst: '0',
    stt: '25.00',
    sebi_fees: '0.25',
    stamp_duty: '3.75',
    net_amount: '24953.20',
    ...overrides,
  };
}

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

// ---------------------------------------------------------------------------
// buildSecurityIdFromDescription
// ---------------------------------------------------------------------------

describe('buildSecurityIdFromDescription', () => {
  it('extracts first word as symbol', () => {
    expect(buildSecurityIdFromDescription('NSE', 'RELIANCE INDUSTRIES LTD'))
      .toBe('NSE:RELIANCE');
  });

  it('handles single-word descriptions', () => {
    expect(buildSecurityIdFromDescription('BSE', 'INFY'))
      .toBe('BSE:INFY');
  });

  it('correctly handles XML instrument_id descriptions (exchange prefix already stripped)', () => {
    // XML contract notes use "NSE:BOSCHLTD - EQ / ISIN..." as instrument_id.
    // The XML parser strips the "NSE:" prefix before passing to security_description,
    // so this function receives "BOSCHLTD - EQ / ISIN..." and must return "NSE:BOSCHLTD".
    // Without the strip, the raw instrument_id would yield "NSE:NSE:BOSCHLTD".
    expect(buildSecurityIdFromDescription('NSE', 'BOSCHLTD - EQ / INE323A01026'))
      .toBe('NSE:BOSCHLTD');
  });

  it('uses ISIN from description for equity segment when ISIN is present', () => {
    const lookup = new Map<string, string>([
      ['ADSL - EQ / INE674K01013', 'ADSL'],
    ]);

    // With equity segment and ISIN in description, ISIN takes priority
    expect(buildSecurityIdFromDescription('NSE', 'ADSL - EQ / INE674K01013', 'EQ', lookup))
      .toBe('ISIN:INE674K01013');
  });

  it('extracts INF-prefix ISIN (ETFs/mutual funds)', () => {
    expect(buildSecurityIdFromDescription('NSE', 'NIFTYBEES - EQ / INF204KB14Y4', 'EQ'))
      .toBe('ISIN:INF204KB14Y4');
  });

  it('extracts IN9-prefix ISIN (government securities)', () => {
    expect(buildSecurityIdFromDescription('NSE', 'GSEC2030 - EQ / IN9328A01010', 'EQ'))
      .toBe('ISIN:IN9328A01010');
  });

  it('does not match non-Indian ISINs (e.g. US)', () => {
    // US ISINs should not be extracted — we only handle Indian securities
    expect(buildSecurityIdFromDescription('NSE', 'APPLE - EQ / US0378331005', 'EQ'))
      .toBe('EQ:APPLE');
  });
});

// ---------------------------------------------------------------------------
// contractNoteToEvents
// ---------------------------------------------------------------------------

describe('contractNoteToEvents', () => {
  it('produces one trade event and charge events for a single trade', () => {
    const events = contractNoteToEvents(
      [makeCnTrade()],
      makeCnCharges(),
      'batch-1',
      'file-cn-1',
    );

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    const chargeEvents = events.filter(
      (e) => e.event_type !== EventType.BUY_TRADE && e.event_type !== EventType.SELL_TRADE,
    );

    expect(tradeEvents).toHaveLength(1);
    expect(tradeEvents[0].event_type).toBe(EventType.BUY_TRADE);
    expect(tradeEvents[0].security_id).toBe('EQ:RELIANCE');
    expect(tradeEvents[0].quantity).toBe('10');
    expect(tradeEvents[0].rate).toBe('2500');
    expect(tradeEvents[0].gross_amount).toBe('25000.00');
    expect(tradeEvents[0].contract_note_ref).toBe('CN-001');
    expect(tradeEvents[0].external_ref).toBe('2001');

    // Should have: BROKERAGE, STT, EXCHANGE_CHARGE, CLEARING_CHARGE, SEBI_CHARGE, STAMP_DUTY, GST_ON_CHARGES
    expect(chargeEvents.length).toBeGreaterThanOrEqual(5);

    const brokerage = chargeEvents.find((e) => e.charge_type === 'BROKERAGE');
    expect(brokerage).toBeDefined();
    expect(brokerage!.charge_amount).toBe('0.50'); // 0.05 * 10

    const stt = chargeEvents.find((e) => e.charge_type === 'STT');
    expect(stt).toBeDefined();
    expect(stt!.charge_amount).toBe('25.00');
  });

  it('produces sell trade events correctly', () => {
    const events = contractNoteToEvents(
      [makeCnTrade({ buy_sell: 'S' })],
      makeCnCharges({ stamp_duty: '0' }),
      'batch-1',
      'file-cn-1',
    );

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(1);
    expect(tradeEvents[0].quantity).toBe('-10'); // negative for sells
  });

  it('consolidates GST (CGST + SGST + IGST) into one event', () => {
    const events = contractNoteToEvents(
      [makeCnTrade()],
      makeCnCharges({ cgst: '0.90', sgst: '0.90', igst: '0' }),
      'batch-1',
      'file-cn-1',
    );

    const gstEvents = events.filter((e) => e.event_type === EventType.GST_ON_CHARGES);
    expect(gstEvents).toHaveLength(1);
    expect(gstEvents[0].charge_amount).toBe('1.80'); // 0.90 + 0.90
  });

  it('handles IGST-only GST (interstate)', () => {
    const events = contractNoteToEvents(
      [makeCnTrade()],
      makeCnCharges({ cgst: '0', sgst: '0', igst: '1.80' }),
      'batch-1',
      'file-cn-1',
    );

    const gstEvents = events.filter((e) => e.event_type === EventType.GST_ON_CHARGES);
    expect(gstEvents).toHaveLength(1);
    expect(gstEvents[0].charge_amount).toBe('1.80');
  });

  it('allocates charges proportionally across multiple trades', () => {
    const trades = [
      makeCnTrade({ trade_no: '2001', quantity: '10', gross_rate: '100.00' }),
      makeCnTrade({ trade_no: '2002', quantity: '30', gross_rate: '100.00', security_description: 'TCS LTD' }),
    ];
    // STT=40 should split 25% / 75%
    const charges = makeCnCharges({ stt: '40.00' });
    const events = contractNoteToEvents(trades, charges, 'batch-1', 'file-cn-1');

    const sttEvents = events.filter((e) => e.charge_type === 'STT');
    expect(sttEvents).toHaveLength(2);

    const sttAmounts = sttEvents.map((e) => e.charge_amount).sort();
    expect(sttAmounts).toEqual(['10.00', '30.00']);
  });

  it('returns empty array for empty trades', () => {
    expect(contractNoteToEvents([], makeCnCharges(), 'b', 'f')).toHaveLength(0);
  });

  it('preserves negative charge aggregates for downstream validation', () => {
    const events = contractNoteToEvents(
      [makeCnTrade()],
      makeCnCharges({
        stt: '-25.00',
        exchange_charges: '-5.00',
        clearing_charges: '-1.00',
        sebi_fees: '-0.25',
        stamp_duty: '-3.75',
      }),
      'batch-1',
      'file-cn-1',
    );

    const stt = events.find((e) => e.charge_type === 'STT');
    expect(stt).toBeDefined();
    expect(stt!.charge_amount).toBe('-25.00');

    const exch = events.find((e) => e.charge_type === 'EXCHANGE_CHARGE');
    expect(exch).toBeDefined();
    expect(exch!.charge_amount).toBe('-5.00');

    const sebi = events.find((e) => e.charge_type === 'SEBI_CHARGE');
    expect(sebi).toBeDefined();
    expect(sebi!.charge_amount).toBe('-0.25');

    const stamp = events.find((e) => e.charge_type === 'STAMP_DUTY');
    expect(stamp).toBeDefined();
    expect(stamp!.charge_amount).toBe('-3.75');
  });

  it('preserves negative GST consolidated totals', () => {
    const events = contractNoteToEvents(
      [makeCnTrade()],
      makeCnCharges({ cgst: '-0.90', sgst: '-0.90', igst: '0' }),
      'batch-1',
      'file-cn-1',
    );

    const gstEvents = events.filter((e) => e.event_type === EventType.GST_ON_CHARGES);
    expect(gstEvents).toHaveLength(1);
    expect(gstEvents[0].charge_amount).toBe('-1.80');
  });

  it('skips zero-amount charge events', () => {
    const events = contractNoteToEvents(
      [makeCnTrade({ brokerage_per_unit: '0' })],
      makeCnCharges({
        brokerage: '0', stt: '0', exchange_charges: '0', clearing_charges: '0',
        cgst: '0', sgst: '0', igst: '0', sebi_fees: '0', stamp_duty: '0',
      }),
      'batch-1',
      'file-cn-1',
    );

    // Only the trade event, no charge events
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.BUY_TRADE);
  });
});

// ---------------------------------------------------------------------------
// pairContractNoteData
// ---------------------------------------------------------------------------

describe('pairContractNoteData', () => {
  it('pairs trades with charges using tradesPerSheet', () => {
    const trades = [
      makeCnTrade({ trade_no: 'T1' }),
      makeCnTrade({ trade_no: 'T2' }),
      makeCnTrade({ trade_no: 'T3' }),
    ];
    const charges = [
      makeCnCharges({ trade_date: '15-01-2024' }),
      makeCnCharges({ trade_date: '16-01-2024' }),
    ];
    const sheets = pairContractNoteData(trades, charges, [2, 1]);

    expect(sheets).toHaveLength(2);
    expect(sheets[0].trades).toHaveLength(2);
    expect(sheets[0].trades[0].trade_no).toBe('T1');
    expect(sheets[0].trades[1].trade_no).toBe('T2');
    expect(sheets[1].trades).toHaveLength(1);
    expect(sheets[1].trades[0].trade_no).toBe('T3');
  });

  it('assigns all trades to single charge entry when no tradesPerSheet', () => {
    const trades = [makeCnTrade(), makeCnTrade()];
    const charges = [makeCnCharges()];
    const sheets = pairContractNoteData(trades, charges);

    expect(sheets).toHaveLength(1);
    expect(sheets[0].trades).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalEvents (integrated)
// ---------------------------------------------------------------------------

describe('buildCanonicalEvents', () => {
  it('handles tradebook-only (backward compatible)', () => {
    const events = buildCanonicalEvents({
      tradebookRows: [makeTradebookRow()],
      batchId: 'batch-1',
      fileIds: { tradebook: 'file-tb' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.BUY_TRADE);
  });

  it('handles contract notes only', () => {
    const sheets = [{ charges: makeCnCharges(), trades: [makeCnTrade()] }];
    const events = buildCanonicalEvents({
      contractNoteSheets: sheets,
      batchId: 'batch-1',
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
  });

  it('deduplicates tradebook events when contract notes cover same trades', () => {
    // Same trade from both sources — CN should win, tradebook event should be dropped
    const cnTrade = makeCnTrade({ trade_no: '2001' });
    const tbRow = makeTradebookRow({ trade_id: '2001' });

    const events = buildCanonicalEvents({
      tradebookRows: [tbRow],
      contractNoteSheets: [{ charges: makeCnCharges(), trades: [cnTrade] }],
      batchId: 'batch-1',
      fileIds: { tradebook: 'file-tb', contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    // Should have CN trade + CN charges, but NOT a duplicate tradebook trade
    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(1);
    expect(tradeEvents[0].contract_note_ref).toBe('CN-001'); // from CN, not tradebook
  });

  it('keeps tradebook events for dates not covered by contract notes', () => {
    // Tradebook has trades on Jan 15 and Jan 20; CN only covers Jan 15
    const tbRow15 = makeTradebookRow({ trade_id: '2001', trade_date: '2024-01-15' });
    const tbRow20 = makeTradebookRow({ trade_id: '3001', trade_date: '2024-01-20', symbol: 'TCS', isin: 'INE467B01029' });
    const cnTrade = makeCnTrade({ trade_no: '2001' });

    const events = buildCanonicalEvents({
      tradebookRows: [tbRow15, tbRow20],
      contractNoteSheets: [{ charges: makeCnCharges(), trades: [cnTrade] }],
      batchId: 'batch-1',
      fileIds: { tradebook: 'file-tb', contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    // CN trade (Jan 15) + tradebook trade (Jan 20) = 2
    expect(tradeEvents).toHaveLength(2);

    // security_symbol is set to TCS for tradebook events
    const jan20Trade = tradeEvents.find((e) => e.security_symbol === 'TCS');
    expect(jan20Trade).toBeDefined();
    expect(jan20Trade!.contract_note_ref).toBeNull(); // from tradebook
  });

  it('unifies tradebook and contract-note events for the same ISIN across exchanges', () => {
    const tbBuy = makeTradebookRow({
      exchange: 'BSE',
      symbol: 'ADSL',
      isin: 'INE674K01013',
      trade_type: 'buy',
      trade_id: 'TB-1',
    });
    const cnSell = makeCnTrade({
      trade_no: 'CN-1',
      buy_sell: 'S',
      exchange: 'NSE',
      security_description: 'ADSL - EQ / INE674K01013',
    });

    const events = buildCanonicalEvents({
      tradebookRows: [tbBuy],
      contractNoteSheets: [{ charges: makeCnCharges({ stamp_duty: '0' }), trades: [cnSell] }],
      contractNoteSymbolByDescription: new Map([
        ['ADSL - EQ / INE674K01013', 'ADSL'],
      ]),
      batchId: 'batch-1',
      fileIds: { tradebook: 'file-tb', contractNote: 'file-cn' },
    });

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );

    expect(tradeEvents).toHaveLength(2);
    // Both tradebook and CN events unify to the same ISIN-based security_id
    expect(tradeEvents[0].security_id).toBe('ISIN:INE674K01013');
    expect(tradeEvents[1].security_id).toBe('ISIN:INE674K01013');
  });

  // Regression: bug report item #11 / page 8 item 15. Same company listed on
  // both NSE and BSE with DIFFERENT ticker symbols was producing two stock
  // items in Tally because security_symbol carried the per-exchange ticker.
  // Fix: buildCanonicalEvents now derives a batch-wide ISIN→canonical-symbol
  // map from the FIRST trade seen for each ISIN, and every subsequent event
  // (any exchange, any source file) uses that canonical symbol.
  it('unifies security_symbol across NSE/BSE for the same ISIN even when tickers differ', () => {
    // NSE CN trade for HDFC, ISIN INE001A01036
    const nseCnSheet = {
      charges: makeCnCharges(),
      trades: [
        makeCnTrade({
          trade_no: 'NSE-1',
          buy_sell: 'B',
          exchange: 'NSE',
          security_description: 'HDFC/INE001A01036',
        }),
      ],
    };
    // BSE CN trade for the same company under a different exchange ticker
    const bseCnSheet = {
      charges: makeCnCharges({ trade_date: '16-01-2024', stamp_duty: '0' }),
      trades: [
        makeCnTrade({
          trade_no: 'BSE-1',
          buy_sell: 'S',
          exchange: 'BSE',
          security_description: 'HDFCBANK/INE001A01036',
        }),
      ],
    };

    const events = buildCanonicalEvents({
      contractNoteSheets: [nseCnSheet, bseCnSheet],
      batchId: 'batch-1',
      fileIds: { contractNote: 'file-cn' },
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    });

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(2);

    // Both trades MUST share the same security_id (ISIN-keyed) AND the same
    // security_symbol (the FIRST one seen — "HDFC" from the NSE sheet),
    // so the Tally export produces a single "HDFC-SH" stock item, not
    // separate "HDFC-SH" and "HDFCBANK-SH" items.
    for (const e of tradeEvents) {
      expect(e.security_id).toBe('ISIN:INE001A01036');
      expect(e.security_symbol).toBe('HDFC');
    }
  });

  it('strips the /ISIN suffix from XLSX-format CN descriptions when extracting symbol', () => {
    // Real Zerodha XLSX CN format observed in production:
    //   "GEMENVIRO-M/INE0RUJ01013"
    // Previously the symbol extractor returned the entire string unchanged
    // (no whitespace to split on), so the Tally stock item became
    // "GEMENVIRO-M/INE0RUJ01013-SH" — unusable.
    const events = contractNoteToEvents(
      [
        makeCnTrade({
          trade_no: 'T-1',
          security_description: 'GEMENVIRO-M/INE0RUJ01013',
          exchange: 'BSE',
        }),
      ],
      makeCnCharges(),
      'batch-1',
      'file-cn',
    );

    const tradeEvent = events.find(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvent).toBeDefined();
    expect(tradeEvent!.security_symbol).toBe('GEMENVIRO-M');
    expect(tradeEvent!.security_id).toBe('ISIN:INE0RUJ01013');
  });
});

// ---------------------------------------------------------------------------
// reclassifyIntradayTrades — bug report items #14, #13
// ---------------------------------------------------------------------------

describe('reclassifyIntradayTrades', () => {
  it('flips PROFILE_DRIVEN trades that fully net off same-day to SPECULATIVE_BUSINESS', () => {
    // Two CN trades: buy 25 + sell 25 of HDFC on the same day → fully intraday.
    // CN trades come in as PROFILE_DRIVEN (no product code in CNs).
    const events = buildCanonicalEvents({
      contractNoteSheets: [
        {
          charges: makeCnCharges({ trade_date: '20-04-2021' }),
          trades: [
            makeCnTrade({
              trade_no: 'BUY-1',
              buy_sell: 'B',
              quantity: '25',
              gross_rate: '2490',
              security_description: 'HDFC/INE001A01036',
            }),
            makeCnTrade({
              trade_no: 'SELL-1',
              buy_sell: 'S',
              quantity: '25',
              gross_rate: '2515',
              security_description: 'HDFC/INE001A01036',
            }),
          ],
        },
      ],
      batchId: 'b',
      fileIds: { contractNote: 'f' },
      classificationStrategy: TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
    });

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(2);
    for (const e of tradeEvents) {
      expect(e.trade_classification).toBe(TradeClassification.SPECULATIVE_BUSINESS);
    }
  });

  it('also flips charge events anchored to a same-day netoff group', () => {
    const events = buildCanonicalEvents({
      contractNoteSheets: [
        {
          charges: makeCnCharges({
            trade_date: '20-04-2021',
            stt: '10.00',
            brokerage: '5.00',
          }),
          trades: [
            makeCnTrade({
              trade_no: 'BUY-1',
              buy_sell: 'B',
              quantity: '25',
              security_description: 'HDFC/INE001A01036',
            }),
            makeCnTrade({
              trade_no: 'SELL-1',
              buy_sell: 'S',
              quantity: '25',
              security_description: 'HDFC/INE001A01036',
            }),
          ],
        },
      ],
      batchId: 'b',
      fileIds: { contractNote: 'f' },
      classificationStrategy: TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
    });

    const stt = events.find((e) => e.charge_type === 'STT');
    expect(stt).toBeDefined();
    expect(stt!.trade_classification).toBe(TradeClassification.SPECULATIVE_BUSINESS);
  });

  it('does NOT reclassify partial-netoff days (out of scope)', () => {
    // 30 buy + 25 sell same day → 25 intraday + 5 carry-forward delivery.
    // Partial splitting is deferred; the whole group is left untouched.
    const events = contractNoteToEvents(
      [
        makeCnTrade({
          trade_no: 'BUY-1',
          buy_sell: 'B',
          quantity: '30',
          security_description: 'HDFC/INE001A01036',
        }),
        makeCnTrade({
          trade_no: 'SELL-1',
          buy_sell: 'S',
          quantity: '25',
          security_description: 'HDFC/INE001A01036',
        }),
      ],
      makeCnCharges({ trade_date: '20-04-2021' }),
      'b',
      'f',
      undefined,
      undefined,
      TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
    );

    const tradeEvents = events.filter(
      (e) => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(2);
    // Both stay PROFILE_DRIVEN
    for (const e of tradeEvents) {
      expect(e.trade_classification).toBe(TradeClassification.PROFILE_DRIVEN);
    }
  });

  it('does NOT touch trades with explicit non-PROFILE_DRIVEN classification (e.g. CNC delivery that nets off same-day)', () => {
    // Build the events directly to bypass classifyTrade — simulate a tradebook
    // CNC same-day netoff which classifyTrade tags as INVESTMENT.
    const baseEvent = {
      event_id: 'a',
      import_batch_id: 'b',
      event_date: '2024-04-15',
      settlement_date: null,
      security_id: 'ISIN:INE001A01036',
      security_symbol: 'HDFC',
      rate: '2500',
      gross_amount: '25000',
      charge_type: null,
      charge_amount: '0',
      source_file_id: 'f',
      source_row_ids: ['r1'],
      contract_note_ref: null,
      external_ref: null,
      event_hash: 'h1',
    };
    const buy = {
      ...baseEvent,
      event_id: 'buy-1',
      event_type: EventType.BUY_TRADE,
      event_hash: 'h-buy',
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'CNC',
      quantity: '10',
    };
    const sell = {
      ...baseEvent,
      event_id: 'sell-1',
      event_type: EventType.SELL_TRADE,
      event_hash: 'h-sell',
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'CNC',
      quantity: '-10',
    };

    const result = reclassifyIntradayTrades([buy, sell]);
    expect(result[0].trade_classification).toBe(TradeClassification.INVESTMENT);
    expect(result[1].trade_classification).toBe(TradeClassification.INVESTMENT);
  });
});
