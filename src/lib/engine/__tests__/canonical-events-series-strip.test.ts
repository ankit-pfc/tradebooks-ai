import { describe, expect, it } from 'vitest';
import {
  buildIsinSymbolMap,
  extractCleanSymbolFromCnDescription,
} from '../canonical-events';
import type {
  ZerodhaContractNoteTradeRow,
  ZerodhaContractNoteCharges,
  ZerodhaTradebookRow,
} from '../../parsers/zerodha/types';

// ---------------------------------------------------------------------------
// Series-code stripping in CN security descriptions
//
// Zerodha XLSX contract notes embed the NSE/BSE series code in the security
// description ("BOSCHLTD-EQ/INE…", "DBL-A/INE…", "SHAKTIPUMP-BE/INE…"). The
// series code is exchange metadata, not part of the ticker — the user's
// Tally ledger is named "BOSCHLTD-SH", not "BOSCHLTD-EQ-SH". Leaking the
// series suffix breaks reconciliation with the user's existing books.
//
// extractCleanSymbolFromCnDescription must strip a trailing "-<SERIES>"
// where SERIES is in the known NSE/BSE series list. Tokens that are NOT
// series codes (e.g. a hypothetical "FOO-BAR") must pass through unchanged.
// ---------------------------------------------------------------------------

describe('extractCleanSymbolFromCnDescription — series-code stripping', () => {
  it('strips -EQ series suffix (NSE cash equity)', () => {
    // BOSCHLTD-EQ is the NSE rolling-settlement series; the user's ledger
    // is "BOSCHLTD-SH". Returning "BOSCHLTD-EQ" produces "BOSCHLTD-EQ-SH"
    // which does not reconcile.
    expect(extractCleanSymbolFromCnDescription('BOSCHLTD-EQ/INE323A01026')).toBe('BOSCHLTD');
  });

  it('strips -M series suffix (BSE SME / minimum-lot)', () => {
    expect(extractCleanSymbolFromCnDescription('GEMENVIRO-M/INE0RUJ01013')).toBe('GEMENVIRO');
  });

  it('strips -BE series suffix (NSE book-entry / T-segment)', () => {
    expect(extractCleanSymbolFromCnDescription('SHAKTIPUMP-BE/INE908D01010')).toBe('SHAKTIPUMP');
  });

  it('strips single-letter -A series suffix (BSE group A)', () => {
    // Two scrips reported in the user's bug repro — both should collapse
    // to the bare ticker once the series is stripped.
    expect(extractCleanSymbolFromCnDescription('PEL-A/INE140A01024')).toBe('PEL');
  });

  it('strips -A series for DBL (user-reported regression case)', () => {
    expect(extractCleanSymbolFromCnDescription('DBL-A/INE917M01012')).toBe('DBL');
  });

  it('returns the symbol unchanged when no series suffix is present', () => {
    // The XLSX format may omit the series for some securities. The function
    // must not invent one or trim arbitrary trailing tokens.
    expect(extractCleanSymbolFromCnDescription('INFY/INE009A01021')).toBe('INFY');
  });

  it('preserves PDF/XML format behaviour: "RELIANCE - EQ / INE002A01018" → "RELIANCE"', () => {
    // The PDF format has spaces around the hyphen ("RELIANCE - EQ"), so the
    // series-strip regex (which requires "-EQ" with NO space) must NOT
    // fire — instead the existing whitespace split must take the first
    // token. This pins the existing PDF path against accidental regression.
    expect(extractCleanSymbolFromCnDescription('RELIANCE - EQ / INE002A01018')).toBe('RELIANCE');
  });

  it('leaves F&O symbols with no ISIN and no series suffix untouched', () => {
    // NIFTY24DECFUT has no hyphen, no slash, no ISIN. The function must
    // be a pure pass-through (after upper-casing).
    expect(extractCleanSymbolFromCnDescription('NIFTY24DECFUT')).toBe('NIFTY24DECFUT');
  });
});

// ---------------------------------------------------------------------------
// buildIsinSymbolMap — precedence: tradebook beats contract note
//
// When both sources cover the same ISIN, the tradebook row is authoritative
// because its `symbol` column is a clean ticker ("BOSCHLTD") with the series
// code held separately in `row.series`. The CN description embeds the series
// and even after stripping is a secondary source.
// ---------------------------------------------------------------------------

function makeCnTrade(
  overrides: Partial<ZerodhaContractNoteTradeRow> = {},
): ZerodhaContractNoteTradeRow {
  return {
    order_no: '1001',
    order_time: '10:00:00',
    trade_no: '2001',
    trade_time: '10:00:01',
    security_description: 'BOSCHLTD-EQ/INE323A01026',
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

function makeCnCharges(
  overrides: Partial<ZerodhaContractNoteCharges> = {},
): ZerodhaContractNoteCharges {
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

function makeTradebookRow(
  overrides: Partial<ZerodhaTradebookRow> = {},
): ZerodhaTradebookRow {
  return {
    trade_date: '2024-01-15',
    exchange: 'NSE',
    segment: 'EQ',
    symbol: 'BOSCHLTD',
    isin: 'INE323A01026',
    trade_type: 'buy',
    quantity: '10',
    price: '2500.00',
    trade_id: '2001',
    order_id: '1001',
    order_execution_time: '10:00:01',
    ...overrides,
  };
}

describe('buildIsinSymbolMap — precedence between tradebook and CN sources', () => {
  it('prefers the tradebook symbol when both sources cover the same ISIN', () => {
    // The CN description is "BOSCHLTD-EQ/INE323A01026" — even after series
    // stripping the CN path returns "BOSCHLTD". With a defensive precedence
    // (tradebook first), if the series-strip ever regressed we would still
    // pick up the clean tradebook value "BOSCHLTD" rather than the dirty
    // CN value "BOSCHLTD-EQ".
    const map = buildIsinSymbolMap({
      tradebookRows: [makeTradebookRow({ symbol: 'BOSCHLTD', isin: 'INE323A01026' })],
      contractNoteSheets: [
        {
          charges: makeCnCharges(),
          trades: [makeCnTrade({ security_description: 'BOSCHLTD-EQ/INE323A01026' })],
        },
      ],
    });

    expect(map.get('INE323A01026')).toBe('BOSCHLTD');
    // Belt-and-braces: the dirty form must never end up in the map.
    expect(map.get('INE323A01026')).not.toBe('BOSCHLTD-EQ');
  });

  it('falls back to the series-stripped CN symbol when no tradebook row covers the ISIN', () => {
    // CN-only path: no tradebook to defer to. The series-strip in
    // extractCleanSymbolFromCnDescription is the only defence and MUST
    // produce the bare ticker.
    const map = buildIsinSymbolMap({
      tradebookRows: [],
      contractNoteSheets: [
        {
          charges: makeCnCharges(),
          trades: [makeCnTrade({ security_description: 'BOSCHLTD-EQ/INE323A01026' })],
        },
      ],
    });

    expect(map.get('INE323A01026')).toBe('BOSCHLTD');
  });
});
