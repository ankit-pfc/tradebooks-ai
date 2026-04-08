import { describe, expect, it } from 'vitest';
import { detectFileType } from './detect';
import { buildXlsxBuffer, buildCsvBuffer } from '../../../tests/helpers/factories';

describe('detectFileType — filename patterns', () => {
  it('detects tradebook', () => {
    expect(detectFileType(Buffer.alloc(0), 'tradebook-FC9134.csv')).toBe('tradebook');
  });

  it('detects funds_statement', () => {
    expect(detectFileType(Buffer.alloc(0), 'funds-statement.xlsx')).toBe('funds_statement');
    expect(detectFileType(Buffer.alloc(0), 'funds_statement.csv')).toBe('funds_statement');
  });

  it('detects holdings', () => {
    expect(detectFileType(Buffer.alloc(0), 'holdings-FC9134.xlsx')).toBe('holdings');
  });

  it('detects contract_note', () => {
    expect(detectFileType(Buffer.alloc(0), 'contract-note-2024.xlsx')).toBe('contract_note');
    expect(detectFileType(Buffer.alloc(0), 'contract_note.pdf')).toBe('contract_note');
  });

  it('detects taxpnl', () => {
    expect(detectFileType(Buffer.alloc(0), 'tax-pnl-2024.xlsx')).toBe('taxpnl');
    expect(detectFileType(Buffer.alloc(0), 'tax_pnl.xlsx')).toBe('taxpnl');
    expect(detectFileType(Buffer.alloc(0), 'taxpnl.xlsx')).toBe('taxpnl');
  });

  it('detects agts', () => {
    expect(detectFileType(Buffer.alloc(0), 'AGTS-report.xlsx')).toBe('agts');
  });

  it('detects ledger', () => {
    expect(detectFileType(Buffer.alloc(0), 'ledger-FC9134.xlsx')).toBe('ledger');
  });

  it('detects dividends', () => {
    expect(detectFileType(Buffer.alloc(0), 'dividend-report-2024.xlsx')).toBe('dividends');
  });

  it('returns unknown for unrecognised filename', () => {
    expect(detectFileType(Buffer.alloc(0), 'report.xlsx')).toBe('unknown');
  });

  it('is case insensitive', () => {
    expect(detectFileType(Buffer.alloc(0), 'TRADEBOOK.CSV')).toBe('tradebook');
  });
});

describe('detectFileType — content fingerprints', () => {
  it('detects taxpnl from XLSX headers', () => {
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-01', '2024-06-15', '10', '25000', '26000', '1000', '166', '0', '1000', '26000'],
      ],
    });
    expect(detectFileType(buf, 'report.xlsx')).toBe('taxpnl');
  });

  it('detects funds_statement from XLSX headers', () => {
    const buf = buildXlsxBuffer({
      Sheet1: [
        ['Posting Date', 'Segment', 'Description', 'Debit', 'Credit', 'Running Balance'],
        ['2024-06-15', 'EQ', 'Settlement', '0', '50000', '50000'],
      ],
    });
    expect(detectFileType(buf, 'report.xlsx')).toBe('funds_statement');
  });

  it('detects tradebook from CSV headers', () => {
    const buf = buildCsvBuffer([
      ['Trade Date', 'Exchange', 'Segment', 'Symbol', 'ISIN', 'Trade Type', 'Quantity', 'Price', 'Trade ID', 'Order ID', 'Order Execution Time'],
      ['2024-06-15', 'NSE', 'EQ', 'RELIANCE', 'INE002A01018', 'buy', '10', '2500', 'T001', 'O001', '10:30:00'],
    ]);
    expect(detectFileType(buf, 'data.csv')).toBe('tradebook');
  });

  it('returns unknown gracefully on corrupted buffer', () => {
    const corrupted = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff]);
    expect(detectFileType(corrupted, 'report.xlsx')).toBe('unknown');
  });

  // -------------------------------------------------------------------------
  // Regression: FY 21-22 contract notes
  // -------------------------------------------------------------------------
  // The older Zerodha CN export uses
  //   1. The filename pattern <ClientID>_<Start>_<End>.xlsx (no
  //      "contract_note" substring), AND
  //   2. Trade-table column headers with trailing periods and qualifiers
  //      ("Trade No.", "Order No.", "Brokerage per Unit (Rs)").
  // The previous detector silently returned 'unknown' because its
  // fingerprint required exact-string matches for ['trade no', 'order no',
  // 'brokerage'].
  // -------------------------------------------------------------------------
  it('detects FY 21-22 contract note via title row even when filename is opaque', () => {
    const buf = buildXlsxBuffer({
      '05-04-2021': [
        ['CONTRACT NOTE CUM TAX INVOICE (Tax Invoice under Section 31 of GST Act)'],
        ['Zerodha Broking Limited'],
        ['CONTRACT NOTE NO:', '', '', 'CNT-21/22-1337294'],
        ['Trade Date:', '', '', '05-04-2021'],
        // Header row at the same position seen in real exports
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [
          'Order No.',
          'Order Time.',
          'Trade No.',
          'Trade Time',
          'Security/Contract Description',
          'Buy(B) / Sell(S)',
          'Quantity',
          'Gross Rate / Trade Price Per Unit (Rs)',
          'Brokerage per Unit (Rs)',
          'Net Rate per Unit (Rs)',
        ],
      ],
    });
    expect(detectFileType(buf, 'FC9134_2021-04-01_2022-03-31.xlsx')).toBe('contract_note');
  });

  it('detects contract note via column header prefixes when title row is absent', () => {
    // Drop the title row so only the trade-table header remains.
    const buf = buildXlsxBuffer({
      Sheet1: [
        [
          'Order No.',
          'Order Time.',
          'Trade No.',
          'Trade Time',
          'Security/Contract Description',
          'Buy(B) / Sell(S)',
          'Quantity',
          'Brokerage per Unit (Rs)',
          'Net Rate per Unit (Rs)',
        ],
      ],
    });
    expect(detectFileType(buf, 'opaque.xlsx')).toBe('contract_note');
  });

  // -------------------------------------------------------------------------
  // Generic P&L statement (not Tax P&L)
  // -------------------------------------------------------------------------
  it('detects generic pnl statement from filename', () => {
    expect(detectFileType(Buffer.alloc(0), 'pnl-FC9134.xlsx')).toBe('pnl');
    expect(detectFileType(Buffer.alloc(0), 'pnl_FC9134.xlsx')).toBe('pnl');
  });

  it('detects generic pnl statement from sheet name + title row', () => {
    const buf = buildXlsxBuffer({
      Equity: [
        ['Client ID', 'FC9134'],
        ['P&L Statement for Equity from 2021-04-01 to 2022-03-31'],
        ['Summary'],
        ['Charges', 13559.94],
        ['Realized P&L', 212575.4],
      ],
      'Other Debits and Credits': [['Particulars', 'Amount']],
    });
    expect(detectFileType(buf, 'report.xlsx')).toBe('pnl');
  });

  it('does not misclassify Tax P&L as generic pnl', () => {
    // Tax P&L has both "taxable profit" and a "p&l statement" title — make
    // sure the more-specific taxpnl fingerprint wins.
    const buf = buildXlsxBuffer({
      'Tradewise Exits': [
        ['P&L Statement for Equity from 2021-04-01 to 2022-03-31'],
        ['Symbol', 'ISIN', 'Entry Date', 'Exit Date', 'Quantity', 'Buy Value', 'Sell Value', 'Profit', 'Period of Holding', 'Fair Market Value', 'Taxable Profit', 'Turnover'],
        ['RELIANCE', 'INE002A01018', '2024-01-01', '2024-06-15', '10', '25000', '26000', '1000', '166', '0', '1000', '26000'],
      ],
    });
    expect(detectFileType(buf, 'report.xlsx')).toBe('taxpnl');
  });

  it('taxpnl filename does not get caught by pnl pattern', () => {
    expect(detectFileType(Buffer.alloc(0), 'taxpnl-FC9134.xlsx')).toBe('taxpnl');
  });
});
