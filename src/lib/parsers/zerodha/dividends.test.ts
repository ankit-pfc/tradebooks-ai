import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseDividends } from './dividends';
import Decimal from 'decimal.js';

const DATA_DIR = path.resolve(
  process.env.HOME!,
  'Downloads/Zerodha reports sss/FY 2425',
);
const DIV_FILE = path.join(DATA_DIR, 'dividends-FC9134-2024_2025.xlsx');
const HAS_LOCAL_DATA = fs.existsSync(DIV_FILE);

describe('parseDividends', () => {
  it('throws on empty buffer', () => {
    expect(() => parseDividends(Buffer.alloc(0), 'empty.xlsx')).toThrow(
      /empty/,
    );
  });
});

describe.skipIf(!HAS_LOCAL_DATA)('parseDividends (local data)', () => {
  it('parses the FY2425 dividends file', () => {
    const buf = fs.readFileSync(DIV_FILE);
    const result = parseDividends(buf, 'dividends.xlsx');

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.metadata.row_count).toBeGreaterThan(0);
  });

  it('extracts correct dividend data', () => {
    const buf = fs.readFileSync(DIV_FILE);
    const result = parseDividends(buf, 'dividends.xlsx');

    const iex = result.rows.find((r) => r.symbol === 'IEX');
    expect(iex).toBeDefined();
    expect(iex!.quantity).toBe('200');
    expect(iex!.dividend_per_share).toBe('1.5');
    expect(iex!.net_dividend_amount).toBe('300');
  });

  it('uses Ex-Date format', () => {
    const buf = fs.readFileSync(DIV_FILE);
    const result = parseDividends(buf, 'dividends.xlsx');

    // All rows should have an ex_date
    for (const row of result.rows) {
      expect(row.ex_date).toBeTruthy();
    }
  });

  it('total dividend amount is 9510', () => {
    const buf = fs.readFileSync(DIV_FILE);
    const result = parseDividends(buf, 'dividends.xlsx');

    const total = result.rows.reduce(
      (sum, r) => sum.add(new Decimal(r.net_dividend_amount)),
      new Decimal(0),
    );
    expect(total.toNumber()).toBe(9510);
  });

  it('skips total rows', () => {
    const buf = fs.readFileSync(DIV_FILE);
    const result = parseDividends(buf, 'dividends.xlsx');

    const totalRows = result.rows.filter((r) =>
      r.symbol.toLowerCase().includes('total'),
    );
    expect(totalRows.length).toBe(0);
  });
});
