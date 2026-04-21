/**
 * Regression tests for generateVouchersXml — specifically the OBJVIEW /
 * ISINVOICE branching that depends on voucher_type and invoice_intent.
 *
 * Investor-mode trade vouchers are produced as Journal with
 * invoice_intent=NONE, so in the investor pipeline these rendering paths
 * are only reachable from trader mode (which still tags trades with a
 * Purchase/Sales intent) or from explicit VoucherType.PURCHASE/SALES
 * callers. These tests exercise the serializer's raw branching capability
 * by passing InvoiceIntent explicitly.
 */

import { describe, it, expect } from 'vitest';
import { generateVouchersXml, type VoucherDraftWithLines } from '../tally-xml';
import { InvoiceIntent, VoucherStatus, VoucherType } from '../../types/vouchers';
import { buildBuyVoucher, buildSellVoucher } from '../../engine/voucher-builder';
import { INVESTOR_DEFAULT } from '../../engine/accounting-policy';
import { makeBuyEvent, makeSellEvent } from '../../../tests/helpers/factories';

function makeVoucher(
  voucher_type: VoucherType,
  withStockLine: boolean,
  narrative = 'test',
  invoiceIntent: InvoiceIntent = InvoiceIntent.NONE,
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
    invoice_intent: invoiceIntent,
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
      [makeVoucher(VoucherType.JOURNAL, true, 'renamed narrative', InvoiceIntent.PURCHASE)],
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
      [makeVoucher(VoucherType.JOURNAL, true, 'renamed narrative', InvoiceIntent.SALES)],
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
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.PURCHASE, true, 'anything', InvoiceIntent.PURCHASE)],
      'Test Co',
    );
    expect(xml).toContain('VCHTYPE="Purchase"');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
  });

  it('renders explicit sales vouchers with stock lines as invoice vouchers', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.SALES, true, 'anything', InvoiceIntent.SALES)],
      'Test Co',
    );
    expect(xml).toContain('VCHTYPE="Sales"');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
    expect(xml).toContain('<ISINVOICE>Yes</ISINVOICE>');
  });

  it('does not let narrative text control invoice rendering', () => {
    const xml = generateVouchersXml(
      [makeVoucher(VoucherType.JOURNAL, true, 'completely unrelated text', InvoiceIntent.PURCHASE)],
      'Test Co',
    );
    expect(xml).toContain('VCHTYPE="Purchase"');
    expect(xml).toContain('OBJVIEW="Invoice Voucher View"');
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

describe('generateVouchersXml — investor pipeline emits JV only', () => {
  // End-to-end load-bearing test: build real investor-mode buy and sell
  // vouchers via the engine, serialize them, and confirm the Tally XML
  // lands them in the Journal register — never Sales/Purchase — while
  // still carrying inventory allocations for stock movement.
  it('investor buy + sell vouchers serialize as Journal with INVENTORYALLOCATIONS intact', () => {
    const buyEvent = makeBuyEvent({
      quantity: '10',
      rate: '2500.00',
      gross_amount: '25000.00',
      trade_product: 'CNC',
    });
    const buyVoucher = buildBuyVoucher(buyEvent, INVESTOR_DEFAULT, []);

    const sellEvent = makeSellEvent({
      quantity: '-10',
      rate: '2600.00',
      gross_amount: '26000.00',
      trade_product: 'CNC',
    });
    const costDisposals = [
      {
        lot_id: 'lot-1',
        acquisition_date: '2024-06-01',
        quantity_sold: '10',
        unit_cost: '2500.000000',
        total_cost: '25000.00',
        gain_or_loss: '1000.00',
      },
    ];
    const sellVoucher = buildSellVoucher(
      sellEvent,
      INVESTOR_DEFAULT,
      [],
      costDisposals,
      100,
    );

    // Contract: investor trade vouchers carry no invoice intent.
    expect(buyVoucher.invoice_intent).toBe(InvoiceIntent.NONE);
    expect(sellVoucher.invoice_intent).toBe(InvoiceIntent.NONE);

    const xml = generateVouchersXml(
      [buyVoucher, sellVoucher] as unknown as VoucherDraftWithLines[],
      'Test Co',
    );

    // Must land in Journal register.
    expect(xml).toContain('VCHTYPE="Journal"');
    expect(xml).toContain('<VOUCHERTYPENAME>Journal</VOUCHERTYPENAME>');
    expect(xml).toContain('OBJVIEW="Accounting Voucher View"');
    expect(xml).toContain('<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>');

    // Must NOT land in Sales/Purchase register.
    expect(xml).not.toContain('VCHTYPE="Sales"');
    expect(xml).not.toContain('VCHTYPE="Purchase"');
    expect(xml).not.toContain('<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>');
    expect(xml).not.toContain('<VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>');
    expect(xml).not.toContain('Invoice Voucher View');
    expect(xml).not.toContain('<ISINVOICE>');

    // Stock movement must still be carried via inventory allocations.
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
    expect(xml).toContain('<ACTUALQTY>');
    expect(xml).toContain('<BILLEDQTY>');
  });
});

// ---------------------------------------------------------------------------
// Bug 1 + Bug 2 regressions — Tally XML masters / voucher side.
// ---------------------------------------------------------------------------
describe('tally-xml masters regressions', () => {
  it('Bug 1: UNIT master is emitted as ACTION=Create with NOS symbol and NUMBERS formal name', async () => {
    const { generateMastersXml } = await import('../tally-xml');
    const xml = generateMastersXml(
      [{ name: 'RELIANCE-SH', parent_group: 'Investments', affects_stock: true }],
      'Test Co',
      undefined,
      [{ name: 'RELIANCE-SH', baseUnit: 'NOS' }],
    );

    // The Tally unit for quantities should be NOS/NUMBERS, while stock item
    // names continue to use the "-SH" suffix. ACTION=Create with a non-empty
    // ORIGINALNAME matches the checked-in export shape.
    expect(xml).toContain('<UNIT NAME="NOS" RESERVEDNAME="" ACTION="Create">');
    expect(xml).toMatch(
      /<UNIT NAME="NOS" RESERVEDNAME="" ACTION="Create">[\s\S]*?<NAME>NOS<\/NAME>[\s\S]*?<NAME\.LIST>[\s\S]*?<NAME>NOS<\/NAME>/,
    );
    expect(xml).toContain('<ORIGINALNAME>NOS</ORIGINALNAME>');
    expect(xml).not.toContain('<ORIGINALNAME/>');
    expect(xml).toContain('<FORMALNAME>NUMBERS</FORMALNAME>');
    expect(xml).not.toMatch(/<FORMALNAME>\s*<\/FORMALNAME>/);
  });

  it('Bug 2: masters XML alters the Journal voucher type to Manual numbering', async () => {
    const { generateMastersXml } = await import('../tally-xml');
    const xml = generateMastersXml([], 'Test Co', undefined, []);

    // Journal voucher type must get NUMBERINGMETHOD=Manual so that the
    // VOUCHERNUMBER carried in voucher XML (= contract note reference)
    // survives the Tally import instead of being auto-renumbered 1..N.
    expect(xml).toMatch(
      /<VOUCHERTYPE NAME="Journal"[^>]*ACTION="Alter"[^>]*>[\s\S]*?<NUMBERINGMETHOD>Manual<\/NUMBERINGMETHOD>/,
    );

    // Only Journal should be altered — other built-in voucher types (Receipt,
    // Payment, Contra, Sales, Purchase) must NOT be mutated, as that would
    // change the user's Tally company-wide settings for unrelated voucher types.
    for (const vchType of ['Receipt', 'Payment', 'Contra', 'Sales', 'Purchase']) {
      expect(xml).not.toContain(`VOUCHERTYPE NAME="${vchType}"`);
    }
  });
});

describe('tally-xml voucher reference regressions (Bug 2)', () => {
  it('emits REFERENCE + REFERENCEDATE for any voucher with an external_reference', () => {
    const voucher: VoucherDraftWithLines = {
      voucher_draft_id: 'v1',
      import_batch_id: 'b1',
      voucher_type: VoucherType.JOURNAL,
      invoice_intent: InvoiceIntent.NONE,
      voucher_date: '2024-06-15',
      external_reference: 'CN-42',
      narrative: 'test',
      total_debit: '1000.00',
      total_credit: '1000.00',
      draft_status: VoucherStatus.DRAFT,
      source_event_ids: ['e1'],
      created_at: new Date().toISOString(),
      lines: [
        {
          voucher_line_id: 'l1', voucher_draft_id: 'v1', line_no: 1,
          ledger_name: 'Zerodha Broker', amount: '1000.00', dr_cr: 'DR',
          security_id: null, quantity: null, rate: null,
          stock_item_name: null, cost_center: null, bill_ref: null,
        },
        {
          voucher_line_id: 'l2', voucher_draft_id: 'v1', line_no: 2,
          ledger_name: 'Bank Account', amount: '1000.00', dr_cr: 'CR',
          security_id: null, quantity: null, rate: null,
          stock_item_name: null, cost_center: null, bill_ref: null,
        },
      ],
    };

    const xml = generateVouchersXml([voucher], 'Test Co');
    // VOUCHERNUMBER preserved (existing behaviour).
    expect(xml).toContain('<VOUCHERNUMBER>CN-42</VOUCHERNUMBER>');
    // New: REFERENCE populates the Tally "Ref" column, visible in Daybook.
    expect(xml).toContain('<REFERENCE>CN-42</REFERENCE>');
    expect(xml).toContain('<REFERENCEDATE>20240615</REFERENCEDATE>');
  });
});
