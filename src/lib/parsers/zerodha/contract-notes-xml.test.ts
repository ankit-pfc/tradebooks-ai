import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseContractNotesXml } from './contract-notes-xml';
import { isPipelineValidationError } from '../../errors/pipeline-validation';

const XML_FILE = path.resolve(
  __dirname,
  '../../../..', // project root
  'Zerodha reports sss/FY 2324/Contract Notes.xml',
);
const HAS_LOCAL_DATA = fs.existsSync(XML_FILE);

interface MinimalXmlOpts {
  segmentId?: string;
  type?: string;
  quantity?: string;
}

/** Minimal valid XML contract note with one sell trade. */
function makeMinimalXml(
  instrumentId: string,
  { segmentId = 'NSE-EQ', type = 'S', quantity = '-3' }: MinimalXmlOpts = {},
): Buffer {
  return Buffer.from(
    `<contract_note version="0.1">
  <contracts>
    <contract>
      <id>CNT-TEST-001</id>
      <timestamp>2024-01-15</timestamp>
      <trades>
        <trade segment_id="${segmentId}" instrument_id="${instrumentId}">
          <id>TR001</id>
          <order_id>ORD001</order_id>
          <timestamp>10:00:00</timestamp>
          <type>${type}</type>
          <quantity>${quantity}</quantity>
          <average_price>19200.00</average_price>
          <value>-57600.00</value>
        </trade>
      </trades>
      <grandtotals>
        <grandtotal><name>Brokerage</name><value>0.01</value></grandtotal>
        <grandtotal><name>Securities Transaction Tax</name><value>58.00</value></grandtotal>
        <grandtotal><name>Exchange Transaction Charges</name><value>1.93</value></grandtotal>
        <grandtotal><name>Integrated GST</name><value>0.36</value></grandtotal>
      </grandtotals>
    </contract>
  </contracts>
</contract_note>`,
  );
}

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

  it('strips exchange prefix from instrument_id in security_description', () => {
    // instrument_id "NSE:BOSCHLTD - EQ / INE323A01026" must yield
    // security_description "BOSCHLTD - EQ / INE323A01026" (no "NSE:" prefix).
    // If the prefix is kept, buildSecurityIdFromDescription produces
    // "NSE:NSE:BOSCHLTD" which breaks FIFO cost lot lookups.
    const result = parseContractNotesXml(
      makeMinimalXml('NSE:BOSCHLTD - EQ / INE323A01026'),
      'test.xml',
    );

    const trade = result.trades[0];
    expect(trade.security_description).toBe('BOSCHLTD - EQ / INE323A01026');
    expect(trade.security_description).not.toMatch(/^NSE:/i);
    expect(trade.exchange).toBe('NSE');
  });

  it('handles instrument_id without exchange prefix unchanged', () => {
    // If the source does not include "exchange:" prefix, the description
    // should pass through as-is.
    const result = parseContractNotesXml(
      makeMinimalXml('BOSCHLTD - EQ / INE323A01026'),
      'test.xml',
    );
    expect(result.trades[0].security_description).toBe('BOSCHLTD - EQ / INE323A01026');
  });

  it('throws typed validation error when type and quantity sign are both unavailable', () => {
    try {
      parseContractNotesXml(
        makeMinimalXml('NSE:BOSCHLTD - EQ / INE323A01026', { type: '', quantity: '' }),
        'test.xml',
      );
      throw new Error('Expected invalid trade type validation error');
    } catch (err) {
      expect(isPipelineValidationError(err)).toBe(true);
      if (isPipelineValidationError(err)) {
        expect(err.code).toBe('E_INVALID_TRADE_TYPE');
      }
    }
  });

  it('infers sell when type is missing and quantity is negative', () => {
    const result = parseContractNotesXml(
      makeMinimalXml('NSE:BOSCHLTD - EQ / INE323A01026', { type: '', quantity: '-3' }),
      'test.xml',
    );

    expect(result.trades[0].buy_sell).toBe('S');
    expect(result.trades[0].quantity).toBe('3');
  });

  it('infers buy when type is missing and quantity is positive', () => {
    const result = parseContractNotesXml(
      makeMinimalXml('NSE:BOSCHLTD - EQ / INE323A01026', { type: '', quantity: '3' }),
      'test.xml',
    );

    expect(result.trades[0].buy_sell).toBe('B');
    expect(result.trades[0].quantity).toBe('3');
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
