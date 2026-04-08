/**
 * Inspect a single contract note's full structure to understand reversals.
 * Usage: npx tsx scripts/probe-reversal-cn.ts <file.xlsx> <CN-number>
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseContractNotes } from '../src/lib/parsers/zerodha/contract-notes';

const [filePath, cnNo] = process.argv.slice(2);
if (!filePath || !cnNo) {
  console.error('usage: tsx scripts/probe-reversal-cn.ts <file.xlsx> <CN-number>');
  process.exit(1);
}

const buf = readFileSync(resolve(filePath));
const parsed = parseContractNotes(buf, filePath);

const tradesPerSheet = parsed.tradesPerSheet ?? [];
let cursor = 0;
parsed.charges.forEach((ch, i) => {
  const tradeCount = tradesPerSheet[i] ?? 0;
  const sheetTrades = parsed.trades.slice(cursor, cursor + tradeCount);
  cursor += tradeCount;
  if (ch.contract_note_no !== cnNo) return;

  console.log(`\n=== ${ch.contract_note_no} (sheet #${i}, date ${ch.trade_date}) ===`);
  console.log(`Charges:`);
  for (const k of Object.keys(ch)) {
    console.log(`  ${k}: ${(ch as any)[k]}`);
  }
  console.log(`\nTrades (${sheetTrades.length}):`);
  for (const t of sheetTrades) {
    console.log(
      `  trade=${t.trade_no} ${t.buy_sell} qty=${t.quantity} sec="${t.security_description}" rate=${t.gross_rate} net_total=${t.net_total}`,
    );
  }
});
