import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseContractNotes } from './contract-notes';

const DATA_DIR = path.resolve(
  process.env.HOME!,
  'Downloads/Zerodha reports sss/FY 2425',
);
const CN_FILE = path.join(
  DATA_DIR,
  'Contract Notes_FC9134_2024-04-01_2025-03-31.xlsx',
);

describe('parseContractNotes', () => {
  it('parses the FY2425 contract notes file', () => {
    const buf = fs.readFileSync(CN_FILE);
    const result = parseContractNotes(buf, 'contract-notes.xlsx');

    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.charges.length).toBeGreaterThan(0);
    expect(result.metadata.row_count).toBeGreaterThan(0);
  });

  it('extracts trade rows with correct fields', () => {
    const buf = fs.readFileSync(CN_FILE);
    const result = parseContractNotes(buf, 'contract-notes.xlsx');

    const first = result.trades[0];
    expect(first.order_no).toBeTruthy();
    expect(first.trade_no).toBeTruthy();
    expect(first.security_description).toBeTruthy();
    expect(['B', 'S']).toContain(first.buy_sell);
    expect(parseFloat(first.quantity)).toBeGreaterThan(0);
    expect(first.exchange).toBeTruthy();
  });

  it('extracts charges with contract note numbers', () => {
    const buf = fs.readFileSync(CN_FILE);
    const result = parseContractNotes(buf, 'contract-notes.xlsx');

    const first = result.charges[0];
    expect(first.contract_note_no).toBeTruthy();
    expect(first.trade_date).toBeTruthy();
  });

  it('extracts STT and SEBI fees', () => {
    const buf = fs.readFileSync(CN_FILE);
    const result = parseContractNotes(buf, 'contract-notes.xlsx');

    // At least some charges should have non-zero STT
    const withStt = result.charges.filter(
      (c) => parseFloat(c.stt) !== 0,
    );
    expect(withStt.length).toBeGreaterThan(0);
  });

  it('has 28 sheets (contract notes)', () => {
    const buf = fs.readFileSync(CN_FILE);
    const result = parseContractNotes(buf, 'contract-notes.xlsx');

    // 28 trading days in FY2425 for this client
    expect(result.charges.length).toBe(28);
  });

  it('throws on empty buffer', () => {
    expect(() =>
      parseContractNotes(Buffer.alloc(0), 'empty.xlsx'),
    ).toThrow(/empty/);
  });
});
