import { describe, expect, it } from 'vitest';
import {
  generateVouchersXml,
  generateFullExport,
  type VoucherDraftWithLines,
} from '../../lib/export/tally-xml';
import { VoucherType } from '../../lib/types/vouchers';
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
    expect(xml).toContain('<TALLYREQUEST>Import Data</TALLYREQUEST>');
    expect(xml).toContain('<BODY');
    expect(xml).toContain('<IMPORTDATA');
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

  it('emits purchase inventory entries nested under ALLLEDGERENTRIES.LIST with signed quantity', () => {
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

  it('emits sales inventory entries nested under ALLLEDGERENTRIES.LIST with negative quantity', () => {
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
    expect(xml).toContain('-10 SH');  // qty with UOM
  });

  it('handles empty vouchers array', () => {
    const xml = generateVouchersXml([], 'Co');
    expect(xml).toContain('<REQUESTDATA/>');
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
    expect(result.transactionsXml).toContain('ALLLEDGERENTRIES.LIST');
  });
});
