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
});
