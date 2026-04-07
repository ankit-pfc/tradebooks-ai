/**
 * Regression tests for generateVouchersXml — specifically the OBJVIEW /
 * ISINVOICE branching that depends on voucher_type. Investor-mode Journal
 * vouchers must use Accounting Voucher View (Tally rejects Invoice view on
 * Journals); trader-mode Purchase/Sales vouchers with stock lines must use
 * Invoice Voucher View + ISINVOICE=Yes (Tally otherwise skips the inventory
 * allocations on import).
 */

import { describe, it, expect } from 'vitest';
import { generateVouchersXml, type VoucherDraftWithLines } from '../tally-xml';
import { VoucherStatus, VoucherType } from '../../types/vouchers';

function makeVoucher(
  voucher_type: VoucherType,
  withStockLine: boolean,
): VoucherDraftWithLines {
  const lines: VoucherDraftWithLines['lines'] = [
    {
      voucher_line_id: 'l-party',
      voucher_draft_id: 'v1',
      line_no: 1,
      ledger_name: 'Zerodha Broker',
      amount: '10000',
      dr_cr: 'CR',
      security_id: null,
      quantity: null,
      rate: null,
      stock_item_name: null,
      cost_center: null,
      bill_ref: null,
    },
    withStockLine
      ? {
          voucher_line_id: 'l-stock',
          voucher_draft_id: 'v1',
          line_no: 2,
          ledger_name: 'INFY',
          amount: '10000',
          dr_cr: 'DR',
          security_id: 'sec-1',
          quantity: '10',
          rate: '1000',
          stock_item_name: 'INFY',
          cost_center: null,
          bill_ref: null,
        }
      : {
          voucher_line_id: 'l-cash',
          voucher_draft_id: 'v1',
          line_no: 2,
          ledger_name: 'Capital A/c',
          amount: '10000',
          dr_cr: 'DR',
          security_id: null,
          quantity: null,
          rate: null,
          stock_item_name: null,
          cost_center: null,
          bill_ref: null,
        },
  ];

  return {
    voucher_draft_id: 'v1',
    import_batch_id: 'b1',
    voucher_type,
    voucher_date: '2025-04-01',
    external_reference: 'CN-1',
    narrative: 'test',
    total_debit: '10000',
    total_credit: '10000',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [],
    created_at: '2025-04-01T00:00:00Z',
    lines,
  };
}

describe('generateVouchersXml — OBJVIEW / ISINVOICE branching', () => {
  it('investor-mode Journal voucher with stock lines uses Accounting Voucher View (no ISINVOICE)', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.JOURNAL, true)],
      'Test Co',
    );
    expect(xml).toContain('OBJVIEW="Accounting Voucher View"');
    expect(xml).not.toContain('Invoice Voucher View');
    expect(xml).not.toContain('<ISINVOICE>');
    // Inventory allocations are still emitted on the line.
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
    expect(xml).toContain('<STOCKITEMNAME>INFY</STOCKITEMNAME>');
  });

  it('trader-mode Purchase voucher with stock lines uses Invoice Voucher View + ISINVOICE=Yes', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.PURCHASE, true)],
      'Test Co',
    );
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
  });

  it('trader-mode Sales voucher with stock lines uses Invoice Voucher View + ISINVOICE=Yes', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.SALES, true)],
      'Test Co',
    );
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
  });

  it('trader-mode Purchase voucher without inventory lines stays on Accounting Voucher View', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.PURCHASE, false)],
      'Test Co',
    );
    expect(xml).toContain('OBJVIEW="Accounting Voucher View"');
    expect(xml).not.toContain('Invoice Voucher View');
    expect(xml).not.toContain('<ISINVOICE>');
  });

  it('Journal voucher without inventory lines uses Accounting Voucher View', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.JOURNAL, false)],
      'Test Co',
    );
    expect(xml).toContain('OBJVIEW="Accounting Voucher View"');
    expect(xml).not.toContain('<ISINVOICE>');
  });
});
