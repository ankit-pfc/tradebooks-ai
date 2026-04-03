/**
 * tally-xml.ts
 * Generates TallyPrime-compatible XML import payloads.
 *
 * TallyPrime expects a strict envelope structure for both masters (ledger
 * definitions) and vouchers (journal / purchase / sales entries).  All
 * amounts follow Tally's sign convention:
 *   - Debit  → negative amount  + ISDEEMEDPOSITIVE = "Yes"
 *   - Credit → positive amount  + ISDEEMEDPOSITIVE = "No"
 *
 * Dates are formatted YYYYMMDD (no separators).
 */

import { create } from 'xmlbuilder2';
import type { VoucherDraft, VoucherLine } from '../types/vouchers';
import { VoucherType } from '../types/vouchers';

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

export interface LedgerMasterInput {
  /** Exact Tally ledger name. */
  name: string;
  /** Tally group this ledger belongs to (e.g. "Sundry Debtors"). */
  parent_group: string;
  /** True for stock / inventory ledgers (affects stock valuation). */
  affects_stock?: boolean;
}

export interface GroupMasterInput {
  /** Tally group name to create. */
  name: string;
  /** Parent group in the Tally group hierarchy. */
  parent: string;
}

export interface StockItemMasterInput {
  /** Exact Tally stock item name (must match STOCKITEMNAME in INVENTORYENTRIES). */
  name: string;
  /** Base unit of measure. Defaults to "Nos" (numbers) for equity shares. */
  baseUnit?: string;
}

/**
 * VoucherDraft augmented with its resolved line items.
 * The core VoucherDraft type intentionally omits lines (they live in a
 * separate table/collection); this type bundles them for the exporter.
 */
export interface VoucherDraftWithLines extends VoucherDraft {
  lines: VoucherLine[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Maps VoucherType enum values to the exact strings TallyPrime expects. */
const VOUCHER_TYPE_MAP: Record<VoucherType, string> = {
  [VoucherType.JOURNAL]: 'Journal',
  [VoucherType.PURCHASE]: 'Purchase',
  [VoucherType.SALES]: 'Sales',
  [VoucherType.RECEIPT]: 'Receipt',
  [VoucherType.PAYMENT]: 'Payment',
  [VoucherType.CONTRA]: 'Contra',
};

/**
 * Converts an ISO-8601 date string ("YYYY-MM-DD") to Tally's date format
 * ("YYYYMMDD").
 */
function toTallyDate(isoDate: string): string {
  // Strip the dashes; guard against already-formatted strings.
  return isoDate.replace(/-/g, '');
}

/**
 * Formats a decimal amount string for a Tally ledger entry.
 *
 * Tally convention:
 *   - Debit  line: AMOUNT is negative  (e.g. "-150000.00"),  ISDEEMEDPOSITIVE = "Yes"
 *   - Credit line: AMOUNT is positive  (e.g.  "150000.00"),  ISDEEMEDPOSITIVE = "No"
 *
 * VoucherLine.amount is always stored as a positive decimal string;
 * dr_cr drives the sign.
 */
function tallyAmount(amount: string, drCr: 'DR' | 'CR'): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return '0.00';
  const abs = Math.abs(n).toFixed(2);
  return drCr === 'DR' ? `-${abs}` : abs;
}

/** Returns "Yes" for debits, "No" for credits — Tally's ISDEEMEDPOSITIVE field. */
function isDeemedPositive(drCr: 'DR' | 'CR'): string {
  return drCr === 'DR' ? 'Yes' : 'No';
}

function formatInventoryQuantity(quantity: string): string {
  return `${quantity} SH`;
}

function formatInventoryRate(rate: string): string {
  return `${rate}/SH`;
}

function inventoryIsDeemedPositive(voucherType: VoucherType): string {
  return voucherType === VoucherType.SALES ? 'No' : 'Yes';
}

/**
 * Creates the outer ENVELOPE / HEADER / BODY / IMPORTDATA skeleton shared by
 * both masters and transactions XML documents.
 *
 * Returns the `<REQUESTDATA>` element so callers can append TALLYMESSAGE
 * children directly.
 */
function buildEnvelope(reportName: string, companyName: string) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('ENVELOPE');

  // HEADER
  doc.ele('HEADER').ele('TALLYREQUEST').txt('Import Data');

  // BODY
  const body = doc.ele('BODY');
  const importData = body.ele('IMPORTDATA');

  const requestDesc = importData.ele('REQUESTDESC');
  requestDesc.ele('REPORTNAME').txt(reportName);
  requestDesc
    .ele('STATICVARIABLES')
    .ele('SVCURRENTCOMPANY')
    .txt(companyName);

  const requestData = importData.ele('REQUESTDATA');

  return { root: doc, requestData };
}

// ---------------------------------------------------------------------------
// Masters XML
// ---------------------------------------------------------------------------

/**
 * Generates a TallyPrime XML document containing LEDGER master definitions.
 *
 * Import this file first in Tally ("All Masters") so that the ledger names
 * referenced by the transactions XML are already present in the company.
 *
 * @param ledgerNames  List of ledger master descriptors to create.
 * @param companyName  Exact company name as it appears in TallyPrime.
 * @returns            Well-formed, UTF-8 XML string ready for Tally import.
 */
export function generateMastersXml(
  ledgerNames: LedgerMasterInput[],
  companyName: string,
  groups?: GroupMasterInput[],
  stockItems?: StockItemMasterInput[],
): string {
  const { root, requestData } = buildEnvelope('All Masters', companyName);

  // Emit GROUP masters first — TallyPrime requires parent groups to exist
  // before child ledgers that reference them.
  if (groups && groups.length > 0) {
    for (const group of groups) {
      const msg = requestData.ele('TALLYMESSAGE', {
        'xmlns:UDF': 'TallyUDF',
      });

      const groupEle = msg.ele('GROUP', {
        NAME: group.name,
        RESERVEDNAME: '',
        ACTION: 'Create',
      });

      groupEle
        .ele('NAME.LIST')
        .ele('NAME')
        .txt(group.name);

      groupEle.ele('PARENT').txt(group.parent);

      const langList = groupEle.ele('LANGUAGENAME.LIST');
      langList.ele('NAME.LIST', { TYPE: 'String' }).ele('NAME').txt(group.name);
      langList.ele('LANGUAGEID').txt(' 1033');
    }
  }

  for (const ledger of ledgerNames) {
    const msg = requestData.ele('TALLYMESSAGE', {
      'xmlns:UDF': 'TallyUDF',
    });

    const ledgerEle = msg.ele('LEDGER', {
      NAME: ledger.name,
      RESERVEDNAME: '',
      ACTION: 'Create',
    });

    ledgerEle
      .ele('NAME.LIST')
      .ele('NAME')
      .txt(ledger.name);

    ledgerEle.ele('PARENT').txt(ledger.parent_group);
    ledgerEle.ele('ISBILLWISEON').txt('No');
    ledgerEle.ele('ISCOSTCENTRESON').txt('No');
    ledgerEle
      .ele('AFFECTSSTOCK')
      .txt(ledger.affects_stock === true ? 'Yes' : 'No');
    ledgerEle.ele('COUNTRYOFRESIDENCE').txt('India');

    const langList = ledgerEle.ele('LANGUAGENAME.LIST');
    langList.ele('NAME.LIST', { TYPE: 'String' }).ele('NAME').txt(ledger.name);
    langList.ele('LANGUAGEID').txt(' 1033');
  }

  // Emit STOCKITEM masters so Tally does not need to auto-create them.
  // This is required for versions of Tally that do not auto-create stock items
  // when referenced in INVENTORYENTRIES.LIST inside vouchers.
  if (stockItems && stockItems.length > 0) {
    for (const item of stockItems) {
      const msg = requestData.ele('TALLYMESSAGE', {
        'xmlns:UDF': 'TallyUDF',
      });

      const itemEle = msg.ele('STOCKITEM', {
        NAME: item.name,
        RESERVEDNAME: '',
        ACTION: 'Create',
      });

      itemEle
        .ele('NAME.LIST')
        .ele('NAME')
        .txt(item.name);

      itemEle.ele('BASEUNIT').txt(item.baseUnit ?? 'Nos');

      const langList = itemEle.ele('LANGUAGENAME.LIST');
      langList.ele('NAME.LIST', { TYPE: 'String' }).ele('NAME').txt(item.name);
      langList.ele('LANGUAGEID').txt(' 1033');
    }
  }

  return root.end({ prettyPrint: true });
}

// ---------------------------------------------------------------------------
// Vouchers (Transactions) XML
// ---------------------------------------------------------------------------

/**
 * Generates a TallyPrime XML document containing VOUCHER entries.
 *
 * Each VoucherDraftWithLines produces one `<VOUCHER>` element wrapped in a
 * `<TALLYMESSAGE>`.  Lines are ordered by their `line_no` field.
 *
 * @param vouchers     Array of voucher drafts, each bundled with their lines.
 * @param companyName  Exact company name as it appears in TallyPrime.
 * @returns            Well-formed, UTF-8 XML string ready for Tally import.
 */
export function generateVouchersXml(
  vouchers: VoucherDraftWithLines[],
  companyName: string,
): string {
  const { root, requestData } = buildEnvelope('Vouchers', companyName);

  for (const voucher of vouchers) {
    const tallyVchType =
      VOUCHER_TYPE_MAP[voucher.voucher_type] ?? 'Journal';

    const msg = requestData.ele('TALLYMESSAGE', {
      'xmlns:UDF': 'TallyUDF',
    });

    const voucherEle = msg.ele('VOUCHER', {
      VCHTYPE: tallyVchType,
      ACTION: 'Create',
      OBJVIEW: 'Accounting Voucher View',
    });

    const tallyDate = toTallyDate(voucher.voucher_date);
    voucherEle.ele('DATE').txt(tallyDate);
    voucherEle.ele('EFFECTIVEDATE').txt(tallyDate);

    if (voucher.narrative) {
      voucherEle.ele('NARRATION').txt(voucher.narrative);
    }

    if (voucher.external_reference) {
      voucherEle.ele('VOUCHERNUMBER').txt(voucher.external_reference);
    }

    voucherEle.ele('VOUCHERTYPENAME').txt(tallyVchType);

    // Sort lines by line_no to preserve intended ordering.
    const sortedLines = [...voucher.lines].sort(
      (a, b) => a.line_no - b.line_no,
    );
    const stockLines = sortedLines.filter(
      (line) => line.quantity !== null && line.rate !== null,
    );

    // The first line is the party ledger (broker/bank account).
    const partyLedgerName = sortedLines[0]?.ledger_name ?? '';
    if (partyLedgerName) {
      voucherEle.ele('PARTYLEDGERNAME').txt(partyLedgerName);
    }

    for (const line of sortedLines) {
      const entry = voucherEle.ele('ALLLEDGERENTRIES.LIST');

      entry.ele('LEDGERNAME').txt(line.ledger_name);
      entry.ele('ISDEEMEDPOSITIVE').txt(isDeemedPositive(line.dr_cr));
      entry.ele('ISLASTDEEMEDPOSITIVE').txt(isDeemedPositive(line.dr_cr));
      entry.ele('ISPARTYLEDGER').txt(
        line.ledger_name === partyLedgerName ? 'Yes' : 'No',
      );
      entry.ele('LEDGERFROMITEM').txt('No');
      entry.ele('REMOVEZEROENTRIES').txt('No');
      entry
        .ele('AMOUNT')
        .txt(tallyAmount(line.amount, line.dr_cr));

      // Cost centre tagging (optional).
      if (line.cost_center) {
        const ccEntry = entry.ele('CATEGORYENTRY.LIST');
        ccEntry.ele('CATEGORY').txt('Primary Cost Category');
        const cc = ccEntry.ele('COSTCENTRE.LIST');
        cc.ele('NAME').txt(line.cost_center);
        cc
          .ele('AMOUNT')
          .txt(tallyAmount(line.amount, line.dr_cr));
      }

      // Bill reference for bill-by-bill tracking (optional).
      if (line.bill_ref) {
        const billEntry = entry.ele('BILLALLOCATIONS.LIST');
        billEntry.ele('NAME').txt(line.bill_ref);
        billEntry.ele('BILLTYPE').txt('New Ref');
        billEntry
          .ele('AMOUNT')
          .txt(tallyAmount(line.amount, line.dr_cr));
      }
    }

    for (const line of stockLines) {
      const isSalesVoucher = voucher.voucher_type === VoucherType.SALES;
      const tagName = isSalesVoucher ? 'INVENTORYENTRIESOUT.LIST' : 'INVENTORYENTRIESIN.LIST';
      const inventoryEntry = voucherEle.ele(tagName);
      inventoryEntry.ele('STOCKITEMNAME').txt(line.ledger_name);
      inventoryEntry.ele('ISDEEMEDPOSITIVE').txt(inventoryIsDeemedPositive(voucher.voucher_type));
      inventoryEntry.ele('ACTUALQTY').txt(formatInventoryQuantity(line.quantity!));
      inventoryEntry.ele('BILLEDQTY').txt(formatInventoryQuantity(line.quantity!));
      inventoryEntry.ele('RATE').txt(formatInventoryRate(line.rate!));
      inventoryEntry.ele('AMOUNT').txt(tallyAmount(line.amount, line.dr_cr));
    }
  }

  return root.end({ prettyPrint: true });
}

// ---------------------------------------------------------------------------
// Full export bundle
// ---------------------------------------------------------------------------

export interface FullExportResult {
  /** XML string for the Masters import step (import first in Tally). */
  mastersXml: string;
  /** XML string for the Transactions / Vouchers import step. */
  transactionsXml: string;
}

/**
 * Convenience wrapper that produces both masters and transactions XML in a
 * single call.
 *
 * @param vouchers     Voucher drafts (with lines) to export.
 * @param ledgers      Ledger master descriptors required by those vouchers.
 * @param companyName  Exact company name as it appears in TallyPrime.
 * @returns            Object containing both XML strings.
 */
export function generateFullExport(
  vouchers: VoucherDraftWithLines[],
  ledgers: LedgerMasterInput[],
  companyName: string,
  groups?: GroupMasterInput[],
  stockItems?: StockItemMasterInput[],
): FullExportResult {
  return {
    mastersXml: generateMastersXml(ledgers, companyName, groups, stockItems),
    transactionsXml: generateVouchersXml(vouchers, companyName),
  };
}
