import { describe, it, expect } from 'vitest';
import {
  disambiguateVoucherNumbers,
  mergeDailySummaryPurchaseVouchers,
  mergePurchaseVouchers,
  mergeSameRatePurchaseVouchers,
} from '../voucher-merger';
import { VoucherType, VoucherStatus } from '../../types/vouchers';
import type { VoucherLine } from '../../types/vouchers';
import type { BuiltVoucherDraft } from '../voucher-builder';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeLine(overrides: Partial<VoucherLine> = {}): VoucherLine {
  return {
    voucher_line_id: crypto.randomUUID(),
    voucher_draft_id: 'v-1',
    line_no: 1,
    ledger_name: 'Test Ledger',
    amount: '1000.00',
    dr_cr: 'DR',
    security_id: null,
    quantity: null,
    rate: null,
    cost_center: null,
    bill_ref: null,
    ...overrides,
  };
}

/** Build a simple PURCHASE voucher resembling buildBuyVoucher output. */
function makePurchaseVoucher(opts: {
  date?: string;
  ledger?: string;
  qty?: string;
  rate?: string;
  gross?: string;
  brokerAmount?: string;
  voucherId?: string;
  eventIds?: string[];
}): BuiltVoucherDraft {
  const {
    date = '2024-06-15',
    ledger = 'Investment in Equity Shares - RELIANCE',
    qty = '10',
    rate = '2500.00',
    gross = '25000.00',
    brokerAmount = '25000.00',
    voucherId = crypto.randomUUID(),
    eventIds = [crypto.randomUUID()],
  } = opts;

  return {
    voucher_draft_id: voucherId,
    import_batch_id: 'batch-1',
    voucher_type: VoucherType.PURCHASE,
    voucher_date: date,
    external_reference: 'T001',
    narrative: `Purchase of ${ledger} @ ${rate} × ${qty} units`,
    total_debit: gross,
    total_credit: brokerAmount,
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: eventIds,
    created_at: new Date().toISOString(),
    lines: [
      // DR: stock / investment ledger (with quantity + rate = stock line)
      makeLine({
        voucher_draft_id: voucherId,
        line_no: 1,
        ledger_name: ledger,
        amount: gross,
        dr_cr: 'DR',
        quantity: qty,
        rate,
        security_id: 'NSE:RELIANCE',
      }),
      // CR: broker
      makeLine({
        voucher_draft_id: voucherId,
        line_no: 2,
        ledger_name: 'Zerodha Kite',
        amount: brokerAmount,
        dr_cr: 'CR',
        quantity: null,
        rate: null,
      }),
    ],
  };
}

function makeSalesVoucher(
  dateOrOpts: string | { date?: string; ledger?: string; qty?: string; rate?: string; gross?: string } = '2024-06-15',
): BuiltVoucherDraft {
  const opts = typeof dateOrOpts === 'string' ? { date: dateOrOpts } : dateOrOpts;
  const {
    date = '2024-06-15',
    ledger = 'Investment in Equity Shares - RELIANCE',
    qty = '-10',
    rate = '2500.00',
    gross = '26000.00',
  } = opts;
  const id = crypto.randomUUID();
  return {
    voucher_draft_id: id,
    import_batch_id: 'batch-1',
    voucher_type: VoucherType.SALES,
    voucher_date: date,
    external_reference: null,
    narrative: 'Sale',
    total_debit: gross,
    total_credit: gross,
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [crypto.randomUUID()],
    created_at: new Date().toISOString(),
    lines: [
      makeLine({ voucher_draft_id: id, line_no: 1, ledger_name: 'Zerodha Kite', amount: gross, dr_cr: 'DR' }),
      makeLine({ voucher_draft_id: id, line_no: 2, ledger_name: ledger, amount: '25000.00', dr_cr: 'CR', quantity: qty, rate }),
      makeLine({ voucher_draft_id: id, line_no: 3, ledger_name: 'Short Term Capital Gain', amount: '1000.00', dr_cr: 'CR' }),
    ],
  };
}

/** Build an investor-mode JOURNAL sell voucher (matches new buildSellVoucher output). */
function makeInvestorJournalSellVoucher(opts: {
  date?: string;
  ledger?: string;
  qty?: string;
  rate?: string;
  costBasis?: string;
  netProceeds?: string;
  sttAmount?: string;
  gainAmount?: string;
  voucherId?: string;
}): BuiltVoucherDraft {
  const {
    date = '2024-06-15',
    ledger = 'Investment in Equity Shares - RELIANCE',
    qty = '-10',
    rate = '2500.00',
    costBasis = '25000.00',
    netProceeds = '25975.59',
    sttAmount = '25.00',
    gainAmount = '1000.59',
    voucherId = crypto.randomUUID(),
  } = opts;
  return {
    voucher_draft_id: voucherId,
    import_batch_id: 'batch-1',
    voucher_type: VoucherType.JOURNAL,
    voucher_date: date,
    external_reference: 'T002',
    narrative: `Sale of RELIANCE @ ${rate} × ${qty} units | STT ${sttAmount} (non-deductible)`,
    total_debit: (parseFloat(netProceeds) + parseFloat(sttAmount)).toFixed(2),
    total_credit: (parseFloat(costBasis) + parseFloat(gainAmount)).toFixed(2),
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [crypto.randomUUID()],
    created_at: new Date().toISOString(),
    lines: [
      makeLine({ voucher_draft_id: voucherId, line_no: 1, ledger_name: 'Zerodha Kite', amount: netProceeds, dr_cr: 'DR' }),
      makeLine({ voucher_draft_id: voucherId, line_no: 2, ledger_name: 'Securities Transaction Tax', amount: sttAmount, dr_cr: 'DR' }),
      makeLine({ voucher_draft_id: voucherId, line_no: 3, ledger_name: ledger, amount: costBasis, dr_cr: 'CR', quantity: qty, rate, security_id: 'NSE:RELIANCE' }),
      makeLine({ voucher_draft_id: voucherId, line_no: 4, ledger_name: 'Short Term Capital Gain on Sale of Shares - RELIANCE', amount: gainAmount, dr_cr: 'CR' }),
    ],
  };
}

/** Build an investor-mode JOURNAL buy voucher (matches new buildBuyVoucher output). */
function makeInvestorJournalBuyVoucher(opts: {
  date?: string;
  ledger?: string;
  qty?: string;
  rate?: string;
  capitalizedAmount?: string;
  sttAmount?: string;
  voucherId?: string;
}): BuiltVoucherDraft {
  const {
    date = '2024-06-15',
    ledger = 'Investment in Equity Shares - RELIANCE',
    qty = '10',
    rate = '2502.00',
    capitalizedAmount = '25020.00',
    sttAmount = '2.50',
    voucherId = crypto.randomUUID(),
  } = opts;
  const brokerTotal = (parseFloat(capitalizedAmount) + parseFloat(sttAmount)).toFixed(2);
  return {
    voucher_draft_id: voucherId,
    import_batch_id: 'batch-1',
    voucher_type: VoucherType.JOURNAL,
    voucher_date: date,
    external_reference: 'T001',
    narrative: `Purchase of RELIANCE @ ${rate} × ${qty} units | STT ${sttAmount} (non-deductible)`,
    total_debit: brokerTotal,
    total_credit: brokerTotal,
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [crypto.randomUUID()],
    created_at: new Date().toISOString(),
    lines: [
      makeLine({ voucher_draft_id: voucherId, line_no: 1, ledger_name: ledger, amount: capitalizedAmount, dr_cr: 'DR', quantity: qty, rate, security_id: 'NSE:RELIANCE' }),
      makeLine({ voucher_draft_id: voucherId, line_no: 2, ledger_name: 'Securities Transaction Tax', amount: sttAmount, dr_cr: 'DR' }),
      makeLine({ voucher_draft_id: voucherId, line_no: 3, ledger_name: 'Zerodha Kite', amount: brokerTotal, dr_cr: 'CR' }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('mergeSameRatePurchaseVouchers', () => {
  it('returns a single voucher unchanged', () => {
    const v = makePurchaseVoucher({});
    const result = mergeSameRatePurchaseVouchers([v]);
    expect(result).toHaveLength(1);
    expect(result[0].total_debit).toBe('25000.00');
    expect(result[0].lines).toHaveLength(2);
  });

  it('merges two partial fills with same date, ledger, and rate', () => {
    const v1 = makePurchaseVoucher({ qty: '33', gross: '82500.00', brokerAmount: '82500.00' });
    const v2 = makePurchaseVoucher({ qty: '34', gross: '85000.00', brokerAmount: '85000.00' });

    const result = mergeSameRatePurchaseVouchers([v1, v2]);
    expect(result).toHaveLength(1);

    const merged = result[0];
    // Merged stock DR line: 82500 + 85000 = 167500
    const drLine = merged.lines.find((l) => l.dr_cr === 'DR')!;
    expect(drLine.amount).toBe('167500.00');
    expect(drLine.quantity).toBe('67'); // 33 + 34

    // Merged broker CR line: 82500 + 85000 = 167500
    const crLine = merged.lines.find((l) => l.dr_cr === 'CR')!;
    expect(crLine.amount).toBe('167500.00');

    // Totals reflect merged amounts
    expect(merged.total_debit).toBe('167500.00');
    expect(merged.total_credit).toBe('167500.00');

    // Source event IDs include both
    expect(merged.source_event_ids).toHaveLength(v1.source_event_ids.length + v2.source_event_ids.length);

    // External reference is preserved from the base voucher for contract note numbering
    expect(merged.external_reference).toBe(v1.external_reference);
  });

  it('keeps three fills separate when rates differ', () => {
    const v1 = makePurchaseVoucher({ rate: '2500.00', qty: '10', gross: '25000.00', brokerAmount: '25000.00' });
    const v2 = makePurchaseVoucher({ rate: '2510.00', qty: '10', gross: '25100.00', brokerAmount: '25100.00' });
    const v3 = makePurchaseVoucher({ rate: '2520.00', qty: '10', gross: '25200.00', brokerAmount: '25200.00' });

    const result = mergeSameRatePurchaseVouchers([v1, v2, v3]);
    expect(result).toHaveLength(3);
  });

  it('keeps partial fills separate when they are for different stocks', () => {
    const reliance = makePurchaseVoucher({ ledger: 'Investment in Equity Shares - RELIANCE' });
    const tcs = makePurchaseVoucher({ ledger: 'Investment in Equity Shares - TCS' });

    const result = mergeSameRatePurchaseVouchers([reliance, tcs]);
    expect(result).toHaveLength(2);
  });

  it('keeps partial fills separate when dates differ', () => {
    const v1 = makePurchaseVoucher({ date: '2024-06-15' });
    const v2 = makePurchaseVoucher({ date: '2024-06-16' });

    const result = mergeSameRatePurchaseVouchers([v1, v2]);
    expect(result).toHaveLength(2);
  });

  it('merges SALES vouchers that share (date, scrip, rate)', () => {
    // After Fix 4 (voucher-merger extended to sells), two same-rate sell
    // fills on the same day/scrip collapse into a single voucher. Previously
    // the merger restricted itself to PURCHASE vouchers only.
    const s1 = makeSalesVoucher();
    const s2 = makeSalesVoucher();

    const result = mergeSameRatePurchaseVouchers([s1, s2]);
    expect(result).toHaveLength(1);
    expect(result[0].voucher_type).toBe(VoucherType.SALES);
  });

  it('keeps SALES fills separate when rates differ', () => {
    const s1 = makeSalesVoucher({ rate: '2600.00' });
    const s2 = makeSalesVoucher({ rate: '2610.00' });

    const result = mergeSameRatePurchaseVouchers([s1, s2]);
    expect(result).toHaveLength(2);
  });

  it('does NOT merge a same-date same-rate BUY and SELL (side key prevents collapse)', () => {
    // Critical: a buy and a sell at the same price on the same day are
    // distinct events for cost-basis tracking. They must remain as two
    // separate vouchers even though (date, scrip, rate) match.
    const buy = makePurchaseVoucher({ qty: '10', rate: '2500.00', gross: '25000.00', brokerAmount: '25000.00' });
    const sell = makeSalesVoucher({ rate: '2500.00' });

    const result = mergeSameRatePurchaseVouchers([buy, sell]);
    expect(result).toHaveLength(2);
    expect(result.some((v) => v.voucher_type === VoucherType.PURCHASE)).toBe(true);
    expect(result.some((v) => v.voucher_type === VoucherType.SALES)).toBe(true);
  });

  it('merges both buy and sell groups simultaneously', () => {
    const buy1 = makePurchaseVoucher({ qty: '10', gross: '25000.00', brokerAmount: '25000.00' });
    const buy2 = makePurchaseVoucher({ qty: '10', gross: '25000.00', brokerAmount: '25000.00' });
    const sell1 = makeSalesVoucher({ rate: '2600.00' });
    const sell2 = makeSalesVoucher({ rate: '2600.00' });

    const result = mergeSameRatePurchaseVouchers([buy1, buy2, sell1, sell2]);
    // 1 merged buy + 1 merged sell = 2
    expect(result).toHaveLength(2);

    const purchase = result.find((v) => v.voucher_type === VoucherType.PURCHASE)!;
    expect(purchase.total_debit).toBe('50000.00');

    const sale = result.find((v) => v.voucher_type === VoucherType.SALES)!;
    // Two merged sells at 26000 each → 52000 total debit (broker).
    expect(sale.total_debit).toBe('52000.00');
  });

  it('merges investor-mode JOURNAL sells (narrative-prefix detection)', () => {
    // Investor-mode sells land as JOURNAL vouchers (not SALES) with
    // narrative starting "Sale of ...". The merger must detect them via
    // narrative prefix and merge same-rate fills.
    const s1 = makeInvestorJournalSellVoucher({});
    const s2 = makeInvestorJournalSellVoucher({});

    const result = mergeSameRatePurchaseVouchers([s1, s2]);
    expect(result).toHaveLength(1);

    const merged = result[0];
    expect(merged.voucher_type).toBe(VoucherType.JOURNAL);
    // STT line should be summed across fills (25 + 25 = 50)
    const sttLine = merged.lines.find((l) => l.ledger_name === 'Securities Transaction Tax');
    expect(sttLine?.amount).toBe('50.00');
    // Merged narration reflects the merged total and fills count
    expect(merged.narrative).toContain('Sale of RELIANCE');
    expect(merged.narrative).toContain('[merged 2 fills]');
    expect(merged.narrative).toContain('STT 50.00 (non-deductible)');
  });

  it('merged narration sums every capitalizable charge across source fills (Bug 4)', () => {
    // FY21-22 reviewer: "the narration for merged is not mentioning charges
    // total as in other transaction, while it's adding up the charges. So
    // need to charges total details in narration." This regression test
    // locks in the summed-charge behaviour introduced for Bug 4.
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();
    const makeFill = (id: string): BuiltVoucherDraft => ({
      voucher_draft_id: id,
      import_batch_id: 'batch-1',
      voucher_type: VoucherType.JOURNAL,
      voucher_date: '2021-07-07',
      external_reference: 'CN-1',
      narrative:
        'Purchase of TATAELXSI @ 4244.08 × 25 units | ' +
        'brokerage 20.00, GST 3.60, stamp 0.40, exch 0.10 | ' +
        'STT 2.50 (non-deductible)',
      total_debit: '106127.03',
      total_credit: '106127.03',
      draft_status: VoucherStatus.DRAFT,
      source_event_ids: [crypto.randomUUID()],
      created_at: new Date().toISOString(),
      lines: [
        makeLine({
          voucher_draft_id: id,
          line_no: 1,
          ledger_name: 'Investment in Equity Shares - TATAELXSI',
          amount: '106102.03',
          dr_cr: 'DR',
          quantity: '25',
          rate: '4244.08',
          security_id: 'ISIN:INE670A01012',
        }),
        makeLine({
          voucher_draft_id: id,
          line_no: 2,
          ledger_name: 'Securities Transaction Tax',
          amount: '2.50',
          dr_cr: 'DR',
        }),
        makeLine({
          voucher_draft_id: id,
          line_no: 3,
          ledger_name: 'Zerodha Kite',
          amount: '106127.03',
          dr_cr: 'CR',
        }),
      ],
    });

    const result = mergeSameRatePurchaseVouchers([makeFill(id1), makeFill(id2)]);
    expect(result).toHaveLength(1);
    const merged = result[0];

    // Merged narrative includes summed capitalizable charges AND the STT
    // total (previously only STT was surfaced; brokerage/GST/stamp/exch
    // were lost).
    expect(merged.narrative).toContain('brokerage 40.00');
    expect(merged.narrative).toContain('GST 7.20');
    expect(merged.narrative).toContain('stamp 0.80');
    expect(merged.narrative).toContain('exch 0.20');
    expect(merged.narrative).toContain('STT 5.00 (non-deductible)');
    expect(merged.narrative).toContain('[merged 2 fills]');
  });

  it('merges investor-mode JOURNAL buys (narrative-prefix detection)', () => {
    const b1 = makeInvestorJournalBuyVoucher({});
    const b2 = makeInvestorJournalBuyVoucher({});

    const result = mergeSameRatePurchaseVouchers([b1, b2]);
    expect(result).toHaveLength(1);

    const merged = result[0];
    expect(merged.voucher_type).toBe(VoucherType.JOURNAL);
    const assetLine = merged.lines.find((l) => l.ledger_name.includes('Investment'));
    expect(assetLine?.amount).toBe('50040.00'); // 25020 + 25020
    expect(assetLine?.quantity).toBe('20'); // 10 + 10
    const sttLine = merged.lines.find((l) => l.ledger_name === 'Securities Transaction Tax');
    expect(sttLine?.amount).toBe('5.00');
    expect(merged.narrative).toContain('Purchase of RELIANCE');
    expect(merged.narrative).toContain('[merged 2 fills]');
  });

  it('does NOT merge a JOURNAL buy and JOURNAL sell on the same date/rate', () => {
    const buy = makeInvestorJournalBuyVoucher({ rate: '2500.00' });
    const sell = makeInvestorJournalSellVoucher({ rate: '2500.00' });

    const result = mergeSameRatePurchaseVouchers([buy, sell]);
    expect(result).toHaveLength(2);
    // Each voucher keeps its original narrative prefix
    expect(result.find((v) => v.narrative?.startsWith('Purchase of'))).toBeDefined();
    expect(result.find((v) => v.narrative?.startsWith('Sale of'))).toBeDefined();
  });

  it('merges charge DR lines of the same type when present', () => {
    // Buy vouchers with expensed charges (DR stock gross + DR STT + CR broker)
    const makeWithCharge = (qty: string, gross: string, stt: string) => {
      const id = crypto.randomUUID();
      const combined = (parseFloat(gross) + parseFloat(stt)).toFixed(2);
      return {
        voucher_draft_id: id,
        import_batch_id: 'batch-1',
        voucher_type: VoucherType.PURCHASE,
        voucher_date: '2024-06-15',
        external_reference: null,
        narrative: null,
        total_debit: combined,
        total_credit: combined,
        draft_status: VoucherStatus.DRAFT,
        source_event_ids: [crypto.randomUUID()],
        created_at: new Date().toISOString(),
        lines: [
          makeLine({ voucher_draft_id: id, line_no: 1, ledger_name: 'Investment in Equity Shares - RELIANCE', amount: gross, dr_cr: 'DR', quantity: qty, rate: '2500.00', security_id: 'NSE:RELIANCE' }),
          makeLine({ voucher_draft_id: id, line_no: 2, ledger_name: 'Securities Transaction Tax', amount: stt, dr_cr: 'DR' }),
          makeLine({ voucher_draft_id: id, line_no: 3, ledger_name: 'Zerodha Kite', amount: combined, dr_cr: 'CR' }),
        ],
      } satisfies BuiltVoucherDraft;
    };

    const v1 = makeWithCharge('10', '25000.00', '25.00');
    const v2 = makeWithCharge('10', '25000.00', '25.00');

    const result = mergeSameRatePurchaseVouchers([v1, v2]);
    expect(result).toHaveLength(1);

    const merged = result[0];
    expect(merged.lines).toHaveLength(3);

    const sttLine = merged.lines.find((l) => l.ledger_name === 'Securities Transaction Tax')!;
    expect(sttLine.amount).toBe('50.00'); // 25 + 25

    const stockLine = merged.lines.find((l) => l.ledger_name.includes('RELIANCE'))!;
    expect(stockLine.amount).toBe('50000.00');
    expect(stockLine.quantity).toBe('20');
  });

  it('output is sorted by voucher_date', () => {
    const v1 = makePurchaseVoucher({ date: '2024-06-17' });
    const v2 = makePurchaseVoucher({ date: '2024-06-15', ledger: 'Investment in Equity Shares - TCS' });
    const v3 = makeSalesVoucher('2024-06-16');

    const result = mergeSameRatePurchaseVouchers([v1, v2, v3]);
    expect(result.map((v) => v.voucher_date)).toEqual(['2024-06-15', '2024-06-16', '2024-06-17']);
  });
});

describe('mergeDailySummaryPurchaseVouchers', () => {
  it('merges same-day same-scrip purchases across different rates using weighted average', () => {
    const v1 = makePurchaseVoucher({ qty: '10', rate: '100.00', gross: '1000.00', brokerAmount: '1000.00' });
    const v2 = makePurchaseVoucher({ qty: '20', rate: '110.00', gross: '2200.00', brokerAmount: '2200.00' });

    const result = mergeDailySummaryPurchaseVouchers([v1, v2]);
    expect(result).toHaveLength(1);

    const merged = result[0];
    const stockLine = merged.lines.find((l) => l.dr_cr === 'DR' && l.quantity !== null)!;

    expect(stockLine.quantity).toBe('30');
    expect(stockLine.amount).toBe('3200.00');
    expect(stockLine.rate).toBe('106.67');
    expect(merged.narrative).toContain('[merged 2 trades]');
  });

  it('keeps same-day purchases separate when stocks differ', () => {
    const reliance = makePurchaseVoucher({ ledger: 'Investment in Equity Shares - RELIANCE', rate: '100.00', gross: '1000.00' });
    const tcs = makePurchaseVoucher({ ledger: 'Investment in Equity Shares - TCS', rate: '110.00', gross: '1100.00' });

    const result = mergeDailySummaryPurchaseVouchers([reliance, tcs]);
    expect(result).toHaveLength(2);
  });
});

describe('mergePurchaseVouchers', () => {
  it('dispatches to same_rate mode by default', () => {
    const v1 = makePurchaseVoucher({ qty: '5', gross: '500.00', brokerAmount: '500.00', rate: '100.00' });
    const v2 = makePurchaseVoucher({ qty: '5', gross: '500.00', brokerAmount: '500.00', rate: '100.00' });

    const result = mergePurchaseVouchers([v1, v2]);
    expect(result).toHaveLength(1);
    expect(result[0].lines.find((line) => line.quantity !== null)?.rate).toBe('100.00');
  });
});

// ---------------------------------------------------------------------------
// disambiguateVoucherNumbers
// ---------------------------------------------------------------------------

describe('disambiguateVoucherNumbers', () => {
  it('passes through vouchers with unique external_reference unchanged', () => {
    const v1 = makePurchaseVoucher({});
    v1.external_reference = 'CNT-24/25-1/RELIANCE';
    const v2 = makePurchaseVoucher({});
    v2.external_reference = 'CNT-24/25-1/INFY';
    const result = disambiguateVoucherNumbers([v1, v2]);
    expect(result[0].external_reference).toBe('CNT-24/25-1/RELIANCE');
    expect(result[1].external_reference).toBe('CNT-24/25-1/INFY');
  });

  it('appends -2, -3 suffixes to duplicates within the same voucher type', () => {
    // Multi-rate fills of the same security on the same CN: same external_reference
    // (CN/symbol) but different rates → didn't merge → would collide on Tally import.
    const v1 = makePurchaseVoucher({});
    v1.external_reference = 'CNT-24/25-1/RELIANCE';
    const v2 = makePurchaseVoucher({});
    v2.external_reference = 'CNT-24/25-1/RELIANCE';
    const v3 = makePurchaseVoucher({});
    v3.external_reference = 'CNT-24/25-1/RELIANCE';
    const result = disambiguateVoucherNumbers([v1, v2, v3]);
    expect(result[0].external_reference).toBe('CNT-24/25-1/RELIANCE');
    expect(result[1].external_reference).toBe('CNT-24/25-1/RELIANCE-2');
    expect(result[2].external_reference).toBe('CNT-24/25-1/RELIANCE-3');
  });

  it('namespaces duplicates per voucher type — Purchase and Sales with same number do NOT collide', () => {
    // Tally allows duplicate voucher numbers across different voucher types.
    // A Purchase and a Sales voucher with the same number is fine.
    const buy = makePurchaseVoucher({});
    buy.external_reference = 'CNT-24/25-1/RELIANCE';
    const sell = makeSalesVoucher();
    sell.external_reference = 'CNT-24/25-1/RELIANCE';
    const result = disambiguateVoucherNumbers([buy, sell]);
    expect(result[0].external_reference).toBe('CNT-24/25-1/RELIANCE');
    expect(result[1].external_reference).toBe('CNT-24/25-1/RELIANCE');
  });

  it('passes through vouchers with null external_reference', () => {
    const v = makeSalesVoucher();
    v.external_reference = null;
    const result = disambiguateVoucherNumbers([v]);
    expect(result[0].external_reference).toBeNull();
  });

  it('is deterministic — same input order produces same suffix assignments on repeated runs', () => {
    const make = () => {
      const a = makePurchaseVoucher({});
      a.external_reference = 'CN-1/HDFC';
      const b = makePurchaseVoucher({});
      b.external_reference = 'CN-1/HDFC';
      return [a, b];
    };
    const run1 = disambiguateVoucherNumbers(make());
    const run2 = disambiguateVoucherNumbers(make());
    expect(run1.map((v) => v.external_reference)).toEqual(run2.map((v) => v.external_reference));
  });
});
