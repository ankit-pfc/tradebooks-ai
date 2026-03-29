import { describe, expect, it } from 'vitest';
import { parseFundsStatement, PARSER_VERSION } from './funds-statement';
import { buildCsvBuffer, buildCsvBufferWithBom, buildXlsxBuffer } from '../../../tests/helpers/factories';

const CSV_HEADERS = ['Posting Date', 'Segment', 'Description', 'Debit', 'Credit', 'Running Balance'];

describe('parseFundsStatement — CSV', () => {
  it('parses well-formed CSV', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Settlement payout', '0', '50000.00', '50000.00'],
      ['2024-06-16', 'EQ', 'Pay-in', '25000.00', '0', '25000.00'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].posting_date).toBe('2024-06-15');
    expect(result.rows[0].credit).toBe('50000.00');
    expect(result.rows[1].debit).toBe('25000.00');
  });

  it('strips BOM', () => {
    const buf = buildCsvBufferWithBom([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Payout', '0', '5000', '5000'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows).toHaveLength(1);
  });

  it('filters summary/total rows', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Payout', '0', '5000', '5000'],
      ['', '', 'Total', '0', '5000', '5000'],
      ['', '', 'Opening Balance', '0', '0', '0'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows).toHaveLength(1);
  });

  it('handles Indian comma-formatted numbers', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Large payout', '0', '"1,23,456.78"', '"1,23,456.78"'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows[0].credit).toBe('123456.78');
  });

  it('treats "-" and empty as "0"', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Entry', '-', '5000', '5000'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows[0].debit).toBe('0');
  });

  it('throws for empty buffer', () => {
    expect(() => parseFundsStatement(Buffer.alloc(0), 'empty.csv')).toThrow(/empty/i);
  });

  it('throws when missing required headers', () => {
    const buf = buildCsvBuffer([
      ['Date', 'Amount'],
      ['2024-06-15', '5000'],
    ]);
    expect(() => parseFundsStatement(buf, 'bad.csv')).toThrow(/header/i);
  });

  it('handles optional instrument column', () => {
    const buf = buildCsvBuffer([
      [...CSV_HEADERS, 'Instrument'],
      ['2024-06-15', 'EQ', 'Dividend', '0', '1000', '51000', 'RELIANCE'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows[0].instrument).toBe('RELIANCE');
  });

  it('sets instrument to null when column absent', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Payout', '0', '5000', '5000'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.rows[0].instrument).toBeNull();
  });
});

describe('parseFundsStatement — XLSX', () => {
  it('parses XLSX via auto-detect from magic bytes', () => {
    const buf = buildXlsxBuffer({
      Sheet1: [
        CSV_HEADERS,
        ['2024-06-15', 'EQ', 'Settlement', '0', '50000', '50000'],
      ],
    });
    // The buffer has XLSX magic bytes (PK header), so it should auto-detect
    const result = parseFundsStatement(buf, 'report.xlsx');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].credit).toBe('50000');
  });

  it('finds header row when there are metadata rows before it', () => {
    const buf = buildXlsxBuffer({
      Sheet1: [
        ['Client ID', 'FC9134'],
        ['Client Name', 'Test User'],
        [],
        CSV_HEADERS,
        ['2024-06-15', 'EQ', 'Payout', '0', '10000', '10000'],
      ],
    });
    const result = parseFundsStatement(buf, 'report.xlsx');
    expect(result.rows).toHaveLength(1);
  });
});

describe('parseFundsStatement — metadata', () => {
  it('derives date range from posting_date', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-04-01', 'EQ', 'Entry A', '0', '1000', '1000'],
      ['2024-12-31', 'EQ', 'Entry B', '500', '0', '500'],
    ]);
    const result = parseFundsStatement(buf, 'funds.csv');
    expect(result.metadata.date_range).toEqual({ from: '2024-04-01', to: '2024-12-31' });
  });

  it('sets parser_version', () => {
    const buf = buildCsvBuffer([
      CSV_HEADERS,
      ['2024-06-15', 'EQ', 'Entry', '0', '1000', '1000'],
    ]);
    expect(parseFundsStatement(buf, 'f.csv').metadata.parser_version).toBe(PARSER_VERSION);
  });
});
