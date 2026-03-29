import { describe, expect, it } from 'vitest';
import { parseTaxPnl, PARSER_VERSION } from './taxpnl';
import { buildXlsxBuffer } from '../../../tests/helpers/factories';

describe('parseTaxPnl', () => {
  it('parses exits sheet', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-15', '2024-06-15', '10', '25000', '26000', '1000', '152', '0', '1000', '26000'],
        ['TCS', 'INE467B01029', '2024-02-01', '2024-07-01', '5', '17000', '18000', '1000', '151', '0', '1000', '18000'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits).toHaveLength(2);
    expect(result.exits[0].symbol).toBe('RELIANCE');
    expect(result.exits[0].quantity).toBe('10');
    expect(result.exits[0].buy_value).toBe('25000');
    expect(result.exits[1].symbol).toBe('TCS');
  });

  it('parses charges sheet', () => {
    const buf = buildXlsxBuffer({
      'Other Debits and Credits': [
        ['Particulars', 'Posting Date', 'Debit', 'Credit'],
        ['DP Charges', '2024-06-15', '15.93', '0'],
        ['Account Opening', '2024-04-01', '200', '0'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.charges).toHaveLength(2);
    expect(result.charges[0].particulars).toBe('DP Charges');
    expect(result.charges[0].debit).toBe('15.93');
  });

  it('parses dividends sheet', () => {
    const buf = buildXlsxBuffer({
      Dividend: [
        ['Symbol', 'ISIN', 'Date', 'Quantity', 'Dividend Per Share', 'Net Dividend Amount'],
        ['RELIANCE', 'INE002A01018', '2024-08-15', '100', '10', '900'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.dividends).toHaveLength(1);
    expect(result.dividends[0].symbol).toBe('RELIANCE');
    expect(result.dividends[0].quantity).toBe('100');
  });

  it('parses equity summary sheet', () => {
    const buf = buildXlsxBuffer({
      Equity: [
        ['Symbol', 'Quantity', 'Buy Value', 'Sell Value', 'Realized P&L'],
        ['RELIANCE', '50', '125000', '130000', '5000'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.equity_summary).toHaveLength(1);
    expect(result.equity_summary[0].symbol).toBe('RELIANCE');
    expect(result.equity_summary[0].realized_pnl).toBe('5000');
  });

  it('normalises DD/MM/YYYY dates', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '15/01/2024', '15/06/2024', '10', '25000', '26000', '1000', '152', '0', '1000', '26000'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits[0].entry_date).toBe('2024-01-15');
    expect(result.exits[0].exit_date).toBe('2024-06-15');
  });

  it('treats "-" as "0" in numeric fields', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-15', '2024-06-15', '10', '25000', '26000', '1000', '152', '-', '1000', '26000'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits[0].fair_market_value).toBe('0');
  });

  it('strips commas from numeric values', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-15', '2024-06-15', '10', '1,25,000', '1,26,000', '1,000', '152', '0', '1,000', '1,26,000'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits[0].buy_value).toBe('125000');
  });

  it('skips sub-section header rows (no ISIN + no quantity)', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-15', '2024-06-15', '10', '25000', '26000', '1000', '152', '0', '1000', '26000'],
        ['Mutual Funds', '', '', '', '', '', '', '', '', '', '', ''],
        ['TCS', 'INE467B01029', '2024-02-01', '2024-07-01', '5', '17000', '18000', '1000', '151', '0', '1000', '18000'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits).toHaveLength(2);
    expect(result.exits[0].symbol).toBe('RELIANCE');
    expect(result.exits[1].symbol).toBe('TCS');
  });

  it('throws for empty buffer', () => {
    expect(() => parseTaxPnl(Buffer.alloc(0), 'empty.xlsx')).toThrow(/empty/i);
  });

  it('returns empty arrays when no matching sheets found', () => {
    const buf = buildXlsxBuffer({ 'Random Sheet': [['A', 'B'], ['1', '2']] });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits).toHaveLength(0);
    expect(result.charges).toHaveLength(0);
    expect(result.dividends).toHaveLength(0);
    expect(result.equity_summary).toHaveLength(0);
  });

  it('derives date range from exits and charges', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-15', '2024-06-15', '10', '25000', '26000', '1000', '152', '0', '1000', '26000'],
      ],
      'Other Debits and Credits': [
        ['Particulars', 'Posting Date', 'Debit', 'Credit'],
        ['DP Charges', '2024-12-31', '15.93', '0'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.metadata.date_range).toEqual({ from: '2024-01-15', to: '2024-12-31' });
  });

  it('sets parser_version in metadata', () => {
    const buf = buildXlsxBuffer({ 'Random Sheet': [['A'], ['1']] });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.metadata.parser_version).toBe(PARSER_VERSION);
  });
});
