/**
 * Regression tests for generateVouchersXml — specifically the OBJVIEW /
 * ISINVOICE branching that depends on voucher_type and trade narrative.
 * Delivery trade drafts are still produced as Journal vouchers by the
 * engine, but the exporter now renders them as Tally-native Purchase/Sales
 * invoices when they carry stock lines and a purchase/sale narrative.
 */

import { describe, it, expect } from 'vitest';
import { generateVouchersXml, type VoucherDraftWithLines } from '../tally-xml';
import { VoucherStatus, VoucherType } from '../../types/vouchers';

function makeVoucher(
  voucher_type: VoucherType,
  withStockLine: boolean,
  narrative = 'test',
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
    narrative,
    total_debit: '10000',
    total_credit: '10000',
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: [],
    created_at: '2025-04-01T00:00:00Z',
    lines,
  };
}

describe('generateVouchersXml — purchase/sales invoice rendering', () => {
  it('renders journal purchase drafts with stock lines as Purchase invoice vouchers', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.JOURNAL, true, 'Purchase of INFY @ 100 × 10 units')],
      'Test Co',
    );
    expect(xml).toContain('VCHTYPE="Purchase"');
    expect(xml).toContain('<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
    expect(xml).toContain('<PARTYLEDGERNAME>Zerodha Broker</PARTYLEDGERNAME>');
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
  });

  it('renders journal sales drafts with stock lines as Sales invoice vouchers', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.JOURNAL, true, 'Sale of INFY @ 100 × 10 units')],
      'Test Co',
    );
    expect(xml).toContain('VCHTYPE="Sales"');
    expect(xml).toContain('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
    expect(xml).toContain('<PARTYLEDGERNAME>Zerodha Broker</PARTYLEDGERNAME>');
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
  });

  it('renders explicit purchase vouchers with stock lines as invoice vouchers', () => {
    const xml = generateVouchersXml([makeVoucher(VoucherType.PURCHASE, true)], 'Test Co');
    expect(xml).toContain('VCHTYPE="Purchase"');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
  });

  it('renders explicit sales vouchers with stock lines as invoice vouchers', () => {
    const xml = generateVouchersXml([makeVoucher(VoucherType.SALES, true)], 'Test Co');
    expect(xml).toContain('VCHTYPE="Sales"');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
  });

  it('keeps non-trade journals on Accounting Voucher View', () => {
    const xml = generateVouchersXml([makeVoucher(VoucherType.JOURNAL, true, 'test')], 'Test Co');
    expect(xml).toContain('VCHTYPE="Journal"');
    expect(xml).toContain('OBJVIEW="Accounting Voucher View"');
    expect(xml).not.toContain('<ISINVOICE>');
  });

  it('keeps vouchers without inventory on Accounting Voucher View', () => {
    for (const type of [VoucherType.JOURNAL, VoucherType.PURCHASE, VoucherType.SALES]) {
      const xml = generateVouchersXml([makeVoucher(type, false)], 'Test Co');
      expect(xml).toContain('OBJVIEW="Accounting Voucher View"');
      expect(xml).not.toContain('Invoice Voucher View');
      expect(xml).not.toContain('<ISINVOICE>');
    }
  });
});
