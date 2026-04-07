import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { parseContractNotes, buildColumnMap } from './contract-notes';

const DATA_DIR = path.resolve(
  process.env.HOME!,
  'Downloads/Zerodha reports sss/FY 2425',
);
const CN_FILE = path.join(
  DATA_DIR,
  'Contract Notes_FC9134_2024-04-01_2025-03-31.xlsx',
);
const HAS_LOCAL_DATA = fs.existsSync(CN_FILE);

// ---------------------------------------------------------------------------
// Helpers to build minimal XLSX buffers for testing
// ---------------------------------------------------------------------------

function buildTestXlsx(sheets: Record<string, string[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** Standard Zerodha header row. */
const STANDARD_HEADER = [
  'Order No.', 'Order Time.', 'Trade No.', 'Trade Time.',
  'Security / Contract Description', 'Buy(B)/ Sell(S)',
  'Quantity', 'Exchange', 'Gross Rate per Unit (Rs)',
  'Brokerage per Unit (Rs)', 'Net Rate per Unit (Rs)',
  '', 'Net Total (Before Levies)',
];

/** A valid trade row. */
function tradeRow(overrides: Partial<Record<number, string>> = {}): string[] {
  const row = [
    '1234567890', '10:00:00', '9876543210', '10:00:01',
    'RELIANCE INDUSTRIES LTD', 'B',
    '10', 'NSE', '2500.00',
    '0.05', '2500.05',
    '', '25000.50',
  ];
  for (const [idx, val] of Object.entries(overrides)) {
    row[Number(idx)] = val;
  }
  return row;
}

/** Standard charges rows. */
const CHARGES_ROWS = [
  ['Pay in/Pay out', '', '', '', '', '', '', '', '', '', '25000.00'],
  ['Taxable Value of Supply', '', '', '', '', '', '', '', '', '', '10.00'],
  ['Securities Transaction Tax', '', '', '', '', '', '', '', '', '', '25.00'],
  ['Exchange Transaction Charges', '', '', '', '', '', '', '', '', '', '5.00'],
  ['Clearing charges', '', '', '', '', '', '', '', '', '', '1.00'],
  ['CGST', '', '', '', '', '', '', '', '', '', '0.90'],
  ['SGST', '', '', '', '', '', '', '', '', '', '0.90'],
  ['IGST', '', '', '', '', '', '', '', '', '', '0'],
  ['SEBI Turnover fees', '', '', '', '', '', '', '', '', '', '0.25'],
  ['Stamp Duty', '', '', '', '', '', '', '', '', '', '3.75'],
  ['Net amount receivable/(payable by client)', '', '', '', '', '', '', '', '', '', '24953.20'],
];

/** Build a standard single-sheet CN with metadata rows. */
function buildStandardSheet(trades: string[][], segment = 'Equity'): string[][] {
  return [
    // Rows 0-5: header info
    ['Zerodha Broking Limited'], [], [], [], [],
    ['Contract note no.', '', '', 'CN-001'],
    // Row 6: trade date
    ['Trade date', '', '', '15-01-2024', '', '', '', '', '', 'S-001'],
    // Rows 7-18: filler
    [], [], [], [], [], [], [], [], [], [], [], [],
    // Row 19: trade header
    STANDARD_HEADER,
    // Row 20: segment
    [segment],
    // Trades
    ...trades,
    // Empty row before charges
    [],
    // Charges
    ...CHARGES_ROWS,
  ];
}

// ---------------------------------------------------------------------------
// buildColumnMap
// ---------------------------------------------------------------------------

describe('buildColumnMap', () => {
  it('detects standard Zerodha header columns', () => {
    const cols = buildColumnMap(STANDARD_HEADER);
    expect(cols.order_no).toBe(0);
    expect(cols.buy_sell).toBe(5);
    expect(cols.quantity).toBe(6);
    expect(cols.exchange).toBe(7);
    expect(cols.net_total).toBe(12);
  });

  it('detects columns when headers use different casing/naming', () => {
    const altHeader = [
      'Order No', 'Order Time', 'Trade No', 'Trade Time',
      'Security', 'B/S', 'Qty', 'Exchange',
      'Gross Rate', 'Brokerage', 'Net Rate',
      '', 'Net Total',
    ];
    const cols = buildColumnMap(altHeader);
    expect(cols.order_no).toBe(0);
    expect(cols.buy_sell).toBe(5);
    expect(cols.quantity).toBe(6);
    expect(cols.net_total).toBe(12);
  });

  it('handles shifted columns (extra column inserted at start)', () => {
    const shifted = ['', ...STANDARD_HEADER];
    const cols = buildColumnMap(shifted);
    // All columns shift by 1
    expect(cols.order_no).toBe(1);
    expect(cols.buy_sell).toBe(6);
    expect(cols.quantity).toBe(7);
  });

  it('falls back to positional default 7 for exchange when header text drifts', () => {
    // "Exchg" / "Exch." don't match the "exchange" pattern — the parser must
    // still pick up the column from the documented default position so that
    // non-equity security IDs and MCX classification keep working.
    const driftedHeader = [
      'Order No.', 'Order Time.', 'Trade No.', 'Trade Time.',
      'Security / Contract Description', 'Buy(B)/ Sell(S)',
      'Quantity', 'Exchg', 'Gross Rate per Unit (Rs)',
      'Brokerage per Unit (Rs)', 'Net Rate per Unit (Rs)',
      '', 'Net Total (Before Levies)',
    ];
    const cols = buildColumnMap(driftedHeader);
    expect(cols.exchange).toBe(7);
  });
});

describe('parseContractNotes — exchange fallback', () => {
  it('still extracts exchange when header text does not match "Exchange"', () => {
    const driftedHeader = [
      'Order No.', 'Order Time.', 'Trade No.', 'Trade Time.',
      'Security / Contract Description', 'Buy(B)/ Sell(S)',
      'Quantity', 'Exchg', 'Gross Rate per Unit (Rs)',
      'Brokerage per Unit (Rs)', 'Net Rate per Unit (Rs)',
      '', 'Net Total (Before Levies)',
    ];
    const sheet = buildStandardSheet([tradeRow()]);
    const headerIdx = sheet.findIndex(
      (r) => (r[0] ?? '').toLowerCase().startsWith('order no'),
    );
    sheet[headerIdx] = driftedHeader;

    const buf = buildTestXlsx({ '15-01-2024': sheet });
    const result = parseContractNotes(buf, 'test.xlsx');

    expect(result.trades).toHaveLength(1);
    // Exchange must NOT be blank — fallback to positional default 7 keeps
    // non-equity security IDs and MCX routing intact.
    expect(result.trades[0].exchange).toBe('NSE');
  });
});

// ---------------------------------------------------------------------------
// parseContractNotes — unit tests with synthetic XLSX
// ---------------------------------------------------------------------------

describe('parseContractNotes', () => {
  it('throws on empty buffer', () => {
    expect(() =>
      parseContractNotes(Buffer.alloc(0), 'empty.xlsx'),
    ).toThrow(/empty/);
  });

  it('parses standard single-sheet CN with trades', () => {
    const sheet = buildStandardSheet([tradeRow(), tradeRow({ 0: '2222222222', 5: 'S' })]);
    const buf = buildTestXlsx({ '15-01-2024': sheet });
    const result = parseContractNotes(buf, 'test.xlsx');

    expect(result.trades).toHaveLength(2);
    expect(result.trades[0].buy_sell).toBe('B');
    expect(result.trades[1].buy_sell).toBe('S');
    expect(result.charges).toHaveLength(1);
    expect(result.diagnostics).toBeUndefined();
  });

  it('handles multi-segment sheet (Equity + F&O with empty row between)', () => {
    const sheet = buildStandardSheet([]);
    // Replace the simple trades with multi-segment data
    const headerIdx = sheet.findIndex((r) => (r[0] ?? '').toLowerCase().startsWith('order no'));
    const chargesIdx = sheet.findIndex((r) => (r[0] ?? '').toLowerCase().startsWith('pay in'));
    // Insert: Equity segment, 2 equity trades, empty row, F&O segment, 1 F&O trade
    const tradeSection = [
      ['Equity'],
      tradeRow(),
      tradeRow({ 0: '2222222222', 5: 'S' }),
      [], // empty row between segments
      ['F&O'],
      tradeRow({ 0: '3333333333', 4: 'NIFTY24DECFUT', 5: 'B' }),
    ];
    sheet.splice(headerIdx + 1, chargesIdx - headerIdx - 1, ...tradeSection, []);

    const buf = buildTestXlsx({ '15-01-2024': sheet });
    const result = parseContractNotes(buf, 'test.xlsx');

    expect(result.trades).toHaveLength(3);
    expect(result.trades[0].segment).toBe('Equity');
    expect(result.trades[1].segment).toBe('Equity');
    expect(result.trades[2].segment).toBe('F&O');
    expect(result.diagnostics).toBeUndefined();
  });

  it('produces diagnostics when header found but no trades extracted', () => {
    // Sheet with header and charges but no trade rows (only segment marker + empty rows)
    const sheet = buildStandardSheet([]);
    // Remove the segment marker too so there are truly no rows
    const headerIdx = sheet.findIndex((r) => (r[0] ?? '').toLowerCase().startsWith('order no'));
    const chargesIdx = sheet.findIndex((r) => (r[0] ?? '').toLowerCase().startsWith('pay in'));
    sheet.splice(headerIdx + 1, chargesIdx - headerIdx - 1, []);

    const buf = buildTestXlsx({ '15-01-2024': sheet });
    const result = parseContractNotes(buf, 'test.xlsx');

    expect(result.trades).toHaveLength(0);
    expect(result.charges).toHaveLength(1);
    expect(result.diagnostics).toBeDefined();
    expect(result.diagnostics![0]).toContain('no trade rows were extracted');
  });

  it('handles alternate header names gracefully', () => {
    // Use different column names that a modified CN might have
    const altHeader = [
      'Order No', 'Order Time', 'Trade No', 'Trade Time',
      'Security', 'B/S', 'Qty', 'Exchange',
      'Gross Rate', 'Brokerage', 'Net Rate',
      '', 'Net Total',
    ];
    const sheet = buildStandardSheet([tradeRow()]);
    // Replace the header row
    const headerIdx = sheet.findIndex((r) => (r[0] ?? '').toLowerCase().startsWith('order no'));
    sheet[headerIdx] = altHeader;

    const buf = buildTestXlsx({ '15-01-2024': sheet });
    const result = parseContractNotes(buf, 'test.xlsx');

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].buy_sell).toBe('B');
    expect(result.trades[0].quantity).toBe('10');
    expect(result.trades[0].exchange).toBe('NSE');
  });
});

describe.skipIf(!HAS_LOCAL_DATA)('parseContractNotes (local data)', () => {
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
});
