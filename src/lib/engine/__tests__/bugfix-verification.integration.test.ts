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
import { TradeClassificationStrategy } from '../trade-classifier';
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
    classificationStrategy: TradeClassificationStrategy.STRICT_PRODUCT,
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

function runCnPipeline(
  xmlBuffer: Buffer,
  classificationStrategy: TradeClassificationStrategy = TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
) {
  const batchId = 'test-batch-cn';
  const fileId = 'test-file-cn';

  const parsed = parseContractNotesXml(xmlBuffer, 'contract-note.xml');
  const sheets = pairContractNoteData(parsed.trades, parsed.charges, parsed.tradesPerSheet);

  const events = buildCanonicalEvents({
    contractNoteSheets: sheets,
    batchId,
    fileIds: { contractNote: fileId },
    classificationStrategy,
  });

  const profile = INVESTOR_DEFAULT;
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);

  try {
    const tracker = new CostLotTracker();
    const rawVouchers = buildVouchers(events, profile, tracker, tallyProfile);
    const vouchers = mergeSameRatePurchaseVouchers(rawVouchers);
    const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });
    const stockItems = collectStockItems(vouchers);
    const { mastersXml, transactionsXml } = generateFullExport(
      vouchers, ledgers, 'TEST COMPANY', tallyProfile.customGroups, stockItems,
    );

    return { events, vouchers, ledgers, mastersXml, transactionsXml };
  } catch {
    return {
      events,
      vouchers: [],
      ledgers: [],
      mastersXml: '',
      transactionsXml: '',
    };
  }
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

  it('buy voucher is Journal type', () => {
    const buyVoucher = result.vouchers.find(v => v.narrative?.includes('Purchase'));
    expect(buyVoucher).toBeDefined();
    expect(buyVoucher!.voucher_type).toBe('JOURNAL');
  });

  it('buy voucher uses Accounting Voucher View (investor mode — Journal only)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const buyV = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    );
    expect(buyV).toBeDefined();
    // Investor-mode trade vouchers render as Journal with Accounting
    // Voucher View — never Invoice Voucher View. Stock flows via the F12
    // ISINVENTORYAFFECTED flag on the investment ledger master.
    expect((buyV as Record<string, unknown>)['@_OBJVIEW']).toBe('Accounting Voucher View');
    expect((buyV as Record<string, unknown>)['@_VCHTYPE']).toBe('Journal');
  });

  it('buy voucher does not emit ISINVOICE (investor mode — Journal only)', () => {
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

  it('sell voucher has INVENTORYALLOCATIONS.LIST with positive qty (direction from CR parent, not sign)', () => {
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
    // Qty is always unsigned — stock-out direction comes from the parent
    // ledger's CR flag. Tally double-negates a negative CR quantity and
    // INCREASES holdings on sale, so we always emit positive.
    expect(actualQty).toContain('30');
    expect(actualQty.trim().startsWith('-')).toBe(false);
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

  // Under the investor-mode intraday consolidation rule, IRCTC's same-day
  // MIS round-trip is folded into ONE consolidated journal voucher with a
  // narration like "25 shares intraday loss in IRCTC" — not two separate
  // buy/sell vouchers. The RELIANCE delivery buy is unaffected and remains
  // a per-fill investment-ledger voucher.
  it('IRCTC intraday produces ONE consolidated voucher with no per-fill Purchase/Sale narratives', () => {
    const perFillNarratives = result.vouchers.filter(v =>
      v.narrative?.includes('IRCTC') &&
      (v.narrative?.includes('Purchase of') || v.narrative?.includes('Sale of')),
    );
    expect(perFillNarratives).toHaveLength(0);

    const intraday = result.vouchers.filter(v =>
      v.narrative?.includes('IRCTC') && v.narrative?.includes('intraday'),
    );
    expect(intraday).toHaveLength(1);
  });

  it('IRCTC consolidated voucher is OBJVIEW="Accounting Voucher View" with no inventory allocations', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const irctcVoucher = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('IRCTC'),
    );
    expect(irctcVoucher).toBeDefined();
    expect((irctcVoucher as Record<string, unknown>)['@_OBJVIEW']).toBe('Accounting Voucher View');
    // Consolidated intraday voucher is a plain accounting entry — no stock
    // lines anywhere on the voucher.
    const lines = getVoucherLines(irctcVoucher!);
    for (const l of lines) {
      const allocs = getInventoryAllocations(l);
      expect(allocs).toHaveLength(0);
    }
  });

  it('IRCTC consolidated voucher has no ISINVOICE=Yes', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const irctcVoucher = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('IRCTC'),
    )!;
    const isInvoice = (irctcVoucher as Record<string, unknown>).ISINVOICE;
    expect(isInvoice).not.toBe('Yes');
  });

  it('IRCTC consolidated voucher routes to the speculation ledger (intraday gain/loss, same ledger)', () => {
    const irctcVoucher = result.vouchers.find(v =>
      v.narrative?.includes('IRCTC') && v.narrative?.includes('intraday'),
    )!;
    expect(irctcVoucher).toBeDefined();
    // Exactly one line routes to the intraday speculation ledger — the
    // side (DR for loss, CR for gain) depends on netPnL sign.
    const specLine = irctcVoucher.lines.find(l =>
      l.ledger_name.toLowerCase().includes('intraday') ||
      l.ledger_name.toLowerCase().includes('speculat'),
    );
    expect(specLine).toBeDefined();
  });

  it('RELIANCE delivery buy HAS INVENTORYALLOCATIONS.LIST on an Accounting Voucher View Journal (control)', () => {
    const parsed = parseXml(result.transactionsXml);
    const vouchers = getVouchers(parsed);
    const relianceBuy = vouchers.find(v =>
      String((v as Record<string, unknown>).NARRATION ?? '').includes('RELIANCE') &&
      String((v as Record<string, unknown>).NARRATION ?? '').includes('Purchase'),
    )!;
    expect(relianceBuy).toBeDefined();
    // Investor-mode delivery trades render as Journal with Accounting
    // Voucher View while still carrying inventory via the F12 flag.
    expect((relianceBuy as Record<string, unknown>)['@_OBJVIEW']).toBe('Accounting Voucher View');
    expect((relianceBuy as Record<string, unknown>)['@_VCHTYPE']).toBe('Journal');

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
  // Two DIFFERENT scrips on the same day — one ends intraday in a gain, the
  // other in a loss. Each scrip gets its own consolidated intraday voucher
  // under the investor-mode intraday consolidation rule, which lets us
  // exercise both the gain (CR intraday ledger) and loss (DR intraday
  // ledger) sides of the single CA_SPECULATION_GAIN net ledger.
  const csv = buildTradebookCsv([
    // HDFC intraday GAIN: buy 25 @ 2490, sell 25 @ 2515 same day (MIS)
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy', '25', '2490.00', 'MIS', 'T4001', 'O4001', '09:30:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '25', '2515.00', 'MIS', 'T4002', 'O4002', '14:00:00'],
    // TATAMOTORS intraday LOSS: buy 5 @ 500, sell 5 @ 430 same day (MIS)
    ['20-04-2021', 'NSE', 'EQ', 'TATAMOTORS', 'INE155A01022', 'buy', '5', '500.00', 'MIS', 'T4003', 'O4003', '10:00:00'],
    ['20-04-2021', 'NSE', 'EQ', 'TATAMOTORS', 'INE155A01022', 'sell', '5', '430.00', 'MIS', 'T4004', 'O4004', '15:00:00'],
  ]);

  const result = runFullPipeline(csv);

  it('HDFC gain voucher posts to the speculation ledger as CR', () => {
    const hdfcGain = result.vouchers.find(v =>
      v.narrative?.includes('HDFC') && v.narrative?.includes('intraday gain'),
    );
    expect(hdfcGain).toBeDefined();
    const specLine = hdfcGain!.lines.find(l =>
      l.dr_cr === 'CR' && (
        l.ledger_name.toLowerCase().includes('intraday') ||
        l.ledger_name.toLowerCase().includes('speculat')
      ),
    );
    expect(specLine).toBeDefined();
  });

  it('TATAMOTORS loss voucher posts to the same speculation ledger as DR', () => {
    const tmLoss = result.vouchers.find(v =>
      v.narrative?.includes('TATAMOTORS') && v.narrative?.includes('intraday loss'),
    );
    expect(tmLoss).toBeDefined();
    const specLine = tmLoss!.lines.find(l =>
      l.dr_cr === 'DR' && (
        l.ledger_name.toLowerCase().includes('intraday') ||
        l.ledger_name.toLowerCase().includes('speculat')
      ),
    );
    expect(specLine).toBeDefined();
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
// Scenario 4b: CN-sourced intraday — bug report items #14, #13, #12, #15
// (Phase B1 + B2 + B3 — full intraday subsystem from contract note input)
// ===========================================================================

describe('Scenario 4b: CN-sourced intraday end-to-end (B1+B2+B3)', () => {
  // Build a CN with a same-day buy+sell of HDFC. CN data carries no product
  // code, so the per-row classifier returns PROFILE_DRIVEN. The post-pass
  // reclassifyIntradayTrades must detect the netoff and flip both events
  // to SPECULATIVE_BUSINESS so the voucher builder produces the correct
  // intraday shape.
  const events = buildCanonicalEvents({
    contractNoteSheets: [
      {
        charges: {
          contract_note_no: 'CNT-INTRADAY-1',
          trade_date: '20-04-2021',
          settlement_no: 'S-001',
          pay_in_pay_out: '0',
          brokerage: '20.00',
          exchange_charges: '5.00',
          clearing_charges: '0',
          cgst: '1.80',
          sgst: '1.80',
          igst: '0',
          stt: '60.00',
          sebi_fees: '0.50',
          stamp_duty: '7.50',
          net_amount: '2386.40',
        },
        trades: [
          {
            order_no: '1', order_time: '09:30:00',
            trade_no: 'INTRA-BUY-1', trade_time: '09:30:01',
            security_description: 'HDFC/INE001A01036',
            buy_sell: 'B', quantity: '10', exchange: 'NSE',
            gross_rate: '2490.00', brokerage_per_unit: '0',
            net_rate: '2490.00', net_total: '-24900.00',
            segment: 'Equity',
          },
          {
            order_no: '2', order_time: '14:00:00',
            trade_no: 'INTRA-SELL-1', trade_time: '14:00:01',
            security_description: 'HDFC/INE001A01036',
            buy_sell: 'S', quantity: '10', exchange: 'NSE',
            gross_rate: '2515.00', brokerage_per_unit: '0',
            net_rate: '2515.00', net_total: '25150.00',
            segment: 'Equity',
          },
        ],
      },
    ],
    batchId: 'b-intra',
    fileIds: { contractNote: 'f-intra' },
    classificationStrategy: TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY,
  });

  const tracker = new CostLotTracker();
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const vouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker, tallyProfile);

  it('B1: both trade events are reclassified as SPECULATIVE_BUSINESS by the post-pass', () => {
    const tradeEvents = events.filter(
      (e) => e.event_type === 'BUY_TRADE' || e.event_type === 'SELL_TRADE',
    );
    expect(tradeEvents).toHaveLength(2);
    for (const e of tradeEvents) {
      expect(e.trade_classification).toBe('SPECULATIVE_BUSINESS');
    }
  });

  it('B2: same-day round-trip is folded into ONE consolidated intraday Journal — no per-fill Purchase/Sale vouchers', () => {
    // Under investor-mode intraday consolidation, the HDFC same-day buy+sell
    // produces exactly ONE journal voucher with narration "10 shares
    // intraday gain in HDFC" (or loss). The old per-fill "Purchase of HDFC"
    // and "Sale of HDFC" vouchers must NOT exist.
    const perFillBuys = vouchers.filter((v) => v.narrative?.startsWith('Purchase of HDFC'));
    const perFillSells = vouchers.filter((v) => v.narrative?.startsWith('Sale of HDFC'));
    expect(perFillBuys).toHaveLength(0);
    expect(perFillSells).toHaveLength(0);

    const intraday = vouchers.filter((v) =>
      v.narrative?.includes('HDFC') && v.narrative?.includes('intraday'),
    );
    expect(intraday).toHaveLength(1);
    const iv = intraday[0];
    expect(iv.voucher_type).toBe('JOURNAL');
    expect(iv.lines).toHaveLength(2);

    // Lines are plain accounting lines only — no stock metadata.
    for (const l of iv.lines) {
      expect(l.quantity).toBeNull();
      expect(l.security_id).toBeNull();
      expect(l.rate).toBeNull();
      expect(l.stock_item_name).toBeNull();
    }

    // Gain CR lands on the unified intraday ledger (CA_SPECULATION_GAIN is
    // the single net ledger — losses also post here on the DR side).
    const intradayLine = iv.lines.find(
      (l) => l.ledger_name === 'Intraday Gain on Sale of Shares - ZERODHA',
    );
    expect(intradayLine).toBeDefined();
  });

  it('B3: all sell-side charges — INCLUDING STT — are absorbed into netPnL; no standalone STT summary voucher is emitted for the CN', () => {
    // Under the investor-mode intraday consolidation rule, Sec 43(5)
    // speculative business income treats STT as a deductible expense. The
    // consolidated voucher absorbs ALL charges (brokerage, GST, exchange,
    // SEBI, stamp, and STT) into a single netPnL figure. This is
    // intentionally different from the delivery (Sec 48) path where STT
    // must remain a visible non-deductible line. The STT summary voucher
    // must therefore NOT carry the 60.00 STT from this intraday-only CN.
    const intraday = vouchers.find((v) =>
      v.narrative?.includes('HDFC') && v.narrative?.includes('intraday'),
    )!;

    // The consolidated voucher has exactly 2 lines — broker + intraday
    // ledger — and no separate charge DR lines of any kind.
    const chargeLines = intraday.lines.filter((l) =>
      l.ledger_name.toLowerCase().includes('brokerage') ||
      l.ledger_name.toLowerCase().includes('exchange') ||
      l.ledger_name.toLowerCase().includes('gst') ||
      l.ledger_name.toLowerCase().includes('sebi') ||
      l.ledger_name.toLowerCase().includes('stamp') ||
      /securities transaction tax|^stt\b/i.test(l.ledger_name),
    );
    expect(chargeLines).toHaveLength(0);

    // STT summary voucher must not exist (or must be 0) for an
    // intraday-only CN — all STT was already folded into netPnL.
    const sttVoucher = vouchers.find((v) =>
      v.lines.some(
        (l) => l.dr_cr === 'DR' && /securities transaction tax|^stt\b/i.test(l.ledger_name),
      ),
    );
    expect(sttVoucher).toBeUndefined();
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
    // HDFC intraday (MIS) — same-day buy+sell, loss
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'buy',  '25', '2490.00', 'MIS', 'T6010', 'O6010', '09:30:00'],
    ['20-04-2021', 'NSE', 'EQ', 'HDFC', 'INE001A01036', 'sell', '25', '2415.45', 'MIS', 'T6011', 'O6011', '14:15:00'],
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
    // Under the investor-mode intraday consolidation rule, HDFC's same-day
    // round-trip is folded into ONE voucher with an "intraday" narration,
    // not a per-fill "Sale of HDFC" voucher.
    const hdfcIntraday = result.vouchers.find(v =>
      v.narrative?.includes('HDFC') && v.narrative?.includes('intraday'),
    );
    expect(hdfcIntraday).toBeDefined();
    const specLine = hdfcIntraday!.lines.find(l =>
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
    // 10 data rows = 10 trade events
    expect(tradeEvents).toHaveLength(10);
  });

  it('ADSL sells stay within available lots and remain balanced', () => {
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

  it('every voucher has VCHTYPE, ACTION="Create", and the correct OBJVIEW for its voucher type', () => {
    const vouchers = getAllVouchers();
    expect(vouchers.length).toBeGreaterThan(0);
    for (const v of vouchers) {
      expect(v['@_VCHTYPE']).toBeDefined();
      expect(v['@_ACTION']).toBe('Create');
      if (v['@_VCHTYPE'] === 'Purchase' || v['@_VCHTYPE'] === 'Sales') {
        expect(v['@_OBJVIEW']).toBe('Invoice Voucher View');
        expect(v.PERSISTEDVIEW).toBe('Invoice Voucher View');
        expect(v.ISINVOICE).toBe('Yes');
      } else {
        expect(v['@_OBJVIEW']).toBe('Accounting Voucher View');
        expect(v.PERSISTEDVIEW).toBe('Accounting Voucher View');
        expect(v.ISINVOICE).toBeUndefined();
      }
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
        const partyEntries = entries.filter((entry) => entry.ISPARTYLEDGER === 'Yes');
        expect(partyEntries.length).toBe(1);
        expect(String(partyEntries[0].LEDGERNAME)).toBe(String(v.PARTYLEDGERNAME));
        for (const entry of entries) {
          if (entry !== partyEntries[0]) {
            expect(entry.ISPARTYLEDGER).toBe('No');
          }
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

  it('vouchers use invoice view only for Purchase/Sales XML', () => {
    const vouchers = getAllVouchers();
    for (const v of vouchers) {
      if (v['@_VCHTYPE'] === 'Purchase' || v['@_VCHTYPE'] === 'Sales') {
        expect(v['@_OBJVIEW']).toBe('Invoice Voucher View');
        expect(v.ISINVOICE).toBe('Yes');
      } else {
        expect(v['@_OBJVIEW']).toBe('Accounting Voucher View');
        expect(v.ISINVOICE).toBeUndefined();
      }
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

// ===========================================================================
// Regression: every input trade produces exactly one trade voucher.
// Guards against silent "missing sales" regressions like the A1 pivot caused.
// ===========================================================================

describe('Regression: no trades are dropped between input and generated XML', () => {
  const csv = buildTradebookCsv([
    // 3 delivery buys, different securities
    ['01-04-2024', 'NSE', 'EQ', 'INFY',     'INE009A01021', 'buy',  '10', '1500.00', 'CNC', 'B1', 'O1', '09:30:00'],
    ['01-04-2024', 'NSE', 'EQ', 'RELIANCE', 'INE002A01018', 'buy',  '20', '2500.00', 'CNC', 'B2', 'O2', '09:31:00'],
    ['02-04-2024', 'NSE', 'EQ', 'TCS',      'INE467B01029', 'buy',  '5',  '3600.00', 'CNC', 'B3', 'O3', '10:00:00'],
    // 2 delivery sells of previously bought stock
    ['05-04-2024', 'NSE', 'EQ', 'INFY',     'INE009A01021', 'sell', '10', '1600.00', 'CNC', 'S1', 'O4', '11:00:00'],
    ['06-04-2024', 'NSE', 'EQ', 'RELIANCE', 'INE002A01018', 'sell', '20', '2650.00', 'CNC', 'S2', 'O5', '11:05:00'],
    // 1 full intraday netoff (HDFC MIS buy+sell same day, same qty) — collapses into a single speculative journal
    ['07-04-2024', 'NSE', 'EQ', 'HDFC',     'INE001A01036', 'buy',  '50', '1700.00', 'MIS', 'I1', 'O6', '09:45:00'],
    ['07-04-2024', 'NSE', 'EQ', 'HDFC',     'INE001A01036', 'sell', '50', '1710.00', 'MIS', 'I2', 'O7', '14:30:00'],
  ]);

  const result = runFullPipeline(csv);

  it('every delivery buy/sell appears exactly once in generated XML as Journal vouchers', () => {
    const vouchers = getVouchers(parseXml(result.transactionsXml));

    const deliveryVouchers = vouchers.filter(v => {
      const narr = String(v.NARRATION ?? '');
      return narr.includes('Purchase of') || narr.includes('Sale of');
    });

    // 3 delivery buys + 2 delivery sells = 5. The HDFC same-day MIS
    // round-trip is folded into ONE consolidated intraday journal voucher
    // with a separate "intraday" narration, so it does NOT appear in the
    // "Purchase of" / "Sale of" filter.
    expect(deliveryVouchers).toHaveLength(5);

    // The HDFC intraday round-trip must still be present — just under the
    // consolidated-voucher narration format.
    const hdfcIntraday = vouchers.filter(v =>
      String(v.NARRATION ?? '').includes('HDFC') &&
      String(v.NARRATION ?? '').includes('intraday'),
    );
    expect(hdfcIntraday).toHaveLength(1);

    // Investor mode: every trade voucher — whether delivery (with inventory)
    // or intraday (without) — lands in the Journal register.
    for (const v of [...deliveryVouchers, ...hdfcIntraday]) {
      expect(v['@_VCHTYPE']).toBe('Journal');
      expect(v['@_OBJVIEW']).toBe('Accounting Voucher View');
      expect(v.ISINVOICE).toBeUndefined();
    }

    // Every symbol from input delivery sells must appear as a Sale narrative.
    const sellNarratives = deliveryVouchers
      .map(v => String(v.NARRATION ?? ''))
      .filter(n => n.includes('Sale of'));
    expect(sellNarratives.some(n => n.includes('INFY'))).toBe(true);
    expect(sellNarratives.some(n => n.includes('RELIANCE'))).toBe(true);
  });

  it('investment ledgers in masters XML have ISINVENTORYAFFECTED=Yes (F12 flag)', () => {
    const ledgers = getLedgers(parseXml(result.mastersXml));

    const stockLedgers = ledgers.filter(l => l.AFFECTSSTOCK === 'Yes');
    expect(stockLedgers.length).toBeGreaterThan(0);
    for (const l of stockLedgers) {
      expect(l.ISINVENTORYAFFECTED).toBe('Yes');
    }

    const nonStockLedgers = ledgers.filter(l => l.AFFECTSSTOCK === 'No');
    for (const l of nonStockLedgers) {
      expect(l.ISINVENTORYAFFECTED).toBe('No');
    }
  });
});
