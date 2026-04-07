/**
 * Conformance tests validating generated Tally XML matches the structural
 * patterns from known-good TallyPrime exports.
 *
 * Reference files:
 *   - ~/Downloads/XML Tally from Ankit.xml (masters)
 *   - ~/Downloads/Transactions.xml (vouchers)
 */
import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import {
  generateMastersXml,
  generateVouchersXml,
  type VoucherDraftWithLines,
  type LedgerMasterInput,
  type GroupMasterInput,
} from '../../lib/export/tally-xml';
import { VoucherType } from '../../lib/types/vouchers';
import { makeVoucherDraft, makeVoucherLine } from '../helpers/factories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

function parseXml(xml: string) {
  return parser.parse(xml);
}

/** Normalize to array — Tally XML elements may be single object or array. */
function asArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

function makeVoucher(
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

// ---------------------------------------------------------------------------
// XML well-formedness
// ---------------------------------------------------------------------------

describe('XML well-formedness', () => {
  it('masters XML parses without error', () => {
    const xml = generateMastersXml(
      [{ name: 'Bank', parent_group: 'Bank Accounts' }],
      'Test Co',
      [{ name: 'Custom Group', parent: 'Capital Account' }],
    );
    expect(() => parseXml(xml)).not.toThrow();
  });

  it('vouchers XML parses without error', () => {
    const xml = generateVouchersXml([makeVoucher()], 'Test Co');
    expect(() => parseXml(xml)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Envelope structure
// ---------------------------------------------------------------------------

describe('Tally envelope structure', () => {
  it('masters has ENVELOPE > HEADER > BODY > IMPORTDATA', () => {
    const xml = generateMastersXml(
      [{ name: 'Bank', parent_group: 'Bank Accounts' }],
      'Test Co',
    );
    const doc = parseXml(xml);
    expect(doc.ENVELOPE).toBeDefined();
    expect(doc.ENVELOPE.HEADER.TALLYREQUEST).toBe('Import Data');
    expect(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.REPORTNAME).toBe('All Masters');
    expect(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.STATICVARIABLES.SVCURRENTCOMPANY).toBe('Test Co');
  });

  it('vouchers has REPORTNAME = Vouchers', () => {
    const xml = generateVouchersXml([makeVoucher()], 'Test Co');
    const doc = parseXml(xml);
    expect(doc.ENVELOPE.HEADER.VERSION).toBe('1');
    expect(doc.ENVELOPE.HEADER.TALLYREQUEST).toBe('Import');
    expect(doc.ENVELOPE.HEADER.TYPE).toBe('Data');
    expect(doc.ENVELOPE.HEADER.ID).toBe('Vouchers');
    expect(doc.ENVELOPE.BODY.DESC.STATICVARIABLES.SVCURRENTCOMPANY).toBe('Test Co');
  });
});

// ---------------------------------------------------------------------------
// GROUP conformance (masters)
// ---------------------------------------------------------------------------

describe('GROUP conformance', () => {
  const groups: GroupMasterInput[] = [
    { name: 'STCG', parent: 'Capital Account' },
  ];
  const ledgers: LedgerMasterInput[] = [
    { name: 'Bank', parent_group: 'Bank Accounts' },
  ];

  function getGroups(xml: string) {
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE);
    return messages.filter((m: Record<string, unknown>) => m.GROUP).map((m: Record<string, unknown>) => m.GROUP);
  }

  it('has RESERVEDNAME="" attribute', () => {
    const xml = generateMastersXml(ledgers, 'Co', groups);
    const grps = getGroups(xml);
    expect(grps.length).toBe(1);
    expect(grps[0]['@_RESERVEDNAME']).toBe('');
  });

  it('has ACTION="Create" attribute', () => {
    const xml = generateMastersXml(ledgers, 'Co', groups);
    const grps = getGroups(xml);
    expect(grps[0]['@_ACTION']).toBe('Create');
  });

  it('has NAME.LIST with group name', () => {
    const xml = generateMastersXml(ledgers, 'Co', groups);
    const grps = getGroups(xml);
    expect(grps[0]['NAME.LIST'].NAME).toBe('STCG');
  });

  it('has PARENT element', () => {
    const xml = generateMastersXml(ledgers, 'Co', groups);
    const grps = getGroups(xml);
    expect(grps[0].PARENT).toBe('Capital Account');
  });

  it('has LANGUAGENAME.LIST with LANGUAGEID 1033', () => {
    const xml = generateMastersXml(ledgers, 'Co', groups);
    const grps = getGroups(xml);
    expect(grps[0]['LANGUAGENAME.LIST']).toBeDefined();
    expect(grps[0]['LANGUAGENAME.LIST'].LANGUAGEID).toContain('1033');
  });
});

// ---------------------------------------------------------------------------
// LEDGER conformance (masters)
// ---------------------------------------------------------------------------

describe('LEDGER conformance', () => {
  function getLedgers(xml: string) {
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE);
    return messages.filter((m: Record<string, unknown>) => m.LEDGER).map((m: Record<string, unknown>) => m.LEDGER);
  }

  const ledgers: LedgerMasterInput[] = [
    { name: 'RELIANCE-SH', parent_group: 'Investments', affects_stock: true },
    { name: 'Bank Account', parent_group: 'Bank Accounts' },
  ];

  it('has RESERVEDNAME="" attribute', () => {
    const xml = generateMastersXml(ledgers, 'Co');
    const leds = getLedgers(xml);
    for (const led of leds) {
      expect(led['@_RESERVEDNAME']).toBe('');
    }
  });

  it('has ACTION="Create" attribute', () => {
    const xml = generateMastersXml(ledgers, 'Co');
    const leds = getLedgers(xml);
    for (const led of leds) {
      expect(led['@_ACTION']).toBe('Create');
    }
  });

  it('has NAME.LIST, PARENT, ISBILLWISEON, AFFECTSSTOCK', () => {
    const xml = generateMastersXml(ledgers, 'Co');
    const leds = getLedgers(xml);
    const reliance = leds.find((l: Record<string, unknown>) => l['@_NAME'] === 'RELIANCE-SH');
    const bank = leds.find((l: Record<string, unknown>) => l['@_NAME'] === 'Bank Account');

    expect(reliance['NAME.LIST'].NAME).toBe('RELIANCE-SH');
    expect(reliance.PARENT).toBe('Investments');
    expect(reliance.ISBILLWISEON).toBe('No');
    expect(reliance.AFFECTSSTOCK).toBe('Yes');
    // F12 "Use Inventory Allocations for Ledgers" — required for Tally to
    // process INVENTORYALLOCATIONS.LIST inside journal voucher entries.
    expect(reliance.ISINVENTORYAFFECTED).toBe('Yes');

    expect(bank!.AFFECTSSTOCK).toBe('No');
    expect(bank!.ISINVENTORYAFFECTED).toBe('No');
  });

  it('has ISCOSTCENTRESON and COUNTRYOFRESIDENCE', () => {
    const xml = generateMastersXml(ledgers, 'Co');
    const leds = getLedgers(xml);
    for (const led of leds) {
      expect(led.ISCOSTCENTRESON).toBe('No');
      expect(led.COUNTRYOFRESIDENCE).toBe('India');
    }
  });

  it('has LANGUAGENAME.LIST with LANGUAGEID 1033', () => {
    const xml = generateMastersXml(ledgers, 'Co');
    const leds = getLedgers(xml);
    for (const led of leds) {
      expect(led['LANGUAGENAME.LIST']).toBeDefined();
      expect(led['LANGUAGENAME.LIST'].LANGUAGEID).toContain('1033');
    }
  });
});

// ---------------------------------------------------------------------------
// Element ordering: GROUPs before LEDGERs
// ---------------------------------------------------------------------------

describe('Element ordering', () => {
  it('GROUPs appear before LEDGERs in masters XML', () => {
    const xml = generateMastersXml(
      [{ name: 'Bank', parent_group: 'Bank Accounts' }],
      'Co',
      [{ name: 'Custom', parent: 'Capital Account' }],
    );
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE);
    const groupIdx = messages.findIndex((m: Record<string, unknown>) => m.GROUP);
    const ledgerIdx = messages.findIndex((m: Record<string, unknown>) => m.LEDGER);
    expect(groupIdx).toBeGreaterThanOrEqual(0);
    expect(ledgerIdx).toBeGreaterThanOrEqual(0);
    expect(groupIdx).toBeLessThan(ledgerIdx);
  });
});

// ---------------------------------------------------------------------------
// VOUCHER conformance
// ---------------------------------------------------------------------------

describe('VOUCHER conformance', () => {
  function getVouchers(xml: string) {
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    return messages.filter((m: Record<string, unknown>) => m.VOUCHER).map((m: Record<string, unknown>) => m.VOUCHER);
  }

  it('has required attributes: VCHTYPE, ACTION, OBJVIEW', () => {
    const xml = generateVouchersXml(
      [makeVoucher({ voucher_type: VoucherType.PURCHASE })],
      'Co',
    );
    const vouchers = getVouchers(xml);
    expect(vouchers[0]['@_VCHTYPE']).toBe('Purchase');
    expect(vouchers[0]['@_ACTION']).toBe('Create');
    expect(vouchers[0]['@_OBJVIEW']).toBe('Accounting Voucher View');
  });

  it('has DATE in YYYYMMDD format', () => {
    const xml = generateVouchersXml(
      [makeVoucher({ voucher_date: '2024-06-15' })],
      'Co',
    );
    const vouchers = getVouchers(xml);
    expect(String(vouchers[0].DATE)).toBe('20240615');
  });

  it('has EFFECTIVEDATE matching DATE', () => {
    const xml = generateVouchersXml(
      [makeVoucher({ voucher_date: '2024-06-15' })],
      'Co',
    );
    const vouchers = getVouchers(xml);
    expect(String(vouchers[0].EFFECTIVEDATE)).toBe('20240615');
    expect(vouchers[0].EFFECTIVEDATE).toBe(vouchers[0].DATE);
  });

  it('has VOUCHERTYPENAME matching VCHTYPE', () => {
    const types = [
      { type: VoucherType.JOURNAL, expected: 'Journal' },
      { type: VoucherType.PURCHASE, expected: 'Purchase' },
      { type: VoucherType.SALES, expected: 'Sales' },
      { type: VoucherType.RECEIPT, expected: 'Receipt' },
      { type: VoucherType.PAYMENT, expected: 'Payment' },
    ];
    for (const { type, expected } of types) {
      const xml = generateVouchersXml([makeVoucher({ voucher_type: type })], 'Co');
      const vouchers = getVouchers(xml);
      expect(vouchers[0].VOUCHERTYPENAME).toBe(expected);
      expect(vouchers[0]['@_VCHTYPE']).toBe(expected);
    }
  });

  it('has PARTYLEDGERNAME set to first ledger line', () => {
    const xml = generateVouchersXml([makeVoucher()], 'Co');
    const vouchers = getVouchers(xml);
    expect(vouchers[0].PARTYLEDGERNAME).toBe('Bank Account');
  });

  it('includes NARRATION when present', () => {
    const xml = generateVouchersXml(
      [makeVoucher({ narrative: 'Purchase of RELIANCE' })],
      'Co',
    );
    const vouchers = getVouchers(xml);
    expect(vouchers[0].NARRATION).toBe('Purchase of RELIANCE');
  });

  it('includes VOUCHERNUMBER when external_reference is set', () => {
    const xml = generateVouchersXml(
      [makeVoucher({ external_reference: 'CN-12345' })],
      'Co',
    );
    const vouchers = getVouchers(xml);
    expect(vouchers[0].VOUCHERNUMBER).toBe('CN-12345');
  });
  it('has PERSISTEDVIEW matching OBJVIEW', () => {
    const xml = generateVouchersXml([makeVoucher()], 'Co');
    const vouchers = getVouchers(xml);
    expect(vouchers[0].PERSISTEDVIEW).toBe(vouchers[0]['@_OBJVIEW']);
  });
});

// ---------------------------------------------------------------------------
// LEDGERENTRIES.LIST conformance
// ---------------------------------------------------------------------------

describe('LEDGERENTRIES.LIST conformance', () => {
  function getEntries(xml: string) {
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucher = messages.find((m: Record<string, unknown>) => m.VOUCHER)?.VOUCHER;
    return asArray(voucher?.['LEDGERENTRIES.LIST'] ?? voucher?.['ALLLEDGERENTRIES.LIST']);
  }

  const voucher = makeVoucher({
    lines: [
      makeVoucherLine({ line_no: 1, ledger_name: 'Bank Account', amount: '25000.00', dr_cr: 'DR' }),
      makeVoucherLine({ line_no: 2, ledger_name: 'Investment in RELIANCE', amount: '25000.00', dr_cr: 'CR' }),
    ],
  });

  it('each entry has LEDGERNAME', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    expect(entries[0].LEDGERNAME).toBe('Bank Account');
    expect(entries[1].LEDGERNAME).toBe('Investment in RELIANCE');
  });

  it('debit entry: ISDEEMEDPOSITIVE=Yes, negative AMOUNT', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    const drEntry = entries[0]; // Bank Account, DR
    expect(drEntry.ISDEEMEDPOSITIVE).toBe('Yes');
    expect(parseFloat(String(drEntry.AMOUNT))).toBeLessThan(0);
    expect(String(drEntry.AMOUNT)).toBe('-25000.00');
  });

  it('credit entry: ISDEEMEDPOSITIVE=No, positive AMOUNT', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    const crEntry = entries[1]; // Investment, CR
    expect(crEntry.ISDEEMEDPOSITIVE).toBe('No');
    expect(parseFloat(String(crEntry.AMOUNT))).toBeGreaterThan(0);
    expect(String(crEntry.AMOUNT)).toBe('25000.00');
  });

  it('ISLASTDEEMEDPOSITIVE mirrors ISDEEMEDPOSITIVE', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    for (const entry of entries) {
      expect(entry.ISLASTDEEMEDPOSITIVE).toBe(entry.ISDEEMEDPOSITIVE);
    }
  });

  it('first entry has ISPARTYLEDGER=Yes, others have No', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    expect(entries[0].ISPARTYLEDGER).toBe('Yes');
    expect(entries[1].ISPARTYLEDGER).toBe('No');
  });

  it('each entry has LEDGERFROMITEM=No and REMOVEZEROENTRIES=No', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    for (const entry of entries) {
      expect(entry.LEDGERFROMITEM).toBe('No');
      expect(entry.REMOVEZEROENTRIES).toBe('No');
    }
  });

  it('amounts sum to zero across all entries (balanced voucher)', () => {
    const xml = generateVouchersXml([voucher], 'Co');
    const entries = getEntries(xml);
    const sum = entries.reduce(
      (acc: number, e: Record<string, unknown>) => acc + parseFloat(String(e.AMOUNT)),
      0,
    );
    expect(Math.abs(sum)).toBeLessThan(0.01);
  });
});

// ---------------------------------------------------------------------------
// INVENTORYALLOCATIONS.LIST conformance
// ---------------------------------------------------------------------------

describe('INVENTORYALLOCATIONS.LIST conformance', () => {
  function getEntries(xml: string) {
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucher = messages.find((m: Record<string, unknown>) => m.VOUCHER)?.VOUCHER;
    return asArray(voucher?.['LEDGERENTRIES.LIST'] ?? voucher?.['ALLLEDGERENTRIES.LIST']);
  }

  it('purchase DR line emits positive inventory quantity with UOM and matching signed amount', () => {
    const purchaseVoucher = makeVoucher({
      voucher_type: VoucherType.PURCHASE,
      lines: [
        makeVoucherLine({
          line_no: 1,
          ledger_name: 'RELIANCE-SH',
          dr_cr: 'DR',
          quantity: '10',
          rate: '2500',
          amount: '25000.00',
        }),
        makeVoucherLine({
          line_no: 2,
          ledger_name: 'Zerodha Broking',
          dr_cr: 'CR',
          amount: '25000.00',
        }),
      ],
    });

    const entries = getEntries(generateVouchersXml([purchaseVoucher], 'Co'));
    const inventoryEntry = entries[0]['INVENTORYALLOCATIONS.LIST'];

    expect(inventoryEntry.ACTUALQTY).toBe('10 SH');
    expect(inventoryEntry.BILLEDQTY).toBe('10 SH');
    expect(inventoryEntry.STOCKITEMNAME).toBe('RELIANCE-SH');
    expect(inventoryEntry.AMOUNT).toBe('-25000.00');
    expect(inventoryEntry.RATE).toBe('2500.00/SH');
    // ISDEEMEDPOSITIVE is no longer emitted on INVENTORYALLOCATIONS.LIST
    expect(inventoryEntry.ISDEEMEDPOSITIVE).toBeUndefined();
  });

  it('sales CR line emits negative inventory quantity with UOM and matching signed amount', () => {
    const salesVoucher = makeVoucher({
      voucher_type: VoucherType.SALES,
      lines: [
        makeVoucherLine({
          line_no: 1,
          ledger_name: 'Zerodha Broking',
          dr_cr: 'DR',
          amount: '25000.00',
        }),
        makeVoucherLine({
          line_no: 2,
          ledger_name: 'RELIANCE-SH',
          dr_cr: 'CR',
          quantity: '10',
          rate: '2700',
          amount: '25000.00',
        }),
      ],
    });

    const entries = getEntries(generateVouchersXml([salesVoucher], 'Co'));
    const inventoryEntry = entries[1]['INVENTORYALLOCATIONS.LIST'];

    expect(inventoryEntry.ACTUALQTY).toBe('-10 SH');
    expect(inventoryEntry.BILLEDQTY).toBe('-10 SH');
    expect(inventoryEntry.AMOUNT).toBe('25000.00');
    // ISDEEMEDPOSITIVE is no longer emitted on INVENTORYALLOCATIONS.LIST
    expect(inventoryEntry.ISDEEMEDPOSITIVE).toBeUndefined();
  });

  it('omits INVENTORYALLOCATIONS.LIST on non-stock lines', () => {
    const voucher = makeVoucher({
      voucher_type: VoucherType.PURCHASE,
      lines: [
        makeVoucherLine({
          line_no: 1,
          ledger_name: 'RELIANCE-SH',
          dr_cr: 'DR',
          quantity: '10',
          rate: '2500',
          amount: '25000.00',
        }),
        makeVoucherLine({
          line_no: 2,
          ledger_name: 'Broker Charges',
          dr_cr: 'CR',
          amount: '25000.00',
        }),
      ],
    });

    const entries = getEntries(generateVouchersXml([voucher], 'Co'));

    expect(entries[1]['INVENTORYALLOCATIONS.LIST']).toBeUndefined();
  });

  it('full sell trade balances all ledger entries and keeps inventory on the stock line', () => {
    const sellVoucher = makeVoucher({
      voucher_type: VoucherType.SALES,
      lines: [
        makeVoucherLine({
          line_no: 1,
          ledger_name: 'Zerodha Broking',
          dr_cr: 'DR',
          amount: '26000.00',
        }),
        makeVoucherLine({
          line_no: 2,
          ledger_name: 'RELIANCE-SH',
          dr_cr: 'CR',
          quantity: '10',
          rate: '2700',
          amount: '25000.00',
        }),
        makeVoucherLine({
          line_no: 3,
          ledger_name: 'STCG on RELIANCE',
          dr_cr: 'CR',
          amount: '1000.00',
        }),
      ],
    });

    const entries = getEntries(generateVouchersXml([sellVoucher], 'Co'));
    const sum = entries.reduce(
      (acc: number, entry: Record<string, unknown>) => acc + parseFloat(String(entry.AMOUNT)),
      0,
    );

    expect(Math.abs(sum)).toBeLessThan(0.01);
    expect(entries[1]['INVENTORYALLOCATIONS.LIST']).toBeDefined();
    expect(entries[1]['INVENTORYALLOCATIONS.LIST'].ACTUALQTY).toBe('-10 SH');
  });
});

// ---------------------------------------------------------------------------
// Sign convention with concrete trade scenarios
// ---------------------------------------------------------------------------

describe('Sign convention — trade scenarios', () => {
  function getEntries(xml: string) {
    const doc = parseXml(xml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucher = messages.find((m: Record<string, unknown>) => m.VOUCHER)?.VOUCHER;
    return asArray(voucher?.['LEDGERENTRIES.LIST'] ?? voucher?.['ALLLEDGERENTRIES.LIST']);
  }

  it('buy trade: investment DR (negative), broker CR (positive)', () => {
    const buyVoucher = makeVoucher({
      voucher_type: VoucherType.PURCHASE,
      lines: [
        makeVoucherLine({ line_no: 1, ledger_name: 'RELIANCE-SH', amount: '25000.00', dr_cr: 'DR' }),
        makeVoucherLine({ line_no: 2, ledger_name: 'Zerodha Broking', amount: '25000.00', dr_cr: 'CR' }),
      ],
    });
    const xml = generateVouchersXml([buyVoucher], 'Co');
    const entries = getEntries(xml);

    // Investment ledger: debit
    expect(String(entries[0].AMOUNT)).toBe('-25000.00');
    expect(entries[0].ISDEEMEDPOSITIVE).toBe('Yes');

    // Broker ledger: credit
    expect(String(entries[1].AMOUNT)).toBe('25000.00');
    expect(entries[1].ISDEEMEDPOSITIVE).toBe('No');
  });

  it('sell trade: broker DR (negative), investment CR (positive), gain CR (positive)', () => {
    const sellVoucher = makeVoucher({
      voucher_type: VoucherType.SALES,
      lines: [
        makeVoucherLine({ line_no: 1, ledger_name: 'Zerodha Broking', amount: '26000.00', dr_cr: 'DR' }),
        makeVoucherLine({ line_no: 2, ledger_name: 'RELIANCE-SH', amount: '25000.00', dr_cr: 'CR' }),
        makeVoucherLine({ line_no: 3, ledger_name: 'STCG on RELIANCE', amount: '1000.00', dr_cr: 'CR' }),
      ],
    });
    const xml = generateVouchersXml([sellVoucher], 'Co');
    const entries = getEntries(xml);

    expect(String(entries[0].AMOUNT)).toBe('-26000.00'); // DR
    expect(String(entries[1].AMOUNT)).toBe('25000.00');  // CR
    expect(String(entries[2].AMOUNT)).toBe('1000.00');   // CR

    // Sum = 0
    const sum = entries.reduce(
      (acc: number, e: Record<string, unknown>) => acc + parseFloat(String(e.AMOUNT)),
      0,
    );
    expect(Math.abs(sum)).toBeLessThan(0.01);
  });

  it('dividend receipt: bank DR (negative), TDS DR (negative), income CR (positive)', () => {
    const divVoucher = makeVoucher({
      voucher_type: VoucherType.RECEIPT,
      lines: [
        makeVoucherLine({ line_no: 1, ledger_name: 'Bank Account', amount: '900.00', dr_cr: 'DR' }),
        makeVoucherLine({ line_no: 2, ledger_name: 'TDS on Dividend', amount: '100.00', dr_cr: 'DR' }),
        makeVoucherLine({ line_no: 3, ledger_name: 'Dividend Income', amount: '1000.00', dr_cr: 'CR' }),
      ],
    });
    const xml = generateVouchersXml([divVoucher], 'Co');
    const entries = getEntries(xml);

    expect(String(entries[0].AMOUNT)).toBe('-900.00');   // DR
    expect(entries[0].ISDEEMEDPOSITIVE).toBe('Yes');
    expect(String(entries[1].AMOUNT)).toBe('-100.00');   // DR
    expect(entries[1].ISDEEMEDPOSITIVE).toBe('Yes');
    expect(String(entries[2].AMOUNT)).toBe('1000.00');   // CR
    expect(entries[2].ISDEEMEDPOSITIVE).toBe('No');
  });
});
