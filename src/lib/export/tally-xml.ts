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
        ACTION: 'Create',
      });

      groupEle
        .ele('NAME.LIST')
        .ele('NAME')
        .txt(group.name);

      groupEle.ele('PARENT').txt(group.parent);
    }
  }

  for (const ledger of ledgerNames) {
    const msg = requestData.ele('TALLYMESSAGE', {
      'xmlns:UDF': 'TallyUDF',
    });

    const ledgerEle = msg.ele('LEDGER', {
      NAME: ledger.name,
      ACTION: 'Create',
    });

    ledgerEle
      .ele('NAME.LIST')
      .ele('NAME')
      .txt(ledger.name);

    ledgerEle.ele('PARENT').txt(ledger.parent_group);
    ledgerEle.ele('ISBILLWISEON').txt('No');
    ledgerEle
      .ele('AFFECTSSTOCK')
      .txt(ledger.affects_stock === true ? 'Yes' : 'No');
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
    });

    voucherEle.ele('DATE').txt(toTallyDate(voucher.voucher_date));

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

    for (const line of sortedLines) {
      const entry = voucherEle.ele('ALLLEDGERENTRIES.LIST');

      entry.ele('LEDGERNAME').txt(line.ledger_name);
      entry.ele('ISDEEMEDPOSITIVE').txt(isDeemedPositive(line.dr_cr));
      entry
        .ele('AMOUNT')
        .txt(tallyAmount(line.amount, line.dr_cr));

      // Optional stock / inventory detail fields.
      if (line.quantity !== null && line.rate !== null) {
        const stockEntry = entry.ele('INVENTORYENTRIES.LIST');
        stockEntry.ele('STOCKITEMNAME').txt(line.ledger_name);
        stockEntry.ele('ACTUALQTY').txt(line.quantity);
        stockEntry.ele('BILLEDQTY').txt(line.quantity);
        stockEntry.ele('RATE').txt(line.rate);
        stockEntry
          .ele('AMOUNT')
          .txt(tallyAmount(line.amount, line.dr_cr));
      }

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
): FullExportResult {
  return {
    mastersXml: generateMastersXml(ledgers, companyName, groups),
    transactionsXml: generateVouchersXml(vouchers, companyName),
  };
}
