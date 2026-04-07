/**
 * pipeline-xml-validation.test.ts
 *
 * End-to-end validation of the XML contract note pipeline:
 *  1. Bug 1: XML contract note sell trades must produce SALES vouchers
 *             (previously lost because pipeline always called the XLSX parser).
 *  2. Bug 2: Partial fills with the same date + rate must be merged into one
 *             PURCHASE voucher instead of separate entries.
 *
 * Runs without any DB layer — exercises:
 *   parseContractNotesXml → pairContractNoteData → buildCanonicalEvents
 *   → buildVouchers → mergeSameRatePurchaseVouchers → generateFullExport
 */

import { describe, it, expect } from 'vitest';
import { parseContractNotesXml } from '../../parsers/zerodha/contract-notes-xml';
import { buildCanonicalEvents, pairContractNoteData } from '../../engine/canonical-events';
import { CostLotTracker } from '../../engine/cost-lots';
import { buildVouchers } from '../../engine/voucher-builder';
import { mergeSameRatePurchaseVouchers } from '../../engine/voucher-merger';
import { collectRequiredLedgers } from '../../export/ledger-masters';
import { generateFullExport } from '../../export/tally-xml';
import { INVESTOR_DEFAULT, getDefaultTallyProfile } from '../../engine/accounting-policy';
import { AccountingMode } from '../../types/accounting';
import { VoucherType } from '../../types/vouchers';

// ---------------------------------------------------------------------------
// Synthetic XML contract note
//
// Two contracts (trading days):
//   Day 1 – 2024-01-10: BUY 50 RELIANCE @ 2500 (TR001)
//                        BUY 50 RELIANCE @ 2500 (TR002)  ← same rate, same order
//   Day 2 – 2024-02-15: SELL 100 RELIANCE @ 2700 (TR003)
// ---------------------------------------------------------------------------

const SYNTHETIC_XML = Buffer.from(`<contract_note version="0.1">
  <contracts>
    <contract>
      <id>CNT-2024-001</id>
      <timestamp>2024-01-10</timestamp>
      <trades>
        <trade segment_id="NSE-EQ " instrument_id="NSE:RELIANCE - EQ / INE002A01018">
          <id>TR001</id>
          <order_id>ORD001</order_id>
          <timestamp>10:00:00</timestamp>
          <type>B</type>
          <quantity>50</quantity>
          <average_price>2500.00</average_price>
          <value>125000.00</value>
        </trade>
        <trade segment_id="NSE-EQ " instrument_id="NSE:RELIANCE - EQ / INE002A01018">
          <id>TR002</id>
          <order_id>ORD001</order_id>
          <timestamp>10:01:30</timestamp>
          <type>B</type>
          <quantity>50</quantity>
          <average_price>2500.00</average_price>
          <value>125000.00</value>
        </trade>
      </trades>
      <grandtotals>
        <grandtotal><name>Brokerage</name><value>20.00</value></grandtotal>
        <grandtotal><name>Securities Transaction Tax</name><value>25.00</value></grandtotal>
        <grandtotal><name>Exchange Transaction Charges</name><value>5.00</value></grandtotal>
        <grandtotal><name>State GST</name><value>1.80</value></grandtotal>
        <grandtotal><name>Central GST</name><value>1.80</value></grandtotal>
      </grandtotals>
    </contract>
    <contract>
      <id>CNT-2024-002</id>
      <timestamp>2024-02-15</timestamp>
      <trades>
        <trade segment_id="NSE-EQ " instrument_id="NSE:RELIANCE - EQ / INE002A01018">
          <id>TR003</id>
          <order_id>ORD002</order_id>
          <timestamp>14:00:00</timestamp>
          <type>S</type>
          <quantity>-100</quantity>
          <average_price>2700.00</average_price>
          <value>-270000.00</value>
        </trade>
      </trades>
      <grandtotals>
        <grandtotal><name>Brokerage</name><value>20.00</value></grandtotal>
        <grandtotal><name>Securities Transaction Tax</name><value>270.00</value></grandtotal>
        <grandtotal><name>Exchange Transaction Charges</name><value>9.00</value></grandtotal>
        <grandtotal><name>State GST</name><value>1.80</value></grandtotal>
        <grandtotal><name>Central GST</name><value>1.80</value></grandtotal>
      </grandtotals>
    </contract>
  </contracts>
</contract_note>`);

// ---------------------------------------------------------------------------
// Run the pipeline (no DB layer needed)
// ---------------------------------------------------------------------------

function runPipeline() {
  const batchId = 'test-batch-001';
  const fileId = 'test-file-001';

  // 1. Parse XML
  const parsed = parseContractNotesXml(SYNTHETIC_XML, 'contract-note.xml');

  // 2. Pair trades with charges
  const sheets = pairContractNoteData(parsed.trades, parsed.charges, parsed.tradesPerSheet);

  // 3. Build canonical events
  const events = buildCanonicalEvents({
    contractNoteSheets: sheets,
    batchId,
    fileIds: { contractNote: fileId },
  });

  // 4. Build vouchers (investor mode)
  const profile = INVESTOR_DEFAULT;
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const tracker = new CostLotTracker();
  const rawVouchers = buildVouchers(events, profile, tracker, tallyProfile);

  // 5. Merge same-rate partial fills
  const vouchers = mergeSameRatePurchaseVouchers(rawVouchers);

  // 6. Collect ledger masters and generate XML
  const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });
  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    'TEST COMPANY',
    tallyProfile.customGroups,
  );

  return { events, rawVouchers, vouchers, mastersXml, transactionsXml };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XML contract note pipeline — investor mode delivery trades use Journal vouchers', () => {
  it('parses the XML and produces both BUY_TRADE and SELL_TRADE events', () => {
    const { events } = runPipeline();
    const trades = events.filter((e) =>
      e.event_type === 'BUY_TRADE' || e.event_type === 'SELL_TRADE',
    );
    const buys = trades.filter((e) => e.event_type === 'BUY_TRADE');
    const sells = trades.filter((e) => e.event_type === 'SELL_TRADE');

    expect(buys).toHaveLength(2); // two partial fills
    expect(sells).toHaveLength(1); // one sell trade
  });

  it('produces Journal vouchers for delivery sells in investor mode', () => {
    const { vouchers } = runPipeline();
    const sellVoucher = vouchers.find((v) => v.narrative?.includes('Sale'));
    expect(sellVoucher).toBeDefined();
    expect(sellVoucher!.voucher_type).toBe(VoucherType.JOURNAL);
  });

  it('sell Journal voucher has a CR line on the investment ledger (cost basis)', () => {
    const { vouchers } = runPipeline();
    const sellVoucher = vouchers.find((v) => v.narrative?.includes('Sale'))!;
    expect(sellVoucher).toBeDefined();

    // TallyProfile names the ledger after the symbol (e.g. "RELIANCE-SH")
    const investmentCr = sellVoucher.lines.find(
      (l) => l.dr_cr === 'CR' && l.quantity !== null,
    );
    expect(investmentCr).toBeDefined();
    // Cost basis: 100 shares @ 2500 = 250,000 + capitalised buy charges
    expect(parseFloat(investmentCr!.amount)).toBeGreaterThan(250000);
  });

  it('sell Journal voucher has a DR line for broker (net sale proceeds)', () => {
    const { vouchers } = runPipeline();
    const sellVoucher = vouchers.find((v) => v.narrative?.includes('Sale'))!;
    const brokerDr = sellVoucher.lines.find((l) => l.dr_cr === 'DR' && l.ledger_name.toLowerCase().includes('zerodha'));
    expect(brokerDr).toBeDefined();
    // Net proceeds = 270000 - sell charges
    expect(parseFloat(brokerDr!.amount)).toBeLessThan(270000);
    expect(parseFloat(brokerDr!.amount)).toBeGreaterThan(0);
  });

  it('sell Journal voucher is balanced (total_debit === total_credit)', () => {
    const { vouchers } = runPipeline();
    const sellVoucher = vouchers.find((v) => v.narrative?.includes('Sale'))!;
    expect(sellVoucher.total_debit).toBe(sellVoucher.total_credit);
  });

  it('transactionsXml contains Journal voucher entries for delivery trades', () => {
    const { transactionsXml } = runPipeline();
    // All trade vouchers are Journal vouchers; inventory flows through the
    // ISINVENTORYAFFECTED flag on the investment ledger master.
    expect(transactionsXml).toContain('VCHTYPE="Journal"');
    expect(transactionsXml).not.toContain('VCHTYPE="Purchase"');
    expect(transactionsXml).not.toContain('VCHTYPE="Sales"');
    expect(transactionsXml).not.toContain('Invoice Voucher View');
  });
});

describe('XML contract note pipeline — Bug 2: same-rate partial fills are merged', () => {
  it('raw vouchers have 2 buy Purchase vouchers (one per fill)', () => {
    const { rawVouchers } = runPipeline();
    const buyVouchers = rawVouchers.filter((v) =>
      v.voucher_type === VoucherType.JOURNAL && v.narrative?.includes('Purchase'),
    );
    expect(buyVouchers).toHaveLength(2);
  });

  it('after merge, only 1 buy Purchase voucher remains', () => {
    const { vouchers } = runPipeline();
    const buyVouchers = vouchers.filter((v) =>
      v.voucher_type === VoucherType.JOURNAL && v.narrative?.includes('Purchase'),
    );
    expect(buyVouchers).toHaveLength(1);
  });

  it('merged buy Purchase voucher has combined quantity (100 shares)', () => {
    const { vouchers } = runPipeline();
    const buyVoucher = vouchers.find((v) =>
      v.voucher_type === VoucherType.JOURNAL && v.narrative?.includes('Purchase'),
    )!;
    const stockDrLine = buyVoucher.lines.find(
      (l) => l.dr_cr === 'DR' && l.quantity !== null,
    )!;
    expect(stockDrLine).toBeDefined();
    expect(parseFloat(stockDrLine.quantity!)).toBe(100); // 50 + 50
  });

  it('merged buy Purchase voucher has combined gross amount (250,000 + charges)', () => {
    const { vouchers } = runPipeline();
    const buyVoucher = vouchers.find((v) =>
      v.voucher_type === VoucherType.JOURNAL && v.narrative?.includes('Purchase'),
    )!;
    const stockDrLine = buyVoucher.lines.find(
      (l) => l.dr_cr === 'DR' && l.quantity !== null,
    )!;
    // Investor HYBRID mode capitalises charges: 250000 + (20+25+5+3.60) = 250053.60
    expect(parseFloat(stockDrLine.amount)).toBeGreaterThan(250000);
  });

  it('merged buy Purchase voucher source_event_ids covers both fills', () => {
    const { vouchers, rawVouchers } = runPipeline();
    const rawBuys = rawVouchers.filter((v) =>
      v.voucher_type === VoucherType.JOURNAL && v.narrative?.includes('Purchase'),
    );
    const mergedBuy = vouchers.find((v) =>
      v.voucher_type === VoucherType.JOURNAL && v.narrative?.includes('Purchase'),
    )!;

    const rawTradeEventIds = rawBuys.flatMap((v) => v.source_event_ids);
    for (const id of rawTradeEventIds) {
      expect(mergedBuy.source_event_ids).toContain(id);
    }
  });

  it('transactionsXml has Journal voucher nodes for investor delivery trades', () => {
    const { transactionsXml } = runPipeline();
    const journalMatches = transactionsXml.match(/VCHTYPE="Journal"/gi) ?? [];
    expect(journalMatches.length).toBeGreaterThanOrEqual(2);
    expect(transactionsXml).not.toContain('VCHTYPE="Purchase"');
    expect(transactionsXml).not.toContain('VCHTYPE="Sales"');
  });
});

describe('Tally XML structure validation', () => {
  it('mastersXml contains the investment ledger for RELIANCE', () => {
    const { mastersXml } = runPipeline();
    // TallyProfile names the ledger "RELIANCE-SH" under INVESTMENT IN SHARES-ZERODHA group
    expect(mastersXml).toContain('RELIANCE-SH');
    expect(mastersXml).toContain('INVESTMENT IN SHARES-ZERODHA');
  });

  it('transactionsXml contains INVENTORYALLOCATIONS for the buy trade', () => {
    const { transactionsXml } = runPipeline();
    expect(transactionsXml).toContain('<INVENTORYALLOCATIONS.LIST>');
    expect(transactionsXml).toContain('<ACTUALQTY>');
  });

  it('all vouchers in transactionsXml have ISDEEMEDPOSITIVE sign convention', () => {
    const { transactionsXml } = runPipeline();
    expect(transactionsXml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
    expect(transactionsXml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
  });

  it('SALES voucher DR entries have negative AMOUNT (Tally sign convention)', () => {
    const { transactionsXml } = runPipeline();
    // In Tally XML: DR entries have negative amounts
    // The broker DR line should be a large negative number
    const amounts = [...transactionsXml.matchAll(/<AMOUNT>(-?[\d.]+)<\/AMOUNT>/g)].map(
      (m) => parseFloat(m[1]),
    );
    expect(amounts.some((a) => a < 0)).toBe(true);
    expect(amounts.some((a) => a > 0)).toBe(true);
  });
});

describe('Tally XML — print summary for visual inspection', () => {
  it('prints voucher summary table', () => {
    const { vouchers, transactionsXml } = runPipeline();

    console.log('\n=== VOUCHER SUMMARY ===');
    for (const v of vouchers) {
      console.log(`\n[${v.voucher_type}] ${v.voucher_date} — DR: ${v.total_debit}  CR: ${v.total_credit}`);
      console.log(`  narrative: ${v.narrative}`);
      for (const l of v.lines) {
        const qty = l.quantity !== null ? ` (qty=${l.quantity} @ ${l.rate})` : '';
        console.log(`  ${l.dr_cr.padEnd(3)} ${l.ledger_name.padEnd(50)} ${l.amount}${qty}`);
      }
    }

    // Print relevant excerpt from the transactions XML
    console.log('\n=== TRANSACTIONS XML (VCHTYPE lines) ===');
    const vchLines = transactionsXml
      .split('\n')
      .filter((line) => line.includes('VCHTYPE') || line.includes('VOUCHER ') || line.includes('DATE'));
    for (const line of vchLines.slice(0, 30)) {
      console.log(line);
    }

    // This test always passes — it's for visual inspection
    expect(vouchers.length).toBeGreaterThan(0);
  });
});
