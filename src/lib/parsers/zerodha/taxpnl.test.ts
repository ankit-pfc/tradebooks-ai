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

  // -------------------------------------------------------------------------
  // Open Positions — real-shape coverage. The actual Zerodha export layout
  // these tests target is:
  //
  //   ... metadata rows (Client ID / Name / PAN) ...
  //   "Open Positions for Equity"
  //   <blank>
  //   Symbol | Trade Date | Exchange | Instrument Type | Open Quantity |
  //     Average Price | Previous Closing Price | Unrealized Profit
  //   <data rows...>
  //   <blank>
  //   "Open Positions for F&O"
  //   <blank>
  //   <column headers>
  //   <data rows...>  (may be empty)
  //   ... more sections ...
  //
  // The sheet name carries the as-of date ("Open Positions as of 2022-03-31").
  // -------------------------------------------------------------------------

  it('parses Open Positions from start-of-period sheet with equity section', () => {
    const buf = buildXlsxBuffer({
      'Open Positions as of 2022-04-01': [
        ['Client ID', 'FC9134'],
        [null],
        ['Open Positions for Equity'],
        [null],
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        ['INFY', '2021-08-18', 'NSE', 'EQ', 20, 1500, 1600, 2000],
        [null],
        ['Open Positions for F&O'],
        [null],
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
      ],
      'Open Positions as of 2023-03-31': [
        ['Open Positions for Equity'],
        [null],
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        ['INFY', '2021-08-18', 'NSE', 'EQ', 15, 1500, 1700, 3000],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.open_positions).toHaveLength(2);

    const startRow = result.open_positions.find((r) => r.is_start_of_period)!;
    expect(startRow.symbol).toBe('INFY');
    expect(startRow.quantity).toBe('20');
    expect(startRow.average_price).toBe('1500');
    // Derived buy_value = qty × average_price
    expect(startRow.buy_value).toBe('30000');
    expect(startRow.as_of_date).toBe('2022-04-01');
    expect(startRow.instrument_type).toBe('EQ');
    expect(startRow.trade_date).toBe('2021-08-18');

    const endRow = result.open_positions.find((r) => !r.is_start_of_period)!;
    expect(endRow.symbol).toBe('INFY');
    expect(endRow.quantity).toBe('15');
    expect(endRow.as_of_date).toBe('2023-03-31');
  });

  it('treats no-data Open Positions sheets (F&O/currency/commodity sections only) as empty', () => {
    // Mirrors the real FC9134 files: section headers exist but no data rows.
    const buf = buildXlsxBuffer({
      'Open Positions as of 2024-04-01': [
        ['Open Positions for F&O'],
        [null],
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        [null],
        ['Open Positions for Currency'],
        [null],
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        [null],
        ['Open Positions for Commodity'],
        [null],
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    // No data rows in any section => zero positions, not a crash.
    expect(result.open_positions).toHaveLength(0);
  });

  it('classifies the earlier-dated Open Positions sheet as start-of-period', () => {
    // Reverse the workbook order to prove sorting is by date, not sheet order.
    const buf = buildXlsxBuffer({
      'Open Positions as of 2023-03-31': [
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        ['INFY', '2021-08-18', 'NSE', 'EQ', 15, 1500, 1700, 3000],
      ],
      'Open Positions as of 2022-04-01': [
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        ['INFY', '2021-08-18', 'NSE', 'EQ', 20, 1500, 1600, 2000],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    const startRows = result.open_positions.filter((r) => r.is_start_of_period);
    const endRows = result.open_positions.filter((r) => !r.is_start_of_period);
    expect(startRows).toHaveLength(1);
    expect(startRows[0].as_of_date).toBe('2022-04-01');
    expect(endRows).toHaveLength(1);
    expect(endRows[0].as_of_date).toBe('2023-03-31');
  });

  it('exposes open_positions on the parseTaxPnl result alongside exits', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['INFY', 'INE009A01021', '2021-08-18', '2022-06-15', '5', '7500', '8000', '500', '301', '0', '500', '8000'],
      ],
      'Open Positions as of 2022-04-01': [
        ['Symbol', 'Trade Date', 'Exchange', 'Instrument Type', 'Open Quantity', 'Average Price', 'Previous Closing Price', 'Unrealized Profit'],
        ['INFY', '2021-08-18', 'NSE', 'EQ', 20, 1500, 1600, 2000],
      ],
    });
    const result = parseTaxPnl(buf, 'test.xlsx');
    expect(result.exits).toHaveLength(1);
    expect(result.open_positions).toHaveLength(1);
    expect(result.open_positions[0].symbol).toBe('INFY');
    // Row count rolls up exits + open positions so callers can sanity-check totals.
    expect(result.metadata.row_count).toBe(2);
  });
});
