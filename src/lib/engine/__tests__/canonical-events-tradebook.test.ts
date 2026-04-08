import { describe, expect, it } from 'vitest';
import {
  tradebookRowToEvents,
  fundsStatementRowToEvents,
  dividendRowToEvents,
  corporateActionToEvents,
  buildCanonicalEvents,
  pairContractNoteData,
} from '../canonical-events';
import { EventType } from '../../types/events';
import { TradeClassification, TradeClassificationStrategy } from '../trade-classifier';
import { isPipelineValidationError } from '../../errors/pipeline-validation';
import {
  makeTradebookRow,
  makeFundsRow,
  makeDividendRow,
  makeCorporateAction,
  makeCnTrade,
  makeCnCharges,
} from '../../../tests/helpers/factories';

describe('tradebookRowToEvents', () => {
  it('converts buy row to BUY_TRADE', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ trade_type: 'buy', quantity: '10', price: '2500' }),
      'batch-1',
      'file-1',
    );
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.BUY_TRADE);
    expect(events[0].quantity).toBe('10'); // positive for buy
    expect(events[0].gross_amount).toBe('25000.00');
  });

  it('converts sell row to SELL_TRADE with negative quantity', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ trade_type: 'sell', quantity: '10', price: '2500' }),
      'batch-1',
      'file-1',
    );
    expect(events[0].event_type).toBe(EventType.SELL_TRADE);
    expect(events[0].quantity).toBe('-10');
  });

  it('normalises DD-MM-YYYY date format', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ trade_date: '15-06-2024' }),
      'batch-1',
      'file-1',
    );
    expect(events[0].event_date).toBe('2024-06-15');
  });

  it('normalises DD/MM/YYYY date format', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ trade_date: '15/06/2024' }),
      'batch-1',
      'file-1',
    );
    expect(events[0].event_date).toBe('2024-06-15');
  });

  it('passes through YYYY-MM-DD format', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ trade_date: '2024-06-15' }),
      'batch-1',
      'file-1',
    );
    expect(events[0].event_date).toBe('2024-06-15');
  });

  it('builds security_id as ISIN:xxx for equity segments when ISIN is available', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'nse', symbol: 'reliance', segment: 'EQ' }),
      'batch-1',
      'file-1',
    );
    // Equity with ISIN uses ISIN: prefix for cross-exchange unification
    expect(events[0].security_id).toBe('ISIN:INE002A01018');
  });

  it('uses EQ:SYMBOL for equity segments when ISIN is unavailable (NA)', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'bse', symbol: 'adsl', isin: 'NA' }),
      'batch-1',
      'file-1',
    );
    expect(events[0].security_id).toBe('EQ:ADSL');
  });

  it('preserves EXCHANGE:SYMBOL for non-equity segments when ISIN is unavailable', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'NSE', symbol: 'NIFTY24DECFUT', segment: 'FO', isin: 'NA' }),
      'batch-1',
      'file-1',
    );
    expect(events[0].security_id).toBe('NSE:NIFTY24DECFUT');
  });

  it('sets charge_amount to "0"', () => {
    const events = tradebookRowToEvents(makeTradebookRow(), 'batch-1', 'file-1');
    expect(events[0].charge_amount).toBe('0');
    expect(events[0].charge_type).toBeNull();
  });

  it('attaches parser trade classification to tradebook trade events', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ product: 'CNC', segment: 'EQ', exchange: 'NSE' }),
      'batch-1',
      'file-1',
    );

    expect(events[0].trade_classification).toBe(TradeClassification.INVESTMENT);
  });

  it('keeps same-day CNC sell on investment classification instead of speculative routing', () => {
    const buyEvents = tradebookRowToEvents(
      makeTradebookRow({
        trade_type: 'buy',
        trade_date: '2024-06-15',
        product: 'CNC',
        segment: 'EQ',
        exchange: 'NSE',
        order_id: 'CNC-BUY-1',
      }),
      'batch-1',
      'file-1',
    );
    const sellEvents = tradebookRowToEvents(
      makeTradebookRow({
        trade_type: 'sell',
        trade_date: '2024-06-15',
        product: 'CNC',
        segment: 'EQ',
        exchange: 'NSE',
        order_id: 'CNC-SELL-1',
        trade_id: 'T002',
      }),
      'batch-1',
      'file-1',
    );

    expect(buyEvents[0].trade_classification).toBe(TradeClassification.INVESTMENT);
    expect(sellEvents[0].trade_classification).toBe(TradeClassification.INVESTMENT);
  });

  it('propagates raw trade product for downstream voucher routing', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ product: 'mtf', segment: 'EQ', exchange: 'NSE' }),
      'batch-1',
      'file-1',
    );

    expect(events[0].trade_product).toBe('MTF');
  });

  it('propagates MCX commodity override classification from parser inputs', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({
        product: 'CNC',
        segment: 'COM',
        exchange: 'MCX',
        symbol: 'GOLDPETAL',
      }),
      'batch-1',
      'file-1',
    );

    expect(events[0].trade_classification).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    expect(events[0].trade_product).toBe('CNC');
  });

  it('generates deterministic event_hash', () => {
    const row = makeTradebookRow();
    const e1 = tradebookRowToEvents(row, 'batch-1', 'file-1');
    const e2 = tradebookRowToEvents(row, 'batch-2', 'file-2');
    expect(e1[0].event_hash).toBe(e2[0].event_hash);
  });
});

describe('fundsStatementRowToEvents', () => {
  it('classifies "dividend" keyword as DIVIDEND', () => {
    const events = fundsStatementRowToEvents(
      makeFundsRow({ description: 'Interim Dividend payment', credit: '1000', debit: '0' }),
      'b', 'f',
    );
    expect(events[0].event_type).toBe(EventType.DIVIDEND);
  });

  it('classifies credit > 0 as BANK_RECEIPT', () => {
    const events = fundsStatementRowToEvents(
      makeFundsRow({ description: 'Payout', credit: '50000', debit: '0' }),
      'b', 'f',
    );
    expect(events[0].event_type).toBe(EventType.BANK_RECEIPT);
  });

  it('classifies debit > 0 as BANK_PAYMENT', () => {
    const events = fundsStatementRowToEvents(
      makeFundsRow({ description: 'Pay-in', credit: '0', debit: '50000' }),
      'b', 'f',
    );
    expect(events[0].event_type).toBe(EventType.BANK_PAYMENT);
  });

  it('skips zero-value rows', () => {
    const events = fundsStatementRowToEvents(
      makeFundsRow({ debit: '0', credit: '0' }),
      'b', 'f',
    );
    expect(events).toHaveLength(0);
  });

  it('derives security_id from instrument for dividends', () => {
    const events = fundsStatementRowToEvents(
      makeFundsRow({
        description: 'Dividend credit',
        credit: '500',
        debit: '0',
        instrument: 'RELIANCE',
      }),
      'b', 'f',
    );
    expect(events[0].security_id).toBe('UNKNOWN:RELIANCE');
  });

  it('sets security_id to null for non-dividend', () => {
    const events = fundsStatementRowToEvents(
      makeFundsRow({ description: 'Payout', credit: '5000', debit: '0' }),
      'b', 'f',
    );
    expect(events[0].security_id).toBeNull();
  });
});

describe('dividendRowToEvents', () => {
  it('produces DIVIDEND with gross = qty * dps', () => {
    const events = dividendRowToEvents(
      makeDividendRow({ quantity: '100', dividend_per_share: '10.00', net_dividend_amount: '900.00' }),
      'b', 'f',
    );
    const div = events.find(e => e.event_type === EventType.DIVIDEND)!;
    expect(div.gross_amount).toBe('1000.00');
  });

  it('produces TDS_ON_DIVIDEND when gross > net', () => {
    const events = dividendRowToEvents(
      makeDividendRow({ quantity: '100', dividend_per_share: '10.00', net_dividend_amount: '900.00' }),
      'b', 'f',
    );
    const tds = events.find(e => e.event_type === EventType.TDS_ON_DIVIDEND)!;
    expect(tds.charge_amount).toBe('100.00');
  });

  it('omits TDS event when gross equals net', () => {
    const events = dividendRowToEvents(
      makeDividendRow({ quantity: '100', dividend_per_share: '10.00', net_dividend_amount: '1000.00' }),
      'b', 'f',
    );
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(EventType.DIVIDEND);
  });
});

describe('corporateActionToEvents', () => {
  it('converts BONUS to BONUS_SHARES', () => {
    const events = corporateActionToEvents(makeCorporateAction({ action_type: 'BONUS' }), 'b', 'f');
    expect(events[0].event_type).toBe(EventType.BONUS_SHARES);
    expect(events[0].gross_amount).toBe('0');
  });

  it('converts STOCK_SPLIT to STOCK_SPLIT event', () => {
    const events = corporateActionToEvents(makeCorporateAction({ action_type: 'STOCK_SPLIT' }), 'b', 'f');
    expect(events[0].event_type).toBe(EventType.STOCK_SPLIT);
  });

  it('converts RIGHTS_ISSUE with cost_per_share as rate', () => {
    const events = corporateActionToEvents(
      makeCorporateAction({ action_type: 'RIGHTS_ISSUE', cost_per_share: '500', ratio_numerator: '1', ratio_denominator: '2' }),
      'b', 'f',
    );
    expect(events[0].event_type).toBe(EventType.RIGHTS_ISSUE);
    expect(events[0].rate).toBe('500');
    // gross = cost_per_share * ratio = 500 * 0.5 = 250
    expect(events[0].gross_amount).toBe('250.00');
  });

  it('converts MERGER_DEMERGER with new_security_id in external_ref', () => {
    const events = corporateActionToEvents(
      makeCorporateAction({ action_type: 'MERGER_DEMERGER', new_security_id: 'NSE:NEWCO' }),
      'b', 'f',
    );
    expect(events[0].event_type).toBe(EventType.MERGER_DEMERGER);
    expect(events[0].external_ref).toBe('NSE:NEWCO');
  });
});

describe('pairContractNoteData', () => {
  it('pairs trades with charges using tradesPerSheet', () => {
    const trades = [makeCnTrade(), makeCnTrade(), makeCnTrade()];
    const charges = [makeCnCharges(), makeCnCharges()];
    const sheets = pairContractNoteData(trades, charges, [2, 1]);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].trades).toHaveLength(2);
    expect(sheets[1].trades).toHaveLength(1);
  });

  it('assigns all trades to single charge when no tradesPerSheet', () => {
    const trades = [makeCnTrade(), makeCnTrade()];
    const charges = [makeCnCharges()];
    const sheets = pairContractNoteData(trades, charges);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].trades).toHaveLength(2);
  });

  it('returns empty for empty charges', () => {
    expect(pairContractNoteData([makeCnTrade()], [])).toHaveLength(0);
  });
});

describe('buildCanonicalEvents', () => {
  it('returns empty for empty inputs', () => {
    const events = buildCanonicalEvents({ batchId: 'b', fileIds: {} });
    expect(events).toHaveLength(0);
  });

  it('processes tradebook rows', () => {
    const events = buildCanonicalEvents({
      tradebookRows: [makeTradebookRow()],
      batchId: 'b',
      fileIds: { tradebook: 'f1' },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].event_type).toBe(EventType.BUY_TRADE);
  });

  it('deduplicates CN trades vs tradebook by trade_id/trade_no', () => {
    const tradeId = 'T999';
    const events = buildCanonicalEvents({
      tradebookRows: [makeTradebookRow({ trade_id: tradeId })],
      contractNoteSheets: [{
        charges: makeCnCharges(),
        trades: [makeCnTrade({ trade_no: tradeId })],
      }],
      batchId: 'b',
      fileIds: { tradebook: 'f1', contractNote: 'f2' },
    });
    // Should only have CN-sourced trade, not tradebook duplicate
    const tradeEvents = events.filter(
      e => e.event_type === EventType.BUY_TRADE || e.event_type === EventType.SELL_TRADE,
    );
    expect(tradeEvents).toHaveLength(1);
    expect(tradeEvents[0].contract_note_ref).toBe('CN001');
  });

  it('skips funds-statement dividends when dedicated dividendRows present', () => {
    const events = buildCanonicalEvents({
      fundsRows: [
        makeFundsRow({ description: 'Dividend credit', credit: '500', debit: '0' }),
        makeFundsRow({ description: 'Payout settlement', credit: '10000', debit: '0' }),
      ],
      dividendRows: [makeDividendRow()],
      batchId: 'b',
      fileIds: { fundsStatement: 'f1', dividends: 'f2' },
    });
    // Funds-statement dividend should be skipped, but payout should remain
    const divEvents = events.filter(e => e.event_type === EventType.DIVIDEND);
    // Only from dedicated file, not from funds statement
    expect(divEvents).toHaveLength(1);
    expect(divEvents[0].source_file_id).toBe('f2');
  });

  it('includes corporate action events', () => {
    const events = buildCanonicalEvents({
      corporateActions: [makeCorporateAction({ action_type: 'BONUS' })],
      batchId: 'b',
      fileIds: { corporateActions: 'f1' },
    });
    expect(events.some(e => e.event_type === EventType.BONUS_SHARES)).toBe(true);
  });

  it('propagates contract-note trade classification to related charge events', () => {
    const events = buildCanonicalEvents({
      contractNoteSheets: [{
        charges: makeCnCharges({ brokerage: '10.00', stt: '5.00', cgst: '0.90', sgst: '0.90' }),
        trades: [makeCnTrade({ segment: 'NFO', exchange: 'NSE', buy_sell: 'B' })],
      }],
      batchId: 'b',
      fileIds: { contractNote: 'f2' },
    });

    const tradeEvent = events.find(e => e.event_type === EventType.BUY_TRADE);
    const chargeEvents = events.filter(e => e.event_type !== EventType.BUY_TRADE && e.event_type !== EventType.SELL_TRADE);

    expect(tradeEvent?.trade_classification).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    expect(chargeEvents.length).toBeGreaterThan(0);
    for (const chargeEvent of chargeEvents) {
      expect(chargeEvent.trade_classification).toBe(TradeClassification.NON_SPECULATIVE_BUSINESS);
    }
  });

  it('assigns deterministic event IDs when deterministicIds is enabled', () => {
    const opts = {
      tradebookRows: [makeTradebookRow({ trade_id: 'T100', order_id: 'O100' })],
      batchId: 'b',
      fileIds: { tradebook: 'f1' },
      deterministicIds: true,
      classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    };
    const first = buildCanonicalEvents(opts);
    const second = buildCanonicalEvents(opts);

    expect(first[0].event_id).toBe(second[0].event_id);
    expect(first[0].event_id.startsWith('evt_')).toBe(true);
  });

  it('throws typed validation error for ambiguous STRICT_PRODUCT trades', () => {
    try {
      buildCanonicalEvents({
        tradebookRows: [makeTradebookRow({ product: '', segment: 'EQ', exchange: 'NSE' })],
        batchId: 'b',
        fileIds: { tradebook: 'f1' },
        classificationStrategy: TradeClassificationStrategy.STRICT_PRODUCT,
      });
      throw new Error('Expected strict classification validation error');
    } catch (err) {
      expect(isPipelineValidationError(err)).toBe(true);
      if (isPipelineValidationError(err)) {
        expect(err.code).toBe('E_CLASSIFICATION_AMBIGUOUS');
      }
    }
  });
});

describe('cross-exchange equity normalisation', () => {
  it('assigns the same security_id to NSE and BSE trades for the same equity scrip via ISIN', () => {
    const buyOnNse = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'NSE', symbol: 'RELIANCE', segment: 'EQ', trade_type: 'buy' }),
      'b', 'f',
    );
    const sellOnBse = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'BSE', symbol: 'RELIANCE', segment: 'EQ', trade_type: 'sell' }),
      'b', 'f',
    );
    // Both should unify to ISIN:INE002A01018 regardless of exchange (default ISIN from factory)
    expect(buyOnNse[0].security_id).toBe('ISIN:INE002A01018');
    expect(sellOnBse[0].security_id).toBe('ISIN:INE002A01018');
  });

  it('equity without ISIN uses EQ: prefix for cross-exchange unification', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'BSE', symbol: 'INFY', segment: 'BE', isin: 'NA' }),
      'b', 'f',
    );
    expect(events[0].security_id).toBe('EQ:INFY');
  });

  it('normalises BSE Book Entry segment (BE) to ISIN when ISIN is available', () => {
    const events = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'BSE', symbol: 'INFY', segment: 'BE' }),
      'b', 'f',
    );
    // Default factory ISIN is INE002A01018
    expect(events[0].security_id).toBe('ISIN:INE002A01018');
  });

  it('does not normalise futures/options — exchange stays in the key', () => {
    const nse = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'NSE', symbol: 'NIFTY24DECFUT', segment: 'FO' }),
      'b', 'f',
    );
    const bse = tradebookRowToEvents(
      makeTradebookRow({ exchange: 'BSE', symbol: 'NIFTY24DECFUT', segment: 'FO' }),
      'b', 'f',
    );
    expect(nse[0].security_id).toBe('NSE:NIFTY24DECFUT');
    expect(bse[0].security_id).toBe('BSE:NIFTY24DECFUT');
    expect(nse[0].security_id).not.toBe(bse[0].security_id);
  });
});
