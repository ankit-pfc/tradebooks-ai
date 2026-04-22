import { describe, expect, it } from 'vitest';
import {
  generateVouchersXml,
  generateFullExport,
  tallyAmount,
  tallyQty,
  tallyRate,
  type VoucherDraftWithLines,
} from '../../lib/export/tally-xml';
import { InvoiceIntent, VoucherType } from '../../lib/types/vouchers';
import { makeVoucherDraft, makeVoucherLine } from '../helpers/factories';

function makeVoucherWithLines(
  overrides: Partial<VoucherDraftWithLines> = {},
): VoucherDraftWithLines {
  const draftId = overrides.voucher_draft_id ?? 'v-1';
  return {
    ...makeVoucherDraft({ voucher_draft_id: draftId }),
    lines: overrides.lines ?? [
      makeVoucherLine({ voucher_draft_id: draftId, line_no: 1, ledger_name: 'Bank Account', amount: '25000.00', dr_cr: 'DR' }),
      makeVoucherLine({ voucher_draft_id: draftId, line_no: 2, ledger_name: 'Zerodha Broking', amount: '25000.00', dr_cr: 'CR' }),
    ],
    ...overrides,
  };
}

describe('generateVouchersXml', () => {
  it('produces valid XML with ENVELOPE structure', () => {
    const xml = generateVouchersXml([makeVoucherWithLines()], 'Test Co');
    expect(xml).toContain('<ENVELOPE');
    expect(xml).toContain('<HEADER');
    expect(xml).toContain('<VERSION>1</VERSION>');
    expect(xml).toContain('<TALLYREQUEST>Import</TALLYREQUEST>');
    expect(xml).toContain('<TYPE>Data</TYPE>');
    expect(xml).toContain('<ID>Vouchers</ID>');
    expect(xml).toContain('<BODY');
    expect(xml).toContain('<DATA');
    expect(xml).toContain('<SVCURRENTCOMPANY>Test Co</SVCURRENTCOMPANY>');
  });

  it('converts date YYYY-MM-DD to YYYYMMDD', () => {
    const voucher = makeVoucherWithLines({ voucher_date: '2024-06-15' });
    const xml = generateVouchersXml([voucher], 'Test Co');
    expect(xml).toContain('<DATE>20240615</DATE>');
  });

  it('debit amounts are negative with ISDEEMEDPOSITIVE=Yes', () => {
    const voucher = makeVoucherWithLines({
      lines: [
        makeVoucherLine({ line_no: 1, ledger_name: 'Bank', amount: '25000.00', dr_cr: 'DR' }),
        makeVoucherLine({ line_no: 2, ledger_name: 'Broker', amount: '25000.00', dr_cr: 'CR' }),
      ],
    });
    const xml = generateVouchersXml([voucher], 'Test Co');
    // DR line should have negative amount and Yes
    expect(xml).toContain('<ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>');
    expect(xml).toContain('<AMOUNT>-25000.00</AMOUNT>');
  });

  it('credit amounts are positive with ISDEEMEDPOSITIVE=No', () => {
    const voucher = makeVoucherWithLines({
      lines: [
        makeVoucherLine({ line_no: 1, ledger_name: 'Bank', amount: '25000.00', dr_cr: 'DR' }),
        makeVoucherLine({ line_no: 2, ledger_name: 'Broker', amount: '25000.00', dr_cr: 'CR' }),
      ],
    });
    const xml = generateVouchersXml([voucher], 'Test Co');
    expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    // CR line has positive amount
    expect(xml).toContain('<AMOUNT>25000.00</AMOUNT>');
  });

  it('maps all VoucherType values to Tally strings', () => {
    const types: Array<{ type: VoucherType; expected: string }> = [
      { type: VoucherType.JOURNAL, expected: 'Journal' },
      { type: VoucherType.PURCHASE, expected: 'Purchase' },
      { type: VoucherType.SALES, expected: 'Sales' },
      { type: VoucherType.RECEIPT, expected: 'Receipt' },
      { type: VoucherType.PAYMENT, expected: 'Payment' },
      { type: VoucherType.CONTRA, expected: 'Contra' },
    ];
    for (const { type, expected } of types) {
      const voucher = makeVoucherWithLines({ voucher_type: type });
      const xml = generateVouchersXml([voucher], 'Co');
      expect(xml).toContain(`VCHTYPE="${expected}"`);
      expect(xml).toContain(`<VOUCHERTYPENAME>${expected}</VOUCHERTYPENAME>`);
    }
  });

  it('sorts lines by line_no', () => {
    const voucher = makeVoucherWithLines({
      lines: [
        makeVoucherLine({ line_no: 2, ledger_name: 'Second', amount: '5000.00', dr_cr: 'CR' }),
        makeVoucherLine({ line_no: 1, ledger_name: 'First', amount: '5000.00', dr_cr: 'DR' }),
      ],
    });
    const xml = generateVouchersXml([voucher], 'Co');
    const firstIdx = xml.indexOf('First');
    const secondIdx = xml.indexOf('Second');
    expect(firstIdx).toBeLessThan(secondIdx);
  });

  it('includes NARRATION and VOUCHERNUMBER when present', () => {
    const voucher = makeVoucherWithLines({
      narrative: 'Test narration text',
      external_reference: 'REF-001',
    });
    const xml = generateVouchersXml([voucher], 'Co');
    expect(xml).toContain('<NARRATION>Test narration text</NARRATION>');
    expect(xml).toContain('<VOUCHERNUMBER>REF-001</VOUCHERNUMBER>');
  });

  it('emits purchase inventory entries nested under LEDGERENTRIES.LIST with signed quantity', () => {
    const voucher = makeVoucherWithLines({
      voucher_type: VoucherType.PURCHASE,
      lines: [
        makeVoucherLine({
          line_no: 1,
          ledger_name: 'RELIANCE-SH',
          amount: '25000.00',
          dr_cr: 'DR',
          quantity: '10',
          rate: '2500',
        }),
        makeVoucherLine({ line_no: 2, ledger_name: 'Broker', amount: '25000.00', dr_cr: 'CR' }),
      ],
    });
    const xml = generateVouchersXml([voucher], 'Co');
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
    expect(xml).toContain('<STOCKITEMNAME>RELIANCE-SH</STOCKITEMNAME>');
    expect(xml).toContain('ACTUALQTY');
    expect(xml).toContain('BILLEDQTY');
    expect(xml).toContain('10 SH');
    expect(xml).toContain('/SH');
  });

  it('emits sales inventory entries nested under LEDGERENTRIES.LIST with negative quantity', () => {
    const voucher = makeVoucherWithLines({
      voucher_type: VoucherType.SALES,
      lines: [
        makeVoucherLine({
          line_no: 1,
          ledger_name: 'Broker',
          amount: '26000.00',
          dr_cr: 'DR',
        }),
        makeVoucherLine({
          line_no: 2,
          ledger_name: 'RELIANCE-SH',
          amount: '25000.00',
          dr_cr: 'CR',
          quantity: '-10',
          rate: '2500',
        }),
        makeVoucherLine({
          line_no: 3,
          ledger_name: 'STCG on RELIANCE',
          amount: '1000.00',
          dr_cr: 'CR',
        }),
      ],
    });
    const xml = generateVouchersXml([voucher], 'Co');
    expect(xml).toContain('<INVENTORYALLOCATIONS.LIST>');
    expect(xml).toContain('<ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>');
    // ACTUALQTY/BILLEDQTY are always absolute — stock-out direction comes
    // from the parent ledger's CR, not from a negative qty. Tally double-
    // negates negative CR quantities and INCREASES holdings on sale.
    expect(xml).toContain('10 SH');  // qty with UOM (always positive)
    expect(xml).not.toMatch(/<(ACTUALQTY|BILLEDQTY)>-/);
  });

  it('handles empty vouchers array', () => {
    const xml = generateVouchersXml([], 'Co');
    expect(xml).toContain('<DATA/>');
  });
});

describe('Tally numeric formatting guards', () => {
  it('throws when a corrupt amount reaches serialization', () => {
    expect(() => tallyAmount('abc', 'DR')).toThrow('Invalid Tally amount');
  });

  it('throws when a corrupt quantity reaches serialization', () => {
    expect(() => tallyQty('', 'DR')).toThrow('Invalid Tally quantity');
  });

  it('throws when a corrupt rate reaches serialization', () => {
    expect(() => tallyRate('Infinity', 'SH')).toThrow('Invalid Tally rate');
  });

  it('keeps normal numeric formatting unchanged', () => {
    expect(tallyAmount('25000', 'DR')).toBe('-25000.00');
    expect(tallyAmount('25000', 'CR')).toBe('25000.00');
    expect(tallyQty('-10', 'CR')).toBe('10 SH');
    expect(tallyRate('2500', 'SH')).toBe('2500.00/SH');
  });
});

describe('generateFullExport', () => {
  it('returns both mastersXml and transactionsXml', () => {
    const result = generateFullExport(
      [makeVoucherWithLines()],
      [{ name: 'Bank Account', parent_group: 'Bank Accounts' }],
      'Test Co',
    );
    expect(result.mastersXml).toContain('All Masters');
    expect(result.mastersXml).toContain('Bank Account');
    expect(result.transactionsXml).toContain('Vouchers');
    expect(result.transactionsXml).toContain('LEDGERENTRIES.LIST');
  });

  it('sets manual numbering and duplicate prevention for emitted Tally voucher types', () => {
    const purchaseVoucher = makeVoucherWithLines({
      voucher_draft_id: 'v-purchase',
      voucher_type: VoucherType.JOURNAL,
      invoice_intent: InvoiceIntent.PURCHASE,
      lines: [
        makeVoucherLine({
          voucher_draft_id: 'v-purchase',
          line_no: 1,
          ledger_name: 'Zerodha Broker',
          amount: '25000.00',
          dr_cr: 'CR',
        }),
        makeVoucherLine({
          voucher_draft_id: 'v-purchase',
          line_no: 2,
          ledger_name: 'RELIANCE-SH',
          amount: '25000.00',
          dr_cr: 'DR',
          quantity: '10',
          rate: '2500',
          stock_item_name: 'RELIANCE-SH',
        }),
      ],
    });

    const receiptVoucher = makeVoucherWithLines({
      voucher_draft_id: 'v-receipt',
      voucher_type: VoucherType.RECEIPT,
      invoice_intent: InvoiceIntent.NONE,
      lines: [
        makeVoucherLine({
          voucher_draft_id: 'v-receipt',
          line_no: 1,
          ledger_name: 'Bank Account',
          amount: '1000.00',
          dr_cr: 'DR',
        }),
        makeVoucherLine({
          voucher_draft_id: 'v-receipt',
          line_no: 2,
          ledger_name: 'Dividend Income',
          amount: '1000.00',
          dr_cr: 'CR',
        }),
      ],
    });

    const result = generateFullExport(
      [purchaseVoucher, receiptVoucher],
      [{ name: 'Bank Account', parent_group: 'Bank Accounts' }],
      'Test Co',
    );

    expect(result.mastersXml).toMatch(
      /<VOUCHERTYPE NAME="Journal"[^>]*>[\s\S]*?<NUMBERINGMETHOD>Manual<\/NUMBERINGMETHOD>/,
    );
    expect(result.mastersXml).toMatch(
      /<VOUCHERTYPE NAME="Journal"[^>]*>[\s\S]*?<PREVENTDUPLICATES>Yes<\/PREVENTDUPLICATES>/,
    );
    expect(result.mastersXml).toMatch(
      /<VOUCHERTYPE NAME="Purchase"[^>]*>[\s\S]*?<NUMBERINGMETHOD>Manual<\/NUMBERINGMETHOD>/,
    );
    expect(result.mastersXml).toMatch(
      /<VOUCHERTYPE NAME="Purchase"[^>]*>[\s\S]*?<PREVENTDUPLICATES>Yes<\/PREVENTDUPLICATES>/,
    );
    expect(result.mastersXml).toMatch(
      /<VOUCHERTYPE NAME="Receipt"[^>]*>[\s\S]*?<NUMBERINGMETHOD>Manual<\/NUMBERINGMETHOD>/,
    );
    expect(result.mastersXml).toMatch(
      /<VOUCHERTYPE NAME="Receipt"[^>]*>[\s\S]*?<PREVENTDUPLICATES>Yes<\/PREVENTDUPLICATES>/,
    );
    expect(result.mastersXml).not.toContain('<VOUCHERTYPE NAME="Payment"');
  });
});
