import { describe, it, expect } from 'vitest';
import { mergeSameRatePurchaseVouchers } from '../voucher-merger';
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

function makeSalesVoucher(date = '2024-06-15'): BuiltVoucherDraft {
  const id = crypto.randomUUID();
  return {
    voucher_draft_id: id,
    import_batch_id: 'batch-1',
    voucher_type: VoucherType.SALES,
    voucher_date: date,
    external_reference: null,
    narrative: 'Sale',
    total_debit: '26000.00',
    total_credit: '26000.00',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [crypto.randomUUID()],
    created_at: new Date().toISOString(),
    lines: [
      makeLine({ voucher_draft_id: id, line_no: 1, ledger_name: 'Zerodha Kite', amount: '26000.00', dr_cr: 'DR' }),
      makeLine({ voucher_draft_id: id, line_no: 2, ledger_name: 'Investment in Equity Shares - RELIANCE', amount: '25000.00', dr_cr: 'CR', quantity: '-10', rate: '2500.00' }),
      makeLine({ voucher_draft_id: id, line_no: 3, ledger_name: 'Short Term Capital Gain', amount: '1000.00', dr_cr: 'CR' }),
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

    // External reference nulled out (no single trade_no)
    expect(merged.external_reference).toBeNull();
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

  it('does not merge SALES vouchers', () => {
    const s1 = makeSalesVoucher();
    const s2 = makeSalesVoucher();

    const result = mergeSameRatePurchaseVouchers([s1, s2]);
    expect(result).toHaveLength(2);
    expect(result.every((v) => v.voucher_type === VoucherType.SALES)).toBe(true);
  });

  it('preserves SALES vouchers when mixed with PURCHASE vouchers', () => {
    const buy1 = makePurchaseVoucher({ qty: '10', gross: '25000.00', brokerAmount: '25000.00' });
    const buy2 = makePurchaseVoucher({ qty: '10', gross: '25000.00', brokerAmount: '25000.00' });
    const sell = makeSalesVoucher();

    const result = mergeSameRatePurchaseVouchers([buy1, buy2, sell]);
    expect(result).toHaveLength(2); // 1 merged purchase + 1 sale

    const purchase = result.find((v) => v.voucher_type === VoucherType.PURCHASE)!;
    expect(purchase.total_debit).toBe('50000.00');

    const sale = result.find((v) => v.voucher_type === VoucherType.SALES)!;
    expect(sale.total_debit).toBe('26000.00');
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
