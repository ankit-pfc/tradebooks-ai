import { describe, expect, it, beforeAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Decimal from 'decimal.js';

import { parseTradebook } from '../../lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '../../lib/parsers/zerodha/contract-notes';
import { buildCanonicalEvents, pairContractNoteData } from '../../lib/engine/canonical-events';
import { TradeClassificationStrategy } from '../../lib/engine/trade-classifier';
import { matchTrades } from '../../lib/engine/trade-matcher';
import { CostLotTracker } from '../../lib/engine/cost-lots';
import { buildVouchers } from '../../lib/engine/voucher-builder';
import { mergeSameRatePurchaseVouchers } from '../../lib/engine/voucher-merger';
import { INVESTOR_DEFAULT, getDefaultTallyProfile } from '../../lib/engine/accounting-policy';
import { AccountingMode } from '../../lib/types/accounting';
import { EventType } from '../../lib/types/events';
import { collectRequiredLedgers } from '../../lib/export/ledger-masters';
import { generateFullExport, resolveVoucherXmlRenderConfig } from '../../lib/export/tally-xml';

const FIXTURE_PATH = resolve(process.cwd(), 'src', 'tests', 'fixtures', 'tally-handoff-pack-fixture.json');
const OUTPUT_ROOT = resolve(
  process.cwd(),
  'src',
  'tests',
  'fixtures',
  'tally-handoff-output',
  'real-zerodha',
);

type ParsedNote = {
  noteNo: string;
  tradeDate: string;
  settlementNo: string;
  trades: ReturnType<typeof parseContractNotes>['trades'];
  charges: ReturnType<typeof parseContractNotes>['charges'][number];
};

function sum(values: Array<string | number | null | undefined>): Decimal {
  return values.reduce((acc, value) => {
    if (value === null || value === undefined || value === '') return acc;
    return acc.add(new Decimal(String(value).replace(/[₹,\s]/g, '')));
  }, new Decimal(0));
}

function buildTradebookSubset(rows: ReturnType<typeof parseTradebook>['rows'], keepDates: Set<string>) {
  const csvRows = rows
    .filter((row) => keepDates.has(row.trade_date))
    .map((row) => [
      row.trade_date,
      row.exchange,
      row.segment,
      row.symbol,
      row.isin,
      row.trade_type.toUpperCase(),
      row.quantity,
      row.price,
      row.trade_id,
      row.order_id,
      row.order_execution_time,
    ]);

  const header = [
    'Trade Date',
    'Exchange',
    'Segment',
    'Symbol/Scrip',
    'ISIN',
    'Trade Type',
    'Quantity',
    'Price',
    'Trade ID',
    'Order ID',
    'Order Execution Time',
  ];

  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [header, ...csvRows].map((row) => row.map(escape).join(','));
  return Buffer.from(`\ufeff${lines.join('\n')}`);
}

function noteGrossTradeTotal(note: { trades: ParsedNote['trades'] }): Decimal {
  return note.trades.reduce((acc, trade) => {
    const tradeValue = new Decimal(trade.quantity).mul(new Decimal(trade.gross_rate));
    return acc.add(trade.buy_sell === 'B' ? tradeValue.negated() : tradeValue);
  }, new Decimal(0));
}

function noteAllocatedTotals(events: ReturnType<typeof buildCanonicalEvents>, noteNo: string) {
  const relevant = events.filter((event) => event.contract_note_ref === noteNo);
  const byType = (type: EventType) =>
    sum(relevant.filter((event) => event.event_type === type).map((event) => event.charge_amount));
  return {
    brokerage: byType(EventType.BROKERAGE),
    exchange: byType(EventType.EXCHANGE_CHARGE),
    gst: byType(EventType.GST_ON_CHARGES),
    sebi: byType(EventType.SEBI_CHARGE),
    stamp: byType(EventType.STAMP_DUTY),
    stt: byType(EventType.STT),
  };
}

function buildPipeline(
  tradebookRows: ReturnType<typeof parseTradebook>['rows'],
  notes: ParsedNote[],
) {
  const parsedTradebook = parseTradebook(
    buildTradebookSubset(tradebookRows, new Set(notes.map((n) => n.tradeDate))),
    'handoff-tradebook.csv',
  );
  const parsedCn = {
    trades: notes.flatMap((note) => note.trades),
    charges: notes.map((note) => note.charges),
    tradesPerSheet: notes.map((note) => note.trades.length),
  };
  const cnSheets = pairContractNoteData(parsedCn.trades, parsedCn.charges, parsedCn.tradesPerSheet);
  const events = buildCanonicalEvents({
    tradebookRows: parsedTradebook.rows,
    contractNoteSheets: cnSheets,
    batchId: 'handoff-batch',
    fileIds: { tradebook: 'tradebook', contractNote: 'contract-note' },
    classificationStrategy: TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT,
    deterministicIds: true,
  });
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const tracker = new CostLotTracker();
  const rawVouchers = buildVouchers(events, INVESTOR_DEFAULT, tracker, tallyProfile);
  const vouchers = mergeSameRatePurchaseVouchers(rawVouchers);
  const ledgers = collectRequiredLedgers(events, INVESTOR_DEFAULT, { tallyProfile });
  const stockItemNames = new Set<string>();
  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      if (line.quantity !== null && line.rate !== null) {
        stockItemNames.add(line.stock_item_name ?? line.ledger_name);
      }
    }
  }
  const stockItems = [...stockItemNames].sort().map((name) => ({ name, baseUnit: 'SH' }));
  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    'VERIFY CO',
    tallyProfile.customGroups,
    stockItems,
  );
  const tradeMatch = matchTrades(
    parsedTradebook.rows,
    cnSheets.flatMap((sheet) =>
      sheet.trades.map((trade) => ({ trade, tradeDate: sheet.charges.trade_date })),
    ),
  );
  return { parsedTradebook, parsedCn, cnSheets, events, rawVouchers, vouchers, ledgers, mastersXml, transactionsXml, tradeMatch, stockItems };
}

function findSimpleBuyNote(notes: ParsedNote[]) {
  return notes.find((note) => note.trades.length === 1 && note.trades[0]?.buy_sell === 'B') ?? null;
}

function findSameDayMixedNote(notes: ParsedNote[]) {
  return notes.find((note) => {
    const sides = new Set(note.trades.map((trade) => trade.buy_sell));
    return sides.has('B') && sides.has('S');
  }) ?? null;
}

function findPartialFifoCase(events: ReturnType<typeof buildCanonicalEvents>) {
  const tracker = new CostLotTracker();
  const lotToNoteRef = new Map<string, string | null>();

  const buySellEvents = [...events]
    .filter((event) => event.event_type === EventType.BUY_TRADE || event.event_type === EventType.SELL_TRADE)
    .sort((a, b) => {
      const dateCmp = a.event_date.localeCompare(b.event_date);
      if (dateCmp !== 0) return dateCmp;
      return a.event_type === EventType.BUY_TRADE ? -1 : 1;
    });

  for (const event of buySellEvents) {
    if (event.event_type === EventType.BUY_TRADE) {
      tracker.addLot(event);
      const lots = tracker.toJSON().lots[event.security_id ?? ''] ?? [];
      const newest = lots.find((lot) => lot.source_buy_event_id === event.event_id) ?? lots[lots.length - 1];
      if (newest) {
        lotToNoteRef.set(newest.cost_lot_id, event.contract_note_ref ?? null);
      }
      continue;
    }

    const beforeLots = tracker.toJSON().lots[event.security_id ?? ''] ?? [];
    if (beforeLots.length === 0) continue;

    let disposals;
    try {
      disposals = tracker.disposeLots(event, 'FIFO');
    } catch {
      continue;
    }

    const partial = disposals.some((disposal) => {
      const lot = beforeLots.find((candidate) => candidate.cost_lot_id === disposal.lot_id);
      return lot ? new Decimal(disposal.quantity_sold).lt(new Decimal(lot.open_quantity)) : false;
    });
    if (!partial && disposals.length <= 1) continue;

    const noteRefs = new Set<string>();
    for (const disposal of disposals) {
      const lot = beforeLots.find((candidate) => candidate.cost_lot_id === disposal.lot_id);
      if (!lot) continue;
      const ref = lotToNoteRef.get(lot.cost_lot_id);
      if (ref) noteRefs.add(ref);
    }
    if (event.contract_note_ref) noteRefs.add(event.contract_note_ref);
    return { sell: event, noteRefs: [...noteRefs] };
  }

  return null;
}

function buildChecklist(sampleName: string, build: ReturnType<typeof buildPipeline>, notes: ParsedNote[]): string {
  const voucherTypes = [...new Set(
    build.vouchers.map((voucher) => resolveVoucherXmlRenderConfig(voucher).tallyVoucherType),
  )].join(', ');
  const first = build.vouchers[0];
  const signExample = first?.lines
    .map((line) => `${line.dr_cr}:${line.ledger_name}:${line.amount}`)
    .slice(0, 3)
    .join('\n');

  return [
    `# ${sampleName} Tally Import Checklist`,
    '',
    `- Masters that must exist first: broker ledger, stock item(s), UOM SH, charge ledgers, and gain/loss ledgers.`,
    `- Voucher type used: ${voucherTypes}.`,
    `- Why that voucher type is correct: delivery equity trades use Journal vouchers so inventory allocations and gain/loss can be posted without switching to invoice-style vouchers.`,
    `- Sign conventions used: debits are negative amounts in XML, credits are positive amounts; purchase inventory quantities are positive, sale inventory quantities are negative.`,
    `- Quantity/date/rate formatting: dates are YYYYMMDD, quantities carry the SH unit, and rates are written as rate/SH.`,
    `- Representative voucher lines:\n${signExample}`,
    `- Included notes: ${notes.map((note) => note.noteNo).join(', ')}.`,
  ].join('\n');
}

function buildReconciliation(sampleName: string, build: ReturnType<typeof buildPipeline>, notes: ParsedNote[]) {
  const voucherSummaries = build.vouchers.map((voucher) => {
    const stockLine = voucher.lines.find((line) => line.quantity !== null);
    const gainLine = voucher.lines.find((line) =>
      /STCG|LTCG|Speculative|Loss|Profit/i.test(line.ledger_name),
    );
    return {
      voucher_number: voucher.external_reference,
      voucher_type: voucher.voucher_type,
      total_debit: voucher.total_debit,
      total_credit: voucher.total_credit,
      stock_item: stockLine?.stock_item_name ?? null,
      cost_basis: stockLine?.amount ?? '0.00',
      gain_loss: gainLine?.amount ?? '0.00',
      narration: voucher.narrative,
    };
  });

  const noteReports = notes.map((note) => {
    const alloc = noteAllocatedTotals(build.events, note.noteNo);
    const grossTradeTotal = noteGrossTradeTotal(note);
    const derived = grossTradeTotal
      .sub(alloc.brokerage)
      .sub(alloc.exchange)
      .sub(alloc.gst)
      .sub(alloc.sebi)
      .sub(alloc.stamp)
      .sub(alloc.stt);
    const source = new Decimal(note.charges.net_amount);
    return {
      contract_note_no: note.noteNo,
      gross_trade_total: grossTradeTotal.toFixed(2),
      allocated_brokerage: alloc.brokerage.toFixed(2),
      allocated_exchange_charges: alloc.exchange.toFixed(2),
      allocated_gst: alloc.gst.toFixed(2),
      allocated_sebi_charges: alloc.sebi.toFixed(2),
      allocated_stamp_duty: alloc.stamp.toFixed(2),
      allocated_stt: alloc.stt.toFixed(2),
      final_derived_broker_payable_receivable: derived.toFixed(2),
      source_contract_note_payable_receivable: source.toFixed(2),
      variance: derived.minus(source).toFixed(2),
    };
  });

  return {
    sample_name: sampleName,
    note_count: notes.length,
    note_reports: noteReports,
    voucher_summaries: voucherSummaries,
    trade_match: {
      matched: build.tradeMatch.matched.length,
      unmatched_tradebook: build.tradeMatch.unmatchedTradebook.length,
      unmatched_contract_note: build.tradeMatch.unmatchedContractNote.length,
    },
  };
}

function writeSampleFiles(sampleName: string, build: ReturnType<typeof buildPipeline>, notes: ParsedNote[]) {
  const sampleDir = resolve(OUTPUT_ROOT, sampleName);
  mkdirSync(sampleDir, { recursive: true });
  const mastersPath = resolve(sampleDir, 'masters.xml');
  const transactionsPath = resolve(sampleDir, 'transactions.xml');
  const checklistPath = resolve(sampleDir, 'checklist.md');
  const reconciliationPath = resolve(sampleDir, 'reconciliation.json');
  writeFileSync(mastersPath, build.mastersXml);
  writeFileSync(transactionsPath, build.transactionsXml);
  writeFileSync(checklistPath, buildChecklist(sampleName, build, notes));
  writeFileSync(reconciliationPath, JSON.stringify(buildReconciliation(sampleName, build, notes), null, 2));
  return { sampleDir, mastersPath, transactionsPath, checklistPath, reconciliationPath };
}

type HandoffPackFixture = {
  tradebookRows: ReturnType<typeof parseTradebook>['rows'];
  notes: ParsedNote[];
};

describe('Tally handoff pack', () => {
  let pack: {
    samples: Array<{
      name: string;
      paths: ReturnType<typeof writeSampleFiles>;
      build: ReturnType<typeof buildPipeline>;
      notes: ParsedNote[];
    }>;
  } | null = null;

  beforeAll(() => {
    const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as HandoffPackFixture;
    const notes = fixture.notes;

    expect(notes.length).toBeGreaterThan(0);

    const fullBuild = buildPipeline(fixture.tradebookRows, notes);
    const simpleBuyNote = findSimpleBuyNote(notes);
    const sameDayNote = findSameDayMixedNote(notes);
    const partialFifo = findPartialFifoCase(fullBuild.events);

    expect(simpleBuyNote).toBeTruthy();
    expect(sameDayNote).toBeTruthy();
    expect(partialFifo).toBeTruthy();

    const partialNotes = partialFifo
      ? partialFifo.noteRefs
          .map((noteNo) => notes.find((note) => note.noteNo === noteNo))
          .filter((note): note is ParsedNote => Boolean(note))
      : [];

    const samples = [
      {
        name: 'simple-buy',
        notes: [simpleBuyNote!],
      },
      {
        name: 'partial-fifo-sell',
        notes: partialNotes,
      },
      {
        name: 'same-day-buy-sell',
        notes: [sameDayNote!],
      },
    ];

    pack = {
      samples: samples.map((sample) => {
        const build = buildPipeline(fixture.tradebookRows, sample.notes);
        const paths = writeSampleFiles(sample.name, build, sample.notes);
        return {
          name: sample.name,
          paths,
          build,
          notes: sample.notes,
        };
      }),
    };
  });

  it('handles the checked-in negative-charge contract note and produces balanced vouchers', () => {
    // Regression: real Zerodha CNs include small negative exchange-charge
    // rebates (e.g. -0.59). The handoff pack used to throw before the user
    // ever saw a voucher; it now absorbs the rebate into the capitalized
    // asset cost on the buy side and produces a balanced Tally export.
    const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'src', 'tests', 'fixtures', 'negative-charge-cn.json'), 'utf8')) as {
      tradebookRows: ReturnType<typeof parseTradebook>['rows'];
      contractNote: {
        trades: ReturnType<typeof parseContractNotes>['trades'];
        charges: ReturnType<typeof parseContractNotes>['charges'][number];
      };
    };

    const build = buildPipeline(fixture.tradebookRows, [{
      noteNo: fixture.contractNote.charges.contract_note_no,
      tradeDate: fixture.contractNote.charges.trade_date,
      settlementNo: fixture.contractNote.charges.settlement_no,
      trades: fixture.contractNote.trades,
      charges: fixture.contractNote.charges,
    }]);

    expect(build.vouchers.length).toBeGreaterThan(0);
    for (const v of build.vouchers) {
      expect(v.total_debit).toBe(v.total_credit);
    }
    expect(build.mastersXml).toContain('<ENVELOPE>');
    expect(build.transactionsXml).toContain('<ENVELOPE>');
  });

  it('writes deterministic artifact files for each sample', () => {
    expect(pack).not.toBeNull();
    for (const sample of pack!.samples) {
      expect(existsSync(sample.paths.mastersPath)).toBe(true);
      expect(existsSync(sample.paths.transactionsPath)).toBe(true);
      expect(existsSync(sample.paths.checklistPath)).toBe(true);
      expect(existsSync(sample.paths.reconciliationPath)).toBe(true);
    }
  });

  it('generates exact XML snapshots for the three samples', () => {
    expect(pack).not.toBeNull();
    for (const sample of pack!.samples) {
      expect(sample.build.mastersXml).toMatchSnapshot(`${sample.name} masters xml`);
      expect(sample.build.transactionsXml).toMatchSnapshot(`${sample.name} transactions xml`);
    }
  });
});
