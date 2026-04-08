/**
 * Verify the "reversal CN" convention across all real contract notes:
 *
 * Hypothesis: a reversal CN has
 *   - all charge fields <= 0 (with at least one strictly < 0)
 *   - net_total < 0 on every trade row
 *   - buy_sell and quantity stay POSITIVE (sign lives in money columns)
 *
 * This script classifies every CN as: NORMAL, REVERSAL, or MIXED (violates
 * the hypothesis — would force a more nuanced fix).
 *
 * Usage: npx tsx scripts/probe-reversal-pattern.ts <file.xlsx> [...]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Decimal from 'decimal.js';
import { parseContractNotes } from '../src/lib/parsers/zerodha/contract-notes';
import type {
  ZerodhaContractNoteCharges,
  ZerodhaContractNoteTradeRow,
} from '../src/lib/parsers/zerodha/types';

const CHARGE_FIELDS: (keyof ZerodhaContractNoteCharges)[] = [
  'brokerage', 'exchange_charges', 'clearing_charges',
  'cgst', 'sgst', 'igst', 'stt', 'sebi_fees', 'stamp_duty',
];

function dec(raw: string | undefined | null): Decimal {
  if (!raw || String(raw).trim() === '') return new Decimal(0);
  return new Decimal(String(raw).replace(/[₹,\s]/g, ''));
}

type Klass = 'NORMAL' | 'REVERSAL' | 'MIXED' | 'EMPTY';

interface CnReport {
  cn: string;
  date: string;
  klass: Klass;
  reasons: string[];
}

function classify(
  ch: ZerodhaContractNoteCharges,
  trades: ZerodhaContractNoteTradeRow[],
): CnReport {
  const reasons: string[] = [];
  if (trades.length === 0) {
    return { cn: ch.contract_note_no, date: ch.trade_date, klass: 'EMPTY', reasons: ['no trades'] };
  }

  // Charge sign profile
  const chargeSigns = CHARGE_FIELDS.map((f) => {
    const v = dec(ch[f] as string);
    if (v.isZero()) return 0;
    return v.isNegative() ? -1 : 1;
  });
  const hasNegCharge = chargeSigns.some((s) => s === -1);
  const hasPosCharge = chargeSigns.some((s) => s === 1);

  // pay_in_pay_out / net_amount sign
  const payInOut = dec(ch.pay_in_pay_out);
  const netAmt = dec(ch.net_amount);

  // Trade-row sign profile
  const tradeNetTotals = trades.map((t) => dec(t.net_total));
  const allNetNeg = tradeNetTotals.every((v) => v.isNegative());
  const allNetPos = tradeNetTotals.every((v) => v.isPositive() || v.isZero());
  const anyQtyNeg = trades.some((t) => dec(t.quantity).isNegative());
  const anyBuySellLowercase = trades.some(
    (t) => t.buy_sell !== 'B' && t.buy_sell !== 'S',
  );

  // Pure NORMAL: no negatives anywhere
  if (!hasNegCharge && allNetPos && !anyQtyNeg) {
    return { cn: ch.contract_note_no, date: ch.trade_date, klass: 'NORMAL', reasons: [] };
  }

  // Pure REVERSAL hypothesis: charges all <=0 (any neg), all net_totals neg,
  // qty positive, buy_sell B/S as normal
  if (hasNegCharge && !hasPosCharge && allNetNeg && !anyQtyNeg && !anyBuySellLowercase) {
    if (payInOut.isNegative() || payInOut.isZero()) {
      // OK
    } else {
      reasons.push(`pay_in_pay_out=${payInOut} not negative`);
    }
    if (netAmt.isPositive()) reasons.push(`net_amount=${netAmt} not negative`);
    if (reasons.length === 0) {
      return { cn: ch.contract_note_no, date: ch.trade_date, klass: 'REVERSAL', reasons: [] };
    }
  }

  // Anything else: MIXED — record what's weird
  if (hasNegCharge && hasPosCharge) reasons.push('mixed-sign charges');
  if (!allNetPos && !allNetNeg) reasons.push('mixed-sign net_totals');
  if (anyQtyNeg) reasons.push('negative quantity present');
  if (anyBuySellLowercase) reasons.push('non-B/S buy_sell value');
  if (hasNegCharge && allNetPos) reasons.push('neg charges but positive net_totals');
  if (!hasNegCharge && allNetNeg) reasons.push('positive charges but negative net_totals');
  return {
    cn: ch.contract_note_no,
    date: ch.trade_date,
    klass: 'MIXED',
    reasons,
  };
}

function probe(filePath: string) {
  const buf = readFileSync(resolve(filePath));
  const parsed = parseContractNotes(buf, filePath);
  const tradesPerSheet = parsed.tradesPerSheet ?? [];
  let cursor = 0;

  const reports: CnReport[] = [];
  parsed.charges.forEach((ch, i) => {
    const tradeCount = tradesPerSheet[i] ?? 0;
    const sheetTrades = parsed.trades.slice(cursor, cursor + tradeCount);
    cursor += tradeCount;
    reports.push(classify(ch, sheetTrades));
  });

  const counts = { NORMAL: 0, REVERSAL: 0, MIXED: 0, EMPTY: 0 };
  for (const r of reports) counts[r.klass]++;

  console.log(`\n=== ${filePath} ===`);
  console.log(`  total CNs: ${reports.length}`);
  console.log(`  NORMAL:   ${counts.NORMAL}`);
  console.log(`  REVERSAL: ${counts.REVERSAL}`);
  console.log(`  MIXED:    ${counts.MIXED}`);
  console.log(`  EMPTY:    ${counts.EMPTY}`);

  const reversals = reports.filter((r) => r.klass === 'REVERSAL');
  if (reversals.length > 0) {
    console.log(`  reversal CN numbers (first 20):`);
    for (const r of reversals.slice(0, 20)) {
      console.log(`    - ${r.cn} (${r.date})`);
    }
  }

  const mixed = reports.filter((r) => r.klass === 'MIXED');
  if (mixed.length > 0) {
    console.log(`  MIXED CNs — VIOLATE THE REVERSAL HYPOTHESIS:`);
    for (const r of mixed) {
      console.log(`    - ${r.cn} (${r.date}): ${r.reasons.join('; ')}`);
    }
  }

  return counts;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: tsx scripts/probe-reversal-pattern.ts <file.xlsx> [...]');
  process.exit(1);
}

const totals = { NORMAL: 0, REVERSAL: 0, MIXED: 0, EMPTY: 0 };
for (const f of files) {
  const c = probe(f);
  totals.NORMAL += c.NORMAL;
  totals.REVERSAL += c.REVERSAL;
  totals.MIXED += c.MIXED;
  totals.EMPTY += c.EMPTY;
}

console.log(`\n=== TOTAL across ${files.length} file(s) ===`);
console.log(JSON.stringify(totals, null, 2));
if (totals.MIXED > 0) {
  console.log(`\n⚠ ${totals.MIXED} CN(s) violate the simple reversal hypothesis. The fix design must handle them.`);
} else {
  console.log(`\n✓ Reversal hypothesis holds across all real CNs. Safe to design around it.`);
}
