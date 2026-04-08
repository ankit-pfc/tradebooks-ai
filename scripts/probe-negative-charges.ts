/**
 * Probe: scan real Zerodha contract notes for negative charge amounts.
 *
 * Purpose: determine whether the `.abs()` calls at canonical-events.ts:567,596
 * are guarding against real-world inputs (i.e., reversal/rebate CNs that
 * actually appear in user data) or are dead defensive code.
 *
 * Run:
 *   npx tsx scripts/probe-negative-charges.ts "<path-to-CN-xlsx>" [more files...]
 *
 * Reports, per file:
 *   - count of CN sheets parsed
 *   - any aggregate charge field (brokerage/stt/exch/clearing/cgst/sgst/igst/sebi/stamp) < 0
 *   - any per-trade allocated charge < 0 after allocateCharges
 *   - any consolidated GST total < 0
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Decimal from 'decimal.js';
import { parseContractNotes } from '../src/lib/parsers/zerodha/contract-notes';
import { allocateCharges } from '../src/lib/engine/charge-allocator';
import type {
  ZerodhaContractNoteCharges,
  ZerodhaContractNoteTradeRow,
} from '../src/lib/parsers/zerodha/types';

const CHARGE_FIELDS: (keyof ZerodhaContractNoteCharges)[] = [
  'brokerage',
  'exchange_charges',
  'clearing_charges',
  'cgst',
  'sgst',
  'igst',
  'stt',
  'sebi_fees',
  'stamp_duty',
];

function dec(raw: string | undefined | null): Decimal {
  if (!raw || String(raw).trim() === '') return new Decimal(0);
  return new Decimal(String(raw).replace(/[₹,\s]/g, ''));
}

function probe(filePath: string) {
  const abs = resolve(filePath);
  const buf = readFileSync(abs);
  const parsed = parseContractNotes(buf, abs);

  console.log(`\n=== ${filePath} ===`);
  console.log(`  trades:  ${parsed.trades.length}`);
  console.log(`  charges: ${parsed.charges.length} sheet(s)`);
  if (parsed.diagnostics?.length) {
    for (const d of parsed.diagnostics) console.log(`  ! ${d}`);
  }

  let aggregateNegHits = 0;
  let allocatedNegHits = 0;
  let gstNegHits = 0;
  const tradesPerSheet = parsed.tradesPerSheet ?? [];
  let cursor = 0;

  parsed.charges.forEach((ch, sheetIdx) => {
    // 1. Aggregate-level negatives
    for (const f of CHARGE_FIELDS) {
      const v = dec(ch[f] as string);
      if (v.isNegative()) {
        aggregateNegHits++;
        console.log(
          `  [neg-aggregate] sheet#${sheetIdx} CN=${ch.contract_note_no} date=${ch.trade_date} ${f}=${v.toFixed(2)}`,
        );
      }
    }

    // 2. Allocated per-trade negatives
    const tradeCount = tradesPerSheet[sheetIdx] ?? 0;
    const sheetTrades: ZerodhaContractNoteTradeRow[] = parsed.trades.slice(
      cursor,
      cursor + tradeCount,
    );
    cursor += tradeCount;
    if (sheetTrades.length === 0) return;

    const allocs = allocateCharges(sheetTrades, ch);
    for (const alloc of allocs) {
      const allocFields: (keyof typeof alloc)[] = [
        'brokerage',
        'stt',
        'exchange_charges',
        'clearing_charges',
        'cgst',
        'sgst',
        'igst',
        'sebi_fees',
        'stamp_duty',
      ];
      for (const f of allocFields) {
        const v = dec(alloc[f] as string);
        if (v.isNegative()) {
          allocatedNegHits++;
          console.log(
            `  [neg-allocated] CN=${ch.contract_note_no} trade=${alloc.trade_no} ${String(f)}=${v.toFixed(2)}`,
          );
        }
      }
      const gst = dec(alloc.cgst).add(dec(alloc.sgst)).add(dec(alloc.igst));
      if (gst.isNegative()) {
        gstNegHits++;
        console.log(
          `  [neg-gst-total] CN=${ch.contract_note_no} trade=${alloc.trade_no} gst=${gst.toFixed(2)}`,
        );
      }
    }
  });

  console.log(
    `  summary: aggregate-negatives=${aggregateNegHits}  allocated-negatives=${allocatedNegHits}  gst-negatives=${gstNegHits}`,
  );

  return { aggregateNegHits, allocatedNegHits, gstNegHits };
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: tsx scripts/probe-negative-charges.ts <file.xlsx> [...]');
  process.exit(1);
}

let totals = { aggregateNegHits: 0, allocatedNegHits: 0, gstNegHits: 0 };
for (const f of files) {
  try {
    const r = probe(f);
    totals.aggregateNegHits += r.aggregateNegHits;
    totals.allocatedNegHits += r.allocatedNegHits;
    totals.gstNegHits += r.gstNegHits;
  } catch (e) {
    console.error(`FAILED ${f}: ${(e as Error).message}`);
  }
}

console.log(`\n=== TOTAL across ${files.length} file(s) ===`);
console.log(JSON.stringify(totals, null, 2));
