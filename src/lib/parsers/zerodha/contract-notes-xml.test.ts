import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseContractNotesXml } from './contract-notes-xml';

const XML_FILE = path.resolve(
  __dirname,
  '../../../..', // project root
  'Zerodha reports sss/FY 2324/Contract Notes.xml',
);
const HAS_LOCAL_DATA = fs.existsSync(XML_FILE);

describe('parseContractNotesXml', () => {
  it('throws on empty buffer', () => {
    expect(() =>
      parseContractNotesXml(Buffer.alloc(0), 'empty.xml'),
    ).toThrow();
  });

  it('throws on non-XML buffer', () => {
    expect(() =>
      parseContractNotesXml(Buffer.from('not xml at all'), 'bad.xml'),
    ).toThrow();
  });

  it('throws on XML missing <contract_note> root', () => {
    const xml = Buffer.from('<foo><bar/></foo>');
    expect(() =>
      parseContractNotesXml(xml, 'wrong.xml'),
    ).toThrow(/contract_note/);
  });
});

describe.skipIf(!HAS_LOCAL_DATA)('parseContractNotesXml (local FY2324 data)', () => {
  it('parses without throwing', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');
    expect(result).toBeDefined();
  });

  it('returns trades, charges, and tradesPerSheet of matching length', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    expect(result.charges.length).toBeGreaterThan(0);
    expect(result.tradesPerSheet.length).toBe(result.charges.length);

    const totalFromSheet = result.tradesPerSheet.reduce((a, b) => a + b, 0);
    expect(totalFromSheet).toBe(result.trades.length);
  });

  it('first contract note is CNT-23/24-54057482 on 2023-06-30', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    const first = result.charges[0];
    expect(first.contract_note_no).toBe('CNT-23/24-54057482');
    expect(first.trade_date).toBe('2023-06-30');
  });

  it('first trade has correct fields (sell of BOSCHLTD)', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    const trade = result.trades[0];
    expect(trade.trade_no).toBe('2332547');
    expect(trade.order_no).toBe('1000000012387431');
    expect(trade.buy_sell).toBe('S');
    expect(parseFloat(trade.quantity)).toBe(3);
    expect(parseFloat(trade.gross_rate)).toBe(19200.0);
    expect(parseFloat(trade.net_total)).toBe(57600.0);
    expect(trade.security_description).toContain('BOSCHLTD');
    expect(trade.exchange).toBe('NSE');
  });

  it('first contract charges map correctly', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    const charges = result.charges[0];
    expect(parseFloat(charges.brokerage)).toBeCloseTo(0.01, 5);
    expect(parseFloat(charges.stt)).toBeCloseTo(58.0, 5);
    expect(parseFloat(charges.sebi_fees)).toBeCloseTo(0.06, 5);
    expect(parseFloat(charges.exchange_charges)).toBeCloseTo(1.93, 5);
    expect(parseFloat(charges.igst)).toBeCloseTo(0.36, 5);
    // net amount in grandtotals
    expect(parseFloat(charges.net_amount)).not.toBe(0);
  });

  it('all quantities are positive (abs applied to sell negatives)', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    for (const trade of result.trades) {
      expect(parseFloat(trade.quantity)).toBeGreaterThan(0);
      expect(parseFloat(trade.net_total)).toBeGreaterThanOrEqual(0);
    }
  });

  it('buy_sell is always B or S', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    for (const trade of result.trades) {
      expect(['B', 'S']).toContain(trade.buy_sell);
    }
  });

  it('metadata row_count equals trades length', () => {
    const buf = fs.readFileSync(XML_FILE);
    const result = parseContractNotesXml(buf, 'Contract Notes.xml');

    expect(result.metadata.row_count).toBe(result.trades.length);
    expect(result.metadata.date_range).not.toBeNull();
    expect(result.metadata.date_range!.from).toBe('2023-06-30');
  });
});
