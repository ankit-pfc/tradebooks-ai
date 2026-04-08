/**
 * Golden file test: runs the actual Zerodha tradebook through the full
 * pipeline and validates the generated Tally XML is structurally sound.
 *
 * This test uses the real tradebook file from ~/Downloads. It will be
 * skipped if the file is not present.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { XMLParser } from 'fast-xml-parser';

import { parseTradebook } from '../../lib/parsers/zerodha/tradebook';
import { buildCanonicalEvents } from '../../lib/engine/canonical-events';
import { CostLotTracker } from '../../lib/engine/cost-lots';
import { buildVouchers } from '../../lib/engine/voucher-builder';
import { INVESTOR_DEFAULT, getDefaultTallyProfile } from '../../lib/engine/accounting-policy';
import { AccountingMode } from '../../lib/types/accounting';
import { collectRequiredLedgers } from '../../lib/export/ledger-masters';
import { generateFullExport } from '../../lib/export/tally-xml';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const TRADEBOOK_PATH = join(homedir(), 'Downloads', 'Zerodha Tradebook.xlsx');
const FILE_EXISTS = existsSync(TRADEBOOK_PATH);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!FILE_EXISTS)('Golden file: Zerodha Tradebook → Tally XML', () => {
  // Run the full pipeline once, share results across tests
  const buffer = FILE_EXISTS ? readFileSync(TRADEBOOK_PATH) : Buffer.alloc(0);
  const parsed = FILE_EXISTS ? parseTradebook(buffer, 'Zerodha Tradebook.xlsx') : null;
  const rows = parsed?.rows ?? [];
  const batchId = 'golden-test-batch';

  const events = FILE_EXISTS
    ? buildCanonicalEvents({
        tradebookRows: rows,
        batchId,
        fileIds: { tradebook: 'file-1' },
      })
    : [];

  const profile = INVESTOR_DEFAULT;
  const tallyProfile = getDefaultTallyProfile(AccountingMode.INVESTOR);
  const tracker = new CostLotTracker();
  const vouchers = FILE_EXISTS ? buildVouchers(events, profile, tracker, tallyProfile) : [];
  const ledgers = FILE_EXISTS ? collectRequiredLedgers(events, profile, { tallyProfile }) : [];
  const { mastersXml, transactionsXml } = FILE_EXISTS
    ? generateFullExport(vouchers, ledgers, 'Golden Test Co', tallyProfile.customGroups)
    : { mastersXml: '', transactionsXml: '' };

  // ---------------------------------------------------------------------------
  // Pipeline sanity checks
  // ---------------------------------------------------------------------------

  it('parses trades from the tradebook', () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it('generates canonical events', () => {
    expect(events.length).toBeGreaterThan(0);
  });

  it('generates vouchers', () => {
    expect(vouchers.length).toBeGreaterThan(0);
  });

  it('generates ledger masters', () => {
    expect(ledgers.length).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------------------
  // Masters XML validation
  // ---------------------------------------------------------------------------

  it('masters XML is well-formed', () => {
    expect(() => parser.parse(mastersXml)).not.toThrow();
  });

  it('masters XML has correct envelope', () => {
    const doc = parser.parse(mastersXml);
    expect(doc.ENVELOPE.HEADER.TALLYREQUEST).toBe('Import Data');
    expect(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.REPORTNAME).toBe('All Masters');
  });

  it('every LEDGER has PARENT, NAME.LIST, RESERVEDNAME attr', () => {
    const doc = parser.parse(mastersXml);
    const messages = asArray(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE);
    const ledgerMsgs = messages.filter((m: Record<string, unknown>) => m.LEDGER);

    expect(ledgerMsgs.length).toBeGreaterThan(0);
    for (const msg of ledgerMsgs) {
      const led = msg.LEDGER as Record<string, unknown>;
      expect(led['@_NAME']).toBeTruthy();
      expect(led['@_RESERVEDNAME']).toBeDefined();
      expect(led.PARENT).toBeTruthy();
      expect(led['NAME.LIST']).toBeDefined();
    }
  });

  // ---------------------------------------------------------------------------
  // Transactions XML validation
  // ---------------------------------------------------------------------------

  it('transactions XML is well-formed', () => {
    expect(() => parser.parse(transactionsXml)).not.toThrow();
  });

  it('transactions XML has correct envelope', () => {
    const doc = parser.parse(transactionsXml);
    expect(doc.ENVELOPE.HEADER.VERSION).toBe('1');
    expect(doc.ENVELOPE.HEADER.TALLYREQUEST).toBe('Import');
    expect(doc.ENVELOPE.HEADER.TYPE).toBe('Data');
    expect(doc.ENVELOPE.HEADER.ID).toBe('Vouchers');
    expect(doc.ENVELOPE.BODY.DESC.STATICVARIABLES.SVCURRENTCOMPANY).toBe('Golden Test Co');
  });

  it('every voucher has required attributes and elements', () => {
    const doc = parser.parse(transactionsXml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucherMsgs = messages.filter((m: Record<string, unknown>) => m.VOUCHER);

    expect(voucherMsgs.length).toBeGreaterThan(0);
    for (const msg of voucherMsgs) {
      const v = msg.VOUCHER as Record<string, unknown>;
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      const hasInventory = entries.some((entry) => entry['INVENTORYALLOCATIONS.LIST']);
      expect(v['@_VCHTYPE']).toBeTruthy();
      expect(v['@_ACTION']).toBe('Create');
      expect(hasInventory ? 'Invoice Voucher View' : 'Accounting Voucher View').toBe(v['@_OBJVIEW']);
      if (hasInventory) {
        expect(v.ISINVOICE).toBe('Yes');
      } else {
        expect(v.ISINVOICE).toBeUndefined();
      }
      expect(v.PERSISTEDVIEW).toBe(v['@_OBJVIEW']);
      expect(v.DATE).toBeTruthy();
      expect(v.EFFECTIVEDATE).toBeTruthy();
      expect(v.VOUCHERTYPENAME).toBeTruthy();
      expect(v.PARTYLEDGERNAME).toBeTruthy();
    }
  });

  it('every voucher has balanced amounts (sum = 0)', () => {
    const doc = parser.parse(transactionsXml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucherMsgs = messages.filter((m: Record<string, unknown>) => m.VOUCHER);

    for (const msg of voucherMsgs) {
      const v = msg.VOUCHER as Record<string, unknown>;
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      const sum = entries.reduce(
        (acc: number, e: Record<string, unknown>) => acc + parseFloat(String(e.AMOUNT)),
        0,
      );
      expect(Math.abs(sum)).toBeLessThan(0.015); // Allow for floating point
    }
  });

  it('every voucher line has required fields', () => {
    const doc = parser.parse(transactionsXml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucherMsgs = messages.filter((m: Record<string, unknown>) => m.VOUCHER);

    for (const msg of voucherMsgs) {
      const v = msg.VOUCHER as Record<string, unknown>;
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);

      for (const entry of entries) {
        expect(entry.LEDGERNAME).toBeTruthy();
        expect(entry.ISDEEMEDPOSITIVE).toMatch(/^(Yes|No)$/);
        expect(entry.ISLASTDEEMEDPOSITIVE).toMatch(/^(Yes|No)$/);
        expect(entry.ISPARTYLEDGER).toMatch(/^(Yes|No)$/);
        expect(entry.AMOUNT).toBeDefined();
      }
    }
  });

  it('no empty or null ledger names in voucher lines', () => {
    const doc = parser.parse(transactionsXml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucherMsgs = messages.filter((m: Record<string, unknown>) => m.VOUCHER);

    for (const msg of voucherMsgs) {
      const v = msg.VOUCHER as Record<string, unknown>;
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);

      for (const entry of entries) {
        const name = String(entry.LEDGERNAME).trim();
        expect(name).not.toBe('');
        expect(name).not.toBe('null');
        expect(name).not.toBe('undefined');
      }
    }
  });

  it('all voucher ledger names exist in masters', () => {
    const mastersDoc = parser.parse(mastersXml);
    const masterMessages = asArray(mastersDoc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE);
    const masterLedgerNames = new Set(
      masterMessages
        .filter((m: Record<string, unknown>) => m.LEDGER)
        .map((m: Record<string, unknown>) => (m.LEDGER as Record<string, unknown>)['@_NAME'] as string),
    );

    const txDoc = parser.parse(transactionsXml);
    const txMessages = asArray(txDoc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucherMsgs = txMessages.filter((m: Record<string, unknown>) => m.VOUCHER);

    const missingLedgers = new Set<string>();
    for (const msg of voucherMsgs) {
      const v = msg.VOUCHER as Record<string, unknown>;
      const entries = asArray((v['LEDGERENTRIES.LIST'] ?? v['ALLLEDGERENTRIES.LIST']) as Record<string, unknown>[]);
      for (const entry of entries) {
        const name = String(entry.LEDGERNAME);
        if (!masterLedgerNames.has(name)) {
          missingLedgers.add(name);
        }
      }
    }

    expect(
      missingLedgers.size,
      `Ledger names used in vouchers but missing from masters: ${[...missingLedgers].join(', ')}`,
    ).toBe(0);
  });

  it('date format is YYYYMMDD (8 digits, no separators)', () => {
    const doc = parser.parse(transactionsXml);
    const messages = asArray(doc.ENVELOPE.BODY.DATA.TALLYMESSAGE);
    const voucherMsgs = messages.filter((m: Record<string, unknown>) => m.VOUCHER);

    for (const msg of voucherMsgs) {
      const v = msg.VOUCHER as Record<string, unknown>;
      expect(String(v.DATE)).toMatch(/^\d{8}$/);
      expect(String(v.EFFECTIVEDATE)).toMatch(/^\d{8}$/);
    }
  });
});
