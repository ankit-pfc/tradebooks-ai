import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseLedger } from './ledger';

const DATA_DIR = path.resolve(
  process.env.HOME!,
  'Downloads/Zerodha reports sss/FY 2425',
);
const LEDGER_FILE = path.join(DATA_DIR, 'ledger-FC9134.xlsx');
const HAS_LOCAL_DATA = fs.existsSync(LEDGER_FILE);

describe('parseLedger', () => {
  it('throws on empty buffer', () => {
    expect(() => parseLedger(Buffer.alloc(0), 'empty.xlsx')).toThrow(/empty/);
  });
});

describe.skipIf(!HAS_LOCAL_DATA)('parseLedger (local data)', () => {
  it('parses the FY2425 ledger file', () => {
    const buf = fs.readFileSync(LEDGER_FILE);
    const result = parseLedger(buf, 'ledger-FC9134.xlsx');

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.metadata.row_count).toBeGreaterThan(0);
  });

  it('extracts opening balance', () => {
    const buf = fs.readFileSync(LEDGER_FILE);
    const result = parseLedger(buf, 'ledger-FC9134.xlsx');

    // Opening balance should be extracted
    expect(result.opening_balance).toBeTruthy();
  });

  it('parses ledger rows with correct fields', () => {
    const buf = fs.readFileSync(LEDGER_FILE);
    const result = parseLedger(buf, 'ledger-FC9134.xlsx');

    const first = result.rows[0];
    expect(first.particulars).toBeTruthy();
    expect(first.posting_date).toBeTruthy();
    expect(first.voucher_type).toBeTruthy();
  });

  it('has DP Charges entries', () => {
    const buf = fs.readFileSync(LEDGER_FILE);
    const result = parseLedger(buf, 'ledger-FC9134.xlsx');

    const dpEntries = result.rows.filter((r) =>
      r.particulars.toLowerCase().includes('dp charges'),
    );
    expect(dpEntries.length).toBeGreaterThan(0);
    expect(parseFloat(dpEntries[0].debit)).toBeGreaterThan(0);
  });

  it('has settlement entries', () => {
    const buf = fs.readFileSync(LEDGER_FILE);
    const result = parseLedger(buf, 'ledger-FC9134.xlsx');

    const settlements = result.rows.filter((r) =>
      r.particulars.toLowerCase().includes('net settlement'),
    );
    expect(settlements.length).toBeGreaterThan(0);
  });

  it('derives correct date range', () => {
    const buf = fs.readFileSync(LEDGER_FILE);
    const result = parseLedger(buf, 'ledger-FC9134.xlsx');

    expect(result.metadata.date_range).not.toBeNull();
    expect(result.metadata.date_range!.from).toMatch(/^2024/);
  });
});
