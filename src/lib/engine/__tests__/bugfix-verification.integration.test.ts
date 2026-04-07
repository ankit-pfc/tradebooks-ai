/**
 * bugfix-verification.integration.test.ts
 *
 * End-to-end integration tests that verify 4 bug fixes by running the full
 * pipeline: CSV/XML parsing → canonical events → vouchers → Tally XML.
 *
 * Each scenario targets a specific bug fix with realistic Zerodha export data
 * and validates the final XML output (not intermediate state).
 *
 * Bug A: Stock recording in Journal vouchers (OBJVIEW, ISINVOICE, INVENTORYALLOCATIONS)
 * Bug B: Intraday trades skip inventory (MIS → no INVENTORYALLOCATIONS)
 * Bug C: Speculative gain/loss uses single unified ledger
 * Bug D: ISIN-based cross-exchange unification (BSE buy + NSE sell share FIFO)
 */

import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { parseTradebook } from '../../parsers/zerodha/tradebook';
import { parseContractNotesXml } from '../../parsers/zerodha/contract-notes-xml';
import { buildCanonicalEvents, pairContractNoteData } from '../canonical-events';
import { CostLotTracker } from '../cost-lots';
import { buildVouchers } from '../voucher-builder';
import { mergeSameRatePurchaseVouchers } from '../voucher-merger';
import { collectRequiredLedgers } from '../../export/ledger-masters';
import { generateFullExport } from '../../export/tally-xml';
import { INVESTOR_DEFAULT, getDefaultTallyProfile } from '../accounting-policy';
import { AccountingMode } from '../../types/accounting';
import type { StockItemMasterInput } from '../../export/tally-xml';
import { buildCsvBufferWithBom } from '../../../tests/helpers/factories';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Derive stock item masters from voucher lines (same logic the app uses). */
function collectStockItems(vouchers: { lines: { stock_item_name: string | null }[] }[]): StockItemMasterInput[] {
  const names = new Set<string>();
  for (const v of vouchers) {
    for (const l of v.lines) {
      if (l.stock_item_name) names.add(l.stock_item_name);
    }
  }
  return Array.from(names).sort().map(name => ({ name, baseUnit: 'SH' }));
}

const CSV_HEADER = [
  'Trade Date', 'Exchange', 'Segment', 'Symbol/Scrip', 'ISIN',
  'Trade Type', 'Quantity', 'Price', 'Product', 'Trade ID',
  'Order ID', 'Order Execution Time',
];

function buildTradebookCsv(dataRows: string[][]): Buffer {
  return buildCsvBufferWithBom([CSV_HEADER, ...dataRows]);
}

function runFullPipeline(csvBuffer: Buffer, opts?: { filename?: string }) {
  const batchId = 'test-batch-bugfix';
  const fileId = 'test-file-bugfix';
  const filename = opts?.filename ?? 'tradebook.csv';

  // 1. Parse tradebook CSV
  const { rows } = parseTradebook(csvBuffer, filename);

  // 2. Build canonical events
  const events = buildCanonicalEvents({
    tradebookRows: rows,
    batchId,
    fileIds: { tradebook: fileId },
  });

  // 3. Build vouchers (investor mode with TallyProfile)
  const profile = INVESTOR_DEFAULT;
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const tracker = new CostLotTracker();
  const rawVouchers = buildVouchers(events, profile, tracker, tallyProfile);

  // 4. Merge same-rate partial fills
  const vouchers = mergeSameRatePurchaseVouchers(rawVouchers);

  // 5. Collect ledger masters, stock items, and generate XML
  const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });
  const stockItems = collectStockItems(vouchers);
  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    'TEST COMPANY',
    tallyProfile.customGroups,
    stockItems,
  );

  return { events, rawVouchers, vouchers, ledgers, mastersXml, transactionsXml };
}

function runCnPipeline(xmlBuffer: Buffer) {
  const batchId = 'test-batch-cn';
  const fileId = 'test-file-cn';

  const parsed = parseContractNotesXml(xmlBuffer, 'contract-note.xml');
  const sheets = pairContractNoteData(parsed.trades, parsed.charges, parsed.tradesPerSheet);

  const events = buildCanonicalEvents({
    contractNoteSheets: sheets,
    batchId,
    fileIds: { contractNote: fileId },
  });

  const profile = INVESTOR_DEFAULT;
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const tracker = new CostLotTracker();
  const rawVouchers = buildVouchers(events, profile, tracker, tallyProfile);
  const vouchers = mergeSameRatePurchaseVouchers(rawVouchers);
  const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });
  const stockItems = collectStockItems(vouchers);
  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers, ledgers, 'TEST COMPANY', tallyProfile.customGroups, stockItems,
  );

  return { events, vouchers, ledgers, mastersXml, transactionsXml };
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

function parseXml(xml: string) {
  return xmlParser.parse(xml);
}

/** Extract all VOUCHER elements from parsed transactions XML. */
function getVouchers(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const body = parsed?.ENVELOPE as Record<string, unknown>;
  const bodyNode = body?.BODY as Record<string, unknown>;
  const messages =
    (bodyNode?.DATA as Record<string, unknown>)?.TALLYMESSAGE ??
    ((bodyNode?.IMPORTDATA as Record<string, unknown>)?.REQUESTDATA as Record<string, unknown>)?.TALLYMESSAGE;
  if (!messages) return [];
  const arr = Array.isArray(messages) ? messages : [messages];
  return arr
    .filter((m: Record<string, unknown>) => m.VOUCHER)
    .map((m: Record<string, unknown>) => m.VOUCHER as Record<string, unknown>);
}

/** Extract all LEDGER elements from parsed masters XML. */
function getLedgers(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const body = parsed?.ENVELOPE as Record<string, unknown>;
  const importData = body?.BODY as Record<string, unknown>;
  const reqData = (importData?.IMPORTDATA as Record<string, unknown>)?.REQUESTDATA as Record<string, unknown>;
  const messages = reqData?.TALLYMESSAGE;
  if (!messages) return [];
  const arr = Array.isArray(messages) ? messages : [messages];
  return arr
    .filter((m: Record<string, unknown>) => m.LEDGER)
    .map((m: Record<string, unknown>) => m.LEDGER as Record<string, unknown>);
}

/** Extract all STOCKITEM elements from parsed masters XML. */
function getStockItems(parsed: Record<string, unknown>): Record<string, unknown>[] {
  const body = parsed?.ENVELOPE as Record<string, unknown>;
  const importData = body?.BODY as Record<string, unknown>;
  const reqData = (importData?.IMPORTDATA as Record<string, unknown>)?.REQUESTDATA as Record<string, unknown>;
  const messages = reqData?.TALLYMESSAGE;
  if (!messages) return [];
  const arr = Array.isArray(messages) ? messages : [messages];
  return arr
    .filter((m: Record<string, unknown>) => m.STOCKITEM)
    .map((m: Record<string, unknown>) => m.STOCKITEM as Record<string, unknown>);
}

/** Get all voucher ledger entries (always as array). */
function getVoucherLines(voucher: Record<string, unknown>): Record<string, unknown>[] {
  const lines =
    (voucher as Record<string, unknown>)['LEDGERENTRIES.LIST'] ??
    (voucher as Record<string, unknown>)['ALLLEDGERENTRIES.LIST'];
  if (!lines) return [];
  return Array.isArray(lines) ? lines : [lines];
}

/** Get INVENTORYALLOCATIONS.LIST from a ledger entry (always as array). */
function getInventoryAllocations(entry: Record<string, unknown>): Record<string, unknown>[] {
  const alloc = entry['INVENTORYALLOCATIONS.LIST'];
  if (!alloc) return [];
  return Array.isArray(alloc) ? alloc : [alloc];
}

// ===========================================================================
// Scenario 1: Stock Recording in Journal Vouchers (Bug A)
// ===========================================================================

describe('Scenario 1: Stock recording in Journal vouchers', () => {
  const csv = buildTradebookCsv([
    // HDFC buy 30 shares @ 2489.93 CNC delivery
    ['15-06-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy', '30', '2489.93', 'CNC', 'T1001', 'O1001', '10:30:00'],
    // HDFC sell 30 shares @ 2415.45 CNC delivery — 45 days later (STCG)
    ['30-07-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '30', '2415.45', 'CNC', 'T1002', 'O1002', '14:15:00'],
    // Trailing empty-ish row (realistic quirk)
    ['', '', '', '', '', '', '', '', '', '', '', ''],
  ]);

  const result = runFullPipeline(csv);

  it('buy voucher is Journal type (investor mode)', () => {
    const buyVoucher = result.vouchers.find(v => v.narrative?.includes('Purchase'));
    expect(buyVoucher).toBeDefined();
    expect(buyVoucher!.voucher_type).toBe('JOURNAL');
  });

  it('buy voucher uses Accounting Voucher View (Journal type)', () => {
    // Journal vouchers must stay on Accounting Voucher View even when they
    // carry INVENTORYALLOCATIONS.LIST entries — Invoice Voucher View is
    // reserved for Sales/Purchase types and causes Tally to reject imports
    // with "did not match the Import settings".
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const buyV = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    );
    expect(buyV).toBeDefined();
    expect((buyV as Record<string, unknown>)['@_OBJVIEW']).toBe('Accounting Voucher View');
  });

  it('buy voucher has no ISINVOICE element (Journal voucher)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const buyV = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    );
    expect(buyV).toBeDefined();
    expect((buyV as Record<string, unknown>).ISINVOICE).toBeUndefined();
  });

  it('buy voucher DR line has INVENTORYALLOCATIONS.LIST with HDFC-SH', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const buyV = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    )!;
    const lines = getVoucherLines(buyV);
    const drLineWithInventory = lines.find(l => {
      const allocs = getInventoryAllocations(l);
      return allocs.length > 0;
    });
    expect(drLineWithInventory).toBeDefined();
    const allocs = getInventoryAllocations(drLineWithInventory!);
    expect(allocs[0].STOCKITEMNAME).toBe('HDFC-SH');
  });

  it('buy voucher inventory has correct quantity (30 SH, positive = stock IN)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const buyV = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    )!;
    const lines = getVoucherLines(buyV);
    const drLineWithInventory = lines.find(l => getInventoryAllocations(l).length > 0)!;
    const allocs = getInventoryAllocations(drLineWithInventory);
    const actualQty = String(allocs[0].ACTUALQTY);
    // DR = stock IN → positive qty, should contain "30" and "SH"
    expect(actualQty).toContain('30');
    expect(actualQty).toContain('SH');
    // Should NOT be negative (no leading minus)
    expect(actualQty.trim().startsWith('-')).toBe(false);
  });

  it('sell voucher has INVENTORYALLOCATIONS.LIST with negative qty (stock OUT)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const sellV = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Sale'),
    )!;
    expect(sellV).toBeDefined();
    const lines = getVoucherLines(sellV);
    const lineWithInventory = lines.find(l => getInventoryAllocations(l).length > 0)!;
    expect(lineWithInventory).toBeDefined();
    const allocs = getInventoryAllocations(lineWithInventory);
    const actualQty = String(allocs[0].ACTUALQTY);
    // CR = stock OUT → negative qty
    expect(actualQty).toContain('30');
    expect(actualQty.trim().startsWith('-')).toBe(true);
  });

  it('sell voucher gain/loss uses STCG ledger (holding < 365 days)', () => {
    const sellVoucher = result.vouchers.find(v => v.narrative?.includes('Sale'))!;
    const gainLossLine = sellVoucher.lines.find(l =>
      l.ledger_name.includes('STCG') || l.ledger_name.includes('STCL'),
    );
    expect(gainLossLine).toBeDefined();
  });

  it('mastersXml has HDFC-SH stock item', () => {
    const parsed = parseXml(result.mastersXml);
    const stockItems = getStockItems(parsed);
    const hdfcItem = stockItems.find(s =>
      String(((s as Record<string, unknown>)['@_NAME'] ?? (s as Record<string, unknown>).NAME)).includes('HDFC-SH'),
    );
    expect(hdfcItem).toBeDefined();
  });

  it('mastersXml investment ledger has AFFECTSSTOCK=Yes', () => {
    const parsed = parseXml(result.mastersXml);
    const ledgers = getLedgers(parsed);
    // TallyProfile uses "{symbol}-SH" as ledger name
    const investmentLedger = ledgers.find(l =>
      String((l as Record<string, unknown>)['@_NAME']).includes('HDFC-SH'),
    );
    expect(investmentLedger).toBeDefined();
    expect((investmentLedger as Record<string, unknown>).AFFECTSSTOCK).toBe('Yes');
  });
});

// ===========================================================================
// Scenario 2: Cross-Exchange ISIN Unification (Bug D)
// ===========================================================================

describe('Scenario 2: Cross-exchange ISIN unification', () => {
  const csv = buildTradebookCsv([
    // ADSL buy 100 on BSE, ISIN INE102I01027
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy', '100', '68.50', 'CNC', 'T2001', 'O2001', '09:30:00'],
    // ADSL buy 50 on BSE, same ISIN, different date
    ['27-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy', '50', '71.35', 'CNC', 'T2002', 'O2002', '10:15:00'],
    // ADSL sell 100 on NSE — sells from BSE lots (cross-exchange)
    ['05-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '100', '77.50', 'CNC', 'T2003', 'O2003', '11:00:00'],
    // ADSL sell 50 on NSE
    ['11-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '50', '86.00', 'CNC', 'T2004', 'O2004', '14:30:00'],
  ]);

  const result = runFullPipeline(csv);

  it('all events share the same ISIN-based security_id', () => {
    const tradeEvents = result.events.filter(e =>
      e.event_type === 'BUY_TRADE' || e.event_type === 'SELL_TRADE',
    );
    expect(tradeEvents.length).toBe(4);
    for (const e of tradeEvents) {
      expect(e.security_id).toBe('ISIN:INE102I01027');
    }
  });

  it('all events have security_symbol = ADSL', () => {
    const tradeEvents = result.events.filter(e =>
      e.event_type === 'BUY_TRADE' || e.event_type === 'SELL_TRADE',
    );
    for (const e of tradeEvents) {
      expect(e.security_symbol).toBe('ADSL');
    }
  });

  it('stock item in XML is ADSL-SH (not ISIN-based)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    for (const v of vouchers) {
      const lines = getVoucherLines(v);
      for (const l of lines) {
        const allocs = getInventoryAllocations(l);
        for (const a of allocs) {
          expect(a.STOCKITEMNAME).toBe('ADSL-SH');
        }
      }
    }
  });

  it('sell vouchers consume BSE buy lots (FIFO cost basis)', () => {
    // First sell of 100: should consume 100 from first BSE lot @ 68.50
    const sellVouchers = result.vouchers.filter(v => v.narrative?.includes('Sale'));
    expect(sellVouchers.length).toBe(2);

    // Sell vouchers should have cost basis from BSE buys, not fail with "exceeds open lots"
    for (const sv of sellVouchers) {
      // Voucher must be balanced
      expect(sv.total_debit).toBe(sv.total_credit);
      // Must have a CR line for the investment account (cost basis)
      const costLine = sv.lines.find(l => l.dr_cr === 'CR' && l.quantity !== null);
      expect(costLine).toBeDefined();
    }
  });

  it('mastersXml uses ADSL-SH (not INE102I01027-SH)', () => {
    const parsed = parseXml(result.mastersXml);
    const stockItems = getStockItems(parsed);
    const adslItem = stockItems.find(s =>
      String(((s as Record<string, unknown>)['@_NAME'] ?? (s as Record<string, unknown>).NAME)) === 'ADSL-SH',
    );
    expect(adslItem).toBeDefined();

    // Should NOT have an ISIN-based stock item
    const isinItem = stockItems.find(s =>
      String(((s as Record<string, unknown>)['@_NAME'] ?? (s as Record<string, unknown>).NAME)).includes('INE102I01027'),
    );
    expect(isinItem).toBeUndefined();
  });

  it('investment ledger uses ADSL symbol (not ISIN)', () => {
    const adslLedger = result.ledgers.find(l => l.name.includes('ADSL'));
    expect(adslLedger).toBeDefined();
    expect(adslLedger!.affects_stock).toBe(true);

    const isinLedger = result.ledgers.find(l => l.name.includes('INE102I01027'));
    expect(isinLedger).toBeUndefined();
  });
});

// ===========================================================================
// Scenario 3: Intraday Trades Skip Inventory (Bug B)
// ===========================================================================

describe('Scenario 3: Intraday trades skip inventory', () => {
  const csv = buildTradebookCsv([
    // IRCTC intraday buy — MIS product
    ['20-04-2021', 'NSE', 'EQ', 'IRCTC', 'INE335Y01020', 'buy', '25', '2490.00', 'MIS', 'T3001', 'O3001', '09:30:00'],
    // IRCTC intraday sell — same day, MIS (loss)
    ['20-04-2021', 'NSE', 'EQ', 'IRCTC', 'INE335Y01020', 'sell', '25', '2475.00', 'MIS', 'T3002', 'O3002', '14:00:00'],
    // RELIANCE delivery buy — CNC product (control)
    ['20-04-2021', 'NSE', 'EQ', 'RELIANCE', 'INE002A01018', 'buy', '10', '2800.00', 'CNC', 'T3003', 'O3003', '10:30:00'],
  ]);

  const result = runFullPipeline(csv);

  it('IRCTC sell voucher has OBJVIEW="Accounting Voucher View" (no inventory)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const irctcSell = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('IRCTC') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Sale'),
    );
    expect(irctcSell).toBeDefined();
    expect((irctcSell as Record<string, unknown>)['@_OBJVIEW']).toBe('Accounting Voucher View');
  });

  it('IRCTC sell voucher has NO ISINVOICE element (or not Yes)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const irctcSell = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('IRCTC') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Sale'),
    )!;
    const isInvoice = (irctcSell as Record<string, unknown>).ISINVOICE;
    // Should either be absent or not "Yes"
    expect(isInvoice).not.toBe('Yes');
  });

  it('IRCTC sell voucher has NO INVENTORYALLOCATIONS.LIST on any line', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const irctcSell = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('IRCTC') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Sale'),
    )!;
    const lines = getVoucherLines(irctcSell);
    for (const l of lines) {
      const allocs = getInventoryAllocations(l);
      expect(allocs).toHaveLength(0);
    }
  });

  it('IRCTC buy voucher also has NO INVENTORYALLOCATIONS.LIST', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const irctcBuy = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('IRCTC') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    )!;
    expect(irctcBuy).toBeDefined();
    const lines = getVoucherLines(irctcBuy);
    for (const l of lines) {
      const allocs = getInventoryAllocations(l);
      expect(allocs).toHaveLength(0);
    }
  });

  it('IRCTC sell gain/loss uses speculation ledger', () => {
    const irctcSell = result.vouchers.find(v =>
      v.narrative?.includes('IRCTC') && v.narrative?.includes('Sale'),
    )!;
    // Should have a line routing to speculation gain or loss
    const specLine = irctcSell.lines.find(l =>
      l.ledger_name.toLowerCase().includes('intraday') ||
      l.ledger_name.toLowerCase().includes('speculat'),
    );
    expect(specLine).toBeDefined();
  });

  it('RELIANCE delivery buy HAS INVENTORYALLOCATIONS.LIST (control)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const relianceBuy = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('RELIANCE') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    )!;
    expect(relianceBuy).toBeDefined();
    expect((relianceBuy as Record<string, unknown>)['@_OBJVIEW']).toBe('Accounting Voucher View');

    const lines = getVoucherLines(relianceBuy);
    const lineWithInventory = lines.find(l => getInventoryAllocations(l).length > 0);
    expect(lineWithInventory).toBeDefined();
    const allocs = getInventoryAllocations(lineWithInventory!);
    expect(allocs[0].STOCKITEMNAME).toBe('RELIANCE-SH');
  });
});

// ===========================================================================
// Scenario 4: Speculative Gain/Loss Single Ledger (Bug C)
// ===========================================================================

describe('Scenario 4: Speculative gain/loss single ledger', () => {
  const csv = buildTradebookCsv([
    // HDFC intraday GAIN: buy 25 @ 2490, sell 25 @ 2515 same day (MIS)
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy', '25', '2490.00', 'MIS', 'T4001', 'O4001', '09:30:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '25', '2515.00', 'MIS', 'T4002', 'O4002', '14:00:00'],
    // HDFC intraday LOSS: buy 5 @ 2490, sell 5 @ 2420 same day (MIS)
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy', '5', '2490.00', 'MIS', 'T4003', 'O4003', '10:00:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '5', '2420.00', 'MIS', 'T4004', 'O4004', '15:00:00'],
  ]);

  const result = runFullPipeline(csv);

  it('gain voucher uses speculation ledger (CR line)', () => {
    const sellVouchers = result.vouchers.filter(v => v.narrative?.includes('Sale'));
    // Find the gain voucher (sell @ 2515 > buy @ 2490)
    const gainV = sellVouchers.find(v => {
      return v.lines.some(l =>
        l.dr_cr === 'CR' && (
          l.ledger_name.toLowerCase().includes('intraday') ||
          l.ledger_name.toLowerCase().includes('speculat')
        ),
      );
    });
    expect(gainV).toBeDefined();
  });

  it('loss voucher uses speculation ledger (DR line)', () => {
    const sellVouchers = result.vouchers.filter(v => v.narrative?.includes('Sale'));
    // Find the loss voucher (sell @ 2420 < buy @ 2490)
    const lossV = sellVouchers.find(v => {
      return v.lines.some(l =>
        l.dr_cr === 'DR' && (
          l.ledger_name.toLowerCase().includes('intraday') ||
          l.ledger_name.toLowerCase().includes('speculat')
        ),
      );
    });
    expect(lossV).toBeDefined();
  });

  it('mastersXml has speculation ledger(s) under Speculative Business Income group', () => {
    const parsed = parseXml(result.mastersXml);
    const ledgers = getLedgers(parsed);
    const specLedgers = ledgers.filter(l => {
      const name = String((l as Record<string, unknown>)['@_NAME'] ?? '').toLowerCase();
      return name.includes('intraday') || name.includes('speculat');
    });
    expect(specLedgers.length).toBeGreaterThan(0);

    // All speculation ledgers should be under "Speculative Business Income" group
    for (const sl of specLedgers) {
      const parent = String((sl as Record<string, unknown>).PARENT ?? '');
      expect(parent).toBe('Speculative Business Income');
    }
  });
});

// ===========================================================================
// Scenario 5: Contract Note XML with ISIN Extraction (Bug A — CN path)
// ===========================================================================

describe('Scenario 5: Contract Note XML with ISIN extraction', () => {
  const CN_XML = Buffer.from(`<contract_note version="0.1">
  <contracts>
    <contract>
      <id>CNT-2122-001</id>
      <timestamp>2021-10-05</timestamp>
      <trades>
        <trade segment_id="BSE-EQ" instrument_id="BSE:ADSL - EQ / INE102I01027">
          <id>TR501</id><order_id>ORD501</order_id>
          <timestamp>10:00:00</timestamp>
          <type>S</type>
          <quantity>-65</quantity>
          <average_price>77.50</average_price>
          <value>-5037.50</value>
        </trade>
        <trade segment_id="NSE-EQ" instrument_id="NSE:ADSL - EQ / INE102I01027">
          <id>TR502</id><order_id>ORD502</order_id>
          <timestamp>11:00:00</timestamp>
          <type>S</type>
          <quantity>-35</quantity>
          <average_price>77.45</average_price>
          <value>-2710.75</value>
        </trade>
      </trades>
      <grandtotals>
        <grandtotal><name>Brokerage</name><value>0.01</value></grandtotal>
        <grandtotal><name>Securities Transaction Tax</name><value>7.75</value></grandtotal>
        <grandtotal><name>Exchange Transaction Charges</name><value>0.23</value></grandtotal>
        <grandtotal><name>SEBI Turnover Fees</name><value>0.01</value></grandtotal>
        <grandtotal><name>Stamp Duty</name><value>0</value></grandtotal>
        <grandtotal><name>Central GST</name><value>0.02</value></grandtotal>
        <grandtotal><name>State GST</name><value>0.02</value></grandtotal>
      </grandtotals>
    </contract>
  </contracts>
</contract_note>`);

  const result = runCnPipeline(CN_XML);

  it('both trades (BSE + NSE) get same ISIN-based security_id', () => {
    const sellEvents = result.events.filter(e => e.event_type === 'SELL_TRADE');
    expect(sellEvents.length).toBe(2);
    for (const e of sellEvents) {
      expect(e.security_id).toBe('ISIN:INE102I01027');
    }
  });

  it('security_symbol is extracted as ADSL', () => {
    const sellEvents = result.events.filter(e => e.event_type === 'SELL_TRADE');
    for (const e of sellEvents) {
      expect(e.security_symbol).toBe('ADSL');
    }
  });

  it('events are created as SELL_TRADE', () => {
    const sellEvents = result.events.filter(e => e.event_type === 'SELL_TRADE');
    expect(sellEvents.length).toBe(2);
  });
});

// ===========================================================================
// Scenario 6: Mixed Portfolio — Full Pipeline Realism
// ===========================================================================

describe('Scenario 6: Mixed portfolio full pipeline', () => {
  const csv = buildTradebookCsv([
    // ADSL delivery buys on BSE (3 lots)
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '2',  '68.50', 'CNC', 'T6001', 'O6001', '09:15:00'],
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '43', '68.55', 'CNC', 'T6002', 'O6002', '09:16:00'],
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '55', '68.60', 'CNC', 'T6003', 'O6003', '09:17:00'],
    ['27-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '49', '71.35', 'CNC', 'T6004', 'O6004', '10:00:00'],
    ['27-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '10', '71.30', 'CNC', 'T6005', 'O6005', '10:01:00'],
    // ADSL delivery sells on BSE + NSE (cross-exchange FIFO)
    ['05-10-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '65', '77.50', 'CNC', 'T6006', 'O6006', '11:00:00'],
    ['05-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '35', '77.45', 'CNC', 'T6007', 'O6007', '11:30:00'],
    ['11-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '56', '86.00', 'CNC', 'T6008', 'O6008', '14:30:00'],
    ['13-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '70', '85.40', 'CNC', 'T6009', 'O6009', '15:00:00'],
    // HDFC intraday (MIS) — same-day buy+sell, loss
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy',  '25', '2490.00', 'MIS', 'T6010', 'O6010', '09:30:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '25', '2415.45', 'MIS', 'T6011', 'O6011', '14:15:00'],
    // ADSL extra sell on NSE (consumes remaining BSE lots)
    ['14-09-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '100', '76.90', 'CNC', 'T6012', 'O6012', '12:00:00'],
  ]);

  const result = runFullPipeline(csv);

  it('all ADSL events (BSE and NSE) share security_id=ISIN:INE102I01027', () => {
    const adslEvents = result.events.filter(e =>
      (e.event_type === 'BUY_TRADE' || e.event_type === 'SELL_TRADE') &&
      e.security_symbol === 'ADSL',
    );
    expect(adslEvents.length).toBeGreaterThan(0);
    for (const e of adslEvents) {
      expect(e.security_id).toBe('ISIN:INE102I01027');
    }
  });

  it('ADSL sell vouchers have INVENTORYALLOCATIONS.LIST with ADSL-SH', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const adslSellVouchers = vouchers.filter(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('ADSL') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Sale'),
    );
    expect(adslSellVouchers.length).toBeGreaterThan(0);
    for (const sv of adslSellVouchers) {
      const lines = getVoucherLines(sv);
      const inventoryLine = lines.find(l => getInventoryAllocations(l).length > 0);
      expect(inventoryLine).toBeDefined();
      const allocs = getInventoryAllocations(inventoryLine!);
      expect(allocs[0].STOCKITEMNAME).toBe('ADSL-SH');
    }
  });

  it('HDFC intraday vouchers have NO inventory allocations', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const hdfcVouchers = vouchers.filter(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('HDFC'),
    );
    expect(hdfcVouchers.length).toBeGreaterThan(0);
    for (const hv of hdfcVouchers) {
      const lines = getVoucherLines(hv);
      for (const l of lines) {
        const allocs = getInventoryAllocations(l);
        expect(allocs).toHaveLength(0);
      }
    }
  });

  it('HDFC intraday gain/loss uses speculation ledger', () => {
    const hdfcSell = result.vouchers.find(v =>
      v.narrative?.includes('HDFC') && v.narrative?.includes('Sale'),
    )!;
    expect(hdfcSell).toBeDefined();
    const specLine = hdfcSell.lines.find(l =>
      l.ledger_name.toLowerCase().includes('intraday') ||
      l.ledger_name.toLowerCase().includes('speculat'),
    );
    expect(specLine).toBeDefined();
  });

  it('all vouchers are balanced (total_debit === total_credit)', () => {
    for (const v of result.vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
  });

  it('mastersXml has ADSL-SH stock item, NOT INE102I01027-SH', () => {
    const parsed = parseXml(result.mastersXml);
    const stockItems = getStockItems(parsed);
    const adslItem = stockItems.find(s =>
      String(((s as Record<string, unknown>)['@_NAME'] ?? (s as Record<string, unknown>).NAME)) === 'ADSL-SH',
    );
    expect(adslItem).toBeDefined();

    const isinItem = stockItems.find(s =>
      String(((s as Record<string, unknown>)['@_NAME'] ?? (s as Record<string, unknown>).NAME)).includes('INE102I01027'),
    );
    expect(isinItem).toBeUndefined();
  });

  it('ADSL investment ledger has AFFECTSSTOCK=Yes', () => {
    const adslLedger = result.ledgers.find(l => l.name.includes('ADSL'));
    expect(adslLedger).toBeDefined();
    expect(adslLedger!.affects_stock).toBe(true);
  });

  it('total buy + sell events match input row count (excluding empty rows)', () => {
    const tradeEvents = result.events.filter(e =>
      e.event_type === 'BUY_TRADE' || e.event_type === 'SELL_TRADE',
    );
    // 12 data rows = 12 trade events
    expect(tradeEvents).toHaveLength(12);
  });

  it('ADSL sells on 2021-09-14 and later consume all BSE buy lots without errors', () => {
    // Total ADSL bought: 2 + 43 + 55 + 49 + 10 = 159
    // Total ADSL sold: 65 + 35 + 56 + 70 + 100 = 326
    // This exceeds available lots — but the sell on 2021-09-14 (100 qty)
    // happens before the 2021-10-05 sells, consuming lots from the BSE buys.
    // After all sells: 326 - 159 = 167 shares sold in excess → will produce
    // warnings but should not crash. Verify no thrown errors.
    const adslSellVouchers = result.vouchers.filter(v =>
      v.narrative?.includes('ADSL') && v.narrative?.includes('Sale'),
    );
    // Should have at least some sell vouchers processed
    expect(adslSellVouchers.length).toBeGreaterThan(0);
    // All should be balanced
    for (const sv of adslSellVouchers) {
      expect(sv.total_debit).toBe(sv.total_credit);
    }
  });
});

// ===========================================================================
// Scenario 7: Tally Import Conformance — XML structural validation
//
// Validates that the XML output from all bug fix scenarios will actually
// import into TallyPrime without errors. Checks every field Tally requires
// and every silent-failure pattern that causes Tally to ignore data.
// ===========================================================================

describe('Scenario 7: Tally import conformance on bug fix output', () => {
  // Reuse the mixed portfolio (Scenario 6) — it exercises all 4 bug fixes
  const csv = buildTradebookCsv([
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '2',  '68.50', 'CNC', 'T7001', 'O7001', '09:15:00'],
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '43', '68.55', 'CNC', 'T7002', 'O7002', '09:16:00'],
    ['03-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '55', '68.60', 'CNC', 'T7003', 'O7003', '09:17:00'],
    ['27-08-2021', 'BSE', 'EQ', 'ADSL', 'INE102I01027', 'buy',  '49', '71.35', 'CNC', 'T7004', 'O7004', '10:00:00'],
    ['05-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '65', '77.50', 'CNC', 'T7005', 'O7005', '11:00:00'],
    ['05-10-2021', 'NSE', 'EQ', 'ADSL', 'INE102I01027', 'sell', '35', '77.45', 'CNC', 'T7006', 'O7006', '11:30:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy',  '25', '2490.00', 'MIS', 'T7007', 'O7007', '09:30:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '25', '2415.45', 'MIS', 'T7008', 'O7008', '14:15:00'],
  ]);

  const result = runFullPipeline(csv);
  const txnParsed = parseXml(result.transactionsXml);
  const mastersParsed = parseXml(result.mastersXml);

  /** Normalize to array — Tally XML elements may be single object or array. */
  function asArray<T>(val: T | T[] | undefined): T[] {
    if (val === undefined) return [];
    return Array.isArray(val) ? val : [val];
  }

  function getAllVouchers() {
    const messages = asArray(
      txnParsed.ENVELOPE?.BODY?.DATA?.TALLYMESSAGE ??
      txnParsed.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE,
    );
    return messages
      .filter((m: Record<string, unknown>) => m.VOUCHER)
      .map((m: Record<string, unknown>) => m.VOUCHER as Record<string, unknown>);
  }

  function getAllLedgers() {
    const messages = asArray(mastersParsed.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE);
    return messages
      .filter((m: Record<string, unknown>) => m.LEDGER)
      .map((m: Record<string, unknown>) => m.LEDGER as Record<string, unknown>);
  }

  // -- Envelope structure --

  it('transactions XML has valid Tally transaction envelope', () => {
    expect(txnParsed.ENVELOPE).toBeDefined();
    expect(txnParsed.ENVELOPE.HEADER.VERSION).toBe(1);
    expect(txnParsed.ENVELOPE.HEADER.TALLYREQUEST).toBe('Import');
    expect(txnParsed.ENVELOPE.HEADER.TYPE).toBe('Data');
    expect(txnParsed.ENVELOPE.HEADER.ID).toBe('Vouchers');
    expect(txnParsed.ENVELOPE.BODY.DESC.STATICVARIABLES.SVCURRENTCOMPANY).toBe('TEST COMPANY');
  });

  it('masters XML has valid Tally envelope with REPORTNAME = All Masters', () => {
    expect(mastersParsed.ENVELOPE).toBeDefined();
    expect(mastersParsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.REPORTNAME).toBe('All Masters');
  });

  // -- Voucher required attributes --

  it('every voucher has VCHTYPE, ACTION="Create", and OBJVIEW=Accounting Voucher View', () => {
    const vouchers = getAllVouchers();
    expect(vouchers.length).toBeGreaterThan(0);
    for (const v of vouchers) {
      expect(v['@_VCHTYPE']).toBeDefined();
      expect(v['@_ACTION']).toBe('Create');
      // All vouchers are Journal type — must use Accounting Voucher View.
      expect(v['@_OBJVIEW']).toBe('Accounting Voucher View');
      expect(v.PERSISTEDVIEW).toBe('Accounting Voucher View');
    }
  });

  it('every voucher has DATE in YYYYMMDD format (8 digits, no separators)', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      expect(String(v.DATE)).toMatch(/^\d{8}$/);
      expect(v.EFFECTIVEDATE).toBe(v.DATE);
    }
  });

  it('every voucher has VOUCHERTYPENAME matching VCHTYPE', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      expect(v.VOUCHERTYPENAME).toBe(v['@_VCHTYPE']);
    }
  });

  it('every voucher has PARTYLEDGERNAME set (non-empty)', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      expect(v.PARTYLEDGERNAME).toBeDefined();
      expect(String(v.PARTYLEDGERNAME).length).toBeGreaterThan(0);
    }
  });

  // -- LEDGERENTRIES.LIST conformance --

  it('every ledger entry has ISDEEMEDPOSITIVE matching sign convention (DR=Yes/negative, CR=No/positive)', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        const amount = parseFloat(String(entry.AMOUNT));
        const deemed = String(entry.ISDEEMEDPOSITIVE);
        if (amount < 0) {
          expect(deemed).toBe('Yes'); // Debit
        } else {
          expect(deemed).toBe('No'); // Credit
        }
      }
    }
  });

  it('every ledger entry has ISLASTDEEMEDPOSITIVE mirroring ISDEEMEDPOSITIVE', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        expect(entry.ISLASTDEEMEDPOSITIVE).toBe(entry.ISDEEMEDPOSITIVE);
      }
    }
  });

  it('first ledger entry has ISPARTYLEDGER=Yes, others have No', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      if (entries.length > 0) {
        expect(entries[0].ISPARTYLEDGER).toBe('Yes');
        for (let i = 1; i < entries.length; i++) {
          expect(entries[i].ISPARTYLEDGER).toBe('No');
        }
      }
    }
  });

  it('every ledger entry has LEDGERFROMITEM=No and REMOVEZEROENTRIES=No', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        expect(entry.LEDGERFROMITEM).toBe('No');
        expect(entry.REMOVEZEROENTRIES).toBe('No');
      }
    }
  });

  it('every voucher amounts sum to zero (balanced double-entry)', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      const sum = entries.reduce(
        (acc: number, e: Record<string, unknown>) => acc + parseFloat(String(e.AMOUNT)),
        0,
      );
      expect(Math.abs(sum)).toBeLessThan(0.01);
    }
  });

  it('no ledger entry has empty or null LEDGERNAME', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        expect(entry.LEDGERNAME).toBeDefined();
        expect(String(entry.LEDGERNAME).trim().length).toBeGreaterThan(0);
      }
    }
  });

  // -- INVENTORYALLOCATIONS.LIST conformance --

  it('all vouchers (inventory or not) stay on Accounting Voucher View with no ISINVOICE', () => {
    // Journal vouchers carrying INVENTORYALLOCATIONS.LIST must NOT flip to
    // Invoice Voucher View — Tally rejects that combination with
    // "did not match the Import settings".
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      expect(v['@_OBJVIEW']).toBe('Accounting Voucher View');
      expect(v.ISINVOICE).toBeUndefined();
    }
  });

  it('inventory allocations have STOCKITEMNAME, ACTUALQTY, BILLEDQTY, RATE, AMOUNT', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        const allocs = asArray(entry['INVENTORYALLOCATIONS.LIST'] as Record<string, unknown>[]);
        for (const alloc of allocs) {
          expect(alloc.STOCKITEMNAME).toBeDefined();
          expect(String(alloc.STOCKITEMNAME).length).toBeGreaterThan(0);
          expect(alloc.ACTUALQTY).toBeDefined();
          expect(String(alloc.ACTUALQTY)).toContain('SH');
          expect(alloc.BILLEDQTY).toBeDefined();
          expect(alloc.RATE).toBeDefined();
          expect(String(alloc.RATE)).toContain('/SH');
          expect(alloc.AMOUNT).toBeDefined();
        }
      }
    }
  });

  // NOTE: ISDEEMEDPOSITIVE is intentionally NOT emitted on
  // INVENTORYALLOCATIONS.LIST — sign is conveyed through ACTUALQTY/BILLEDQTY/
  // AMOUNT. See tally-xml-conformance.test.ts for the canonical assertion.

  // -- Masters ledger conformance --

  it('every ledger master has required Tally fields', () => {
    const ledgers = getAllLedgers();
    expect(ledgers.length).toBeGreaterThan(0);
    for (const led of ledgers) {
      expect(led['@_ACTION']).toBe('Create');
      expect(led['@_RESERVEDNAME']).toBe('');
      expect(led['NAME.LIST']).toBeDefined();
      expect(led.PARENT).toBeDefined();
      expect(led.ISBILLWISEON).toBe('No');
      expect(led.ISCOSTCENTRESON).toBe('No');
      expect(led.COUNTRYOFRESIDENCE).toBe('India');
      expect(led['LANGUAGENAME.LIST']).toBeDefined();
    }
  });

  it('investment ledgers have AFFECTSSTOCK=Yes, non-investment have No', () => {
    const ledgers = getAllLedgers();
    const investmentLedgers = ledgers.filter(l =>
      String(l['@_NAME']).endsWith('-SH'),
    );
    const nonInvestmentLedgers = ledgers.filter(l =>
      !String(l['@_NAME']).endsWith('-SH'),
    );
    expect(investmentLedgers.length).toBeGreaterThan(0);
    for (const led of investmentLedgers) {
      expect(led.AFFECTSSTOCK).toBe('Yes');
    }
    for (const led of nonInvestmentLedgers) {
      expect(led.AFFECTSSTOCK).toBe('No');
    }
  });

  // -- Cross-referential integrity --

  it('every voucher LEDGERNAME exists in masters XML', () => {
    const ledgers = getAllLedgers();
    const masterLedgerNames = new Set(ledgers.map(l => String(l['@_NAME'])));

    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        const name = String(entry.LEDGERNAME);
        expect(masterLedgerNames.has(name)).toBe(true);
      }
    }
  });

  it('every STOCKITEMNAME in vouchers exists as a stock item master or matches an investment ledger', () => {
    const vouchers = getAllVouchers();
    const stockItemNames = new Set<string>();
    for (const v of vouchers) {
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        const allocs = asArray(entry['INVENTORYALLOCATIONS.LIST'] as Record<string, unknown>[]);
        for (const alloc of allocs) {
          stockItemNames.add(String(alloc.STOCKITEMNAME));
        }
      }
    }

    // Every stock item referenced in vouchers should also appear as a ledger
    // with AFFECTSSTOCK=Yes (which tells Tally to track its inventory)
    const ledgers = getAllLedgers();
    const investmentLedgerNames = new Set(
      ledgers.filter(l => l.AFFECTSSTOCK === 'Yes').map(l => String(l['@_NAME'])),
    );

    for (const name of stockItemNames) {
      expect(investmentLedgerNames.has(name)).toBe(true);
    }
  });

  // -- GROUPs before LEDGERs ordering --

  it('GROUP masters appear before LEDGER masters (Tally requires parent groups to exist first)', () => {
    const messages = asArray(mastersParsed.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE);
    const firstGroupIdx = messages.findIndex((m: Record<string, unknown>) => m.GROUP);
    const firstLedgerIdx = messages.findIndex((m: Record<string, unknown>) => m.LEDGER);
    if (firstGroupIdx >= 0 && firstLedgerIdx >= 0) {
      expect(firstGroupIdx).toBeLessThan(firstLedgerIdx);
    }
  });
});
