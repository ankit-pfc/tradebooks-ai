import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseHoldings } from './holdings';

const DATA_DIR = path.resolve(
  process.env.HOME!,
  'Downloads/Zerodha reports sss/FY 2425',
);
const HOLDINGS_FILE = path.join(DATA_DIR, 'holdings-FC9134.xlsx');
const HAS_LOCAL_DATA = fs.existsSync(HOLDINGS_FILE);

describe('parseHoldings', () => {
  it('throws on empty buffer', () => {
    expect(() => parseHoldings(Buffer.alloc(0), 'empty.xlsx')).toThrow(/empty/);
  });
});

describe.skipIf(!HAS_LOCAL_DATA)('parseHoldings (local data)', () => {
  it('parses the FY2425 holdings file', () => {
    const buf = fs.readFileSync(HOLDINGS_FILE);
    const result = parseHoldings(buf, 'holdings-FC9134.xlsx');

    expect(result.equity.length).toBeGreaterThan(0);
    expect(result.metadata.row_count).toBeGreaterThan(0);
  });

  it('extracts correct fields from equity rows', () => {
    const buf = fs.readFileSync(HOLDINGS_FILE);
    const result = parseHoldings(buf, 'holdings-FC9134.xlsx');

    const first = result.equity[0];
    expect(first.symbol).toBeTruthy();
    expect(first.isin).toBeTruthy();
    expect(first.quantity_available).toBeTruthy();
    expect(first.average_price).toBeTruthy();
  });

  it('extracts statement date', () => {
    const buf = fs.readFileSync(HOLDINGS_FILE);
    const result = parseHoldings(buf, 'holdings-FC9134.xlsx');

    expect(result.metadata.date_range).not.toBeNull();
    expect(result.metadata.date_range!.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has GEMENVIRO-MT as a holding', () => {
    const buf = fs.readFileSync(HOLDINGS_FILE);
    const result = parseHoldings(buf, 'holdings-FC9134.xlsx');

    const gem = result.equity.find((r) => r.symbol.includes('GEMENVIRO'));
    expect(gem).toBeDefined();
    expect(gem!.quantity_available).toBe('6400');
    expect(gem!.isin).toBe('INE0RUJ01013');
  });
});
