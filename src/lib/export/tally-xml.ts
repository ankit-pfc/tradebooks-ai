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

export interface VoucherXmlRenderConfig {
  tallyVoucherType: string;
  objView: 'Accounting Voucher View' | 'Invoice Voucher View';
  persistedView: 'Accounting Voucher View' | 'Invoice Voucher View';
  isInvoice: boolean;
  partyLedgerName: string;
}

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
 * Format a quantity string for Tally's INVENTORYALLOCATIONS.LIST.
 * DR lines = stock IN → positive qty.
 * CR lines = stock OUT → negative qty.
 * TallyPrime expects format: " <number> <unit>" (e.g., " 10 SH").
 */
function tallyQty(qty: string, drCr: 'DR' | 'CR', unit = 'SH'): string {
  const n = parseFloat(qty);
  if (isNaN(n)) return `0 ${unit}`;
  const abs = Math.abs(n);
  return drCr === 'DR' ? `${abs} ${unit}` : `-${abs} ${unit}`;
}

/**
 * Format a rate string for Tally's INVENTORYALLOCATIONS.LIST.
 * TallyPrime expects format: "<number>/<unit>" (e.g., "100.00/SH").
 */
function tallyRate(rate: string, unit = 'SH'): string {
  const n = parseFloat(rate);
  if (isNaN(n)) return `0/${unit}`;
  return `${Math.abs(n).toFixed(2)}/${unit}`;
}

function isTradeNarrative(narrative: string | null | undefined): boolean {
  if (!narrative) return false;
  return narrative.startsWith('Purchase of ') || narrative.startsWith('Sale of ');
}

function isLikelyPartyLedger(line: VoucherLine): boolean {
  if (line.quantity !== null || line.rate !== null) return false;
  return !/^(STCG|LTCG|STCL|LTCL|Speculative|Share Brokerage|GST|Stt|STT|Exchange and Other Charges|SEBI|Stamp|Cost of Shares Sold|Trading Sales)$/i.test(
    line.ledger_name,
  );
}

export function resolveVoucherXmlRenderConfig(
  voucher: VoucherDraftWithLines,
): VoucherXmlRenderConfig {
  const hasInventoryLines = voucher.lines.some(
    (line) => line.quantity !== null && line.rate !== null,
  );
  const narrative = voucher.narrative ?? '';
  const tradeNarrative = isTradeNarrative(voucher.narrative);
  const purchaseIntent =
    voucher.voucher_type === VoucherType.PURCHASE ||
    (voucher.voucher_type === VoucherType.JOURNAL && narrative.startsWith('Purchase of '));
  const salesIntent =
    voucher.voucher_type === VoucherType.SALES ||
    (voucher.voucher_type === VoucherType.JOURNAL && narrative.startsWith('Sale of '));

  const tallyVoucherType = hasInventoryLines && (purchaseIntent || salesIntent)
    ? salesIntent
      ? 'Sales'
      : 'Purchase'
    : VOUCHER_TYPE_MAP[voucher.voucher_type] ?? 'Journal';

  const isInvoice = hasInventoryLines && (purchaseIntent || salesIntent || tradeNarrative);
  const objView: VoucherXmlRenderConfig['objView'] = isInvoice
    ? 'Invoice Voucher View'
    : 'Accounting Voucher View';
  const persistedView = objView;

  const sortedLines = [...voucher.lines].sort((a, b) => a.line_no - b.line_no);
  const partyLedgerName = isInvoice
    ? sortedLines.find(isLikelyPartyLedger)?.ledger_name ??
      sortedLines.find((line) => line.quantity === null && line.rate === null)?.ledger_name ??
      sortedLines[0]?.ledger_name ??
      ''
    : sortedLines[0]?.ledger_name ?? '';

  return {
    tallyVoucherType,
    objView,
    persistedView,
    isInvoice,
    partyLedgerName,
  };
}

type EnvelopeKind = 'masters' | 'vouchers';

/**
 * Creates the outer ENVELOPE skeleton used by Tally imports.
 *
 * Tally's published masters samples still use the older IMPORTDATA envelope,
 * while published voucher samples use the stricter DATA/DESC request contract
 * with VERSION / TYPE / ID in the header. The voucher path is the one Tally
 * Prime validates against while importing transactions from the UI.
 */
function buildEnvelope(
  reportName: string,
  companyName: string,
  kind: EnvelopeKind = 'masters',
) {
  const doc = create({ version: '1.0', encoding: 'UTF-8' }).ele('ENVELOPE');
  const header = doc.ele('HEADER');

  if (kind === 'vouchers') {
    header.ele('VERSION').txt('1');
    header.ele('TALLYREQUEST').txt('Import');
    header.ele('TYPE').txt('Data');
    header.ele('ID').txt(reportName);

    const body = doc.ele('BODY');
    const desc = body.ele('DESC');
    desc
      .ele('STATICVARIABLES')
      .ele('SVCURRENTCOMPANY')
      .txt(companyName);

    const requestData = body.ele('DATA');
    return { root: doc, requestData };
  }

  header.ele('TALLYREQUEST').txt('Import Data');

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
    // F12 "Use Inventory Allocations for Ledgers : Yes" — required for Tally
    // to process INVENTORYALLOCATIONS.LIST entries nested inside journal
    // voucher ledger entries. Without this flag, Tally silently drops the
    // stock movements. See bug-report PDF page 6.
    ledgerEle
      .ele('ISINVENTORYAFFECTED')
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

      itemEle.ele('BASEUNITS').txt(item.baseUnit ?? 'Nos');

      const langList = itemEle.ele('LANGUAGENAME.LIST');
      langList.ele('NAME.LIST', { TYPE: 'String' }).ele('NAME').txt(item.name);
      langList.ele('LANGUAGEID').txt(' 1033');
    }

    const unitNames = [...new Set(stockItems.map((item) => item.baseUnit ?? 'Nos'))].sort();
    for (const unitName of unitNames) {
      const msg = requestData.ele('TALLYMESSAGE', {
        'xmlns:UDF': 'TallyUDF',
      });

      const unitEle = msg.ele('UNIT', {
        NAME: unitName,
        RESERVEDNAME: '',
        ACTION: 'Create',
      });

      unitEle.ele('NAME.LIST').ele('NAME').txt(unitName);
      unitEle.ele('ISSIMPLEUNIT').txt('Yes');
      unitEle.ele('ORIGINALNAME').txt(unitName);
      unitEle.ele('DECIMALPLACES').txt('0');

      const langList = unitEle.ele('LANGUAGENAME.LIST');
      langList.ele('NAME.LIST', { TYPE: 'String' }).ele('NAME').txt(unitName);
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
  const { root, requestData } = buildEnvelope('Vouchers', companyName, 'vouchers');

  for (const voucher of vouchers) {
    const renderConfig = resolveVoucherXmlRenderConfig(voucher);
    const tallyVchType = renderConfig.tallyVoucherType;
    const sortedLines = [...voucher.lines].sort((a, b) => a.line_no - b.line_no);

    const msg = requestData.ele('TALLYMESSAGE', {
      'xmlns:UDF': 'TallyUDF',
    });

    const voucherEle = msg.ele('VOUCHER', {
      VCHTYPE: tallyVchType,
      ACTION: 'Create',
      OBJVIEW: renderConfig.objView,
    });

    const tallyDate = toTallyDate(voucher.voucher_date);
    voucherEle.ele('DATE').txt(tallyDate);
    voucherEle.ele('EFFECTIVEDATE').txt(tallyDate);
    voucherEle.ele('PERSISTEDVIEW').txt(renderConfig.persistedView);
    if (renderConfig.isInvoice) {
      voucherEle.ele('ISINVOICE').txt('Yes');
    }

    if (voucher.narrative) {
      voucherEle.ele('NARRATION').txt(voucher.narrative);
    }

    if (voucher.external_reference) {
      voucherEle.ele('VOUCHERNUMBER').txt(voucher.external_reference);
    }

    voucherEle.ele('VOUCHERTYPENAME').txt(tallyVchType);

    if (renderConfig.partyLedgerName) {
      voucherEle.ele('PARTYLEDGERNAME').txt(renderConfig.partyLedgerName);
    }

    for (const line of sortedLines) {
      const entry = voucherEle.ele('LEDGERENTRIES.LIST');

      entry.ele('LEDGERNAME').txt(line.ledger_name);
      entry.ele('ISDEEMEDPOSITIVE').txt(isDeemedPositive(line.dr_cr));
      entry.ele('ISLASTDEEMEDPOSITIVE').txt(isDeemedPositive(line.dr_cr));
      entry.ele('ISPARTYLEDGER').txt(
        line.ledger_name === renderConfig.partyLedgerName ? 'Yes' : 'No',
      );
      entry.ele('LEDGERFROMITEM').txt('No');
      entry.ele('REMOVEZEROENTRIES').txt('No');
      entry
        .ele('AMOUNT')
        .txt(tallyAmount(line.amount, line.dr_cr));

      if (line.quantity !== null && line.rate !== null) {
        const stockItemName = line.stock_item_name ?? line.ledger_name;
        const stockEntry = entry.ele('INVENTORYALLOCATIONS.LIST');
        stockEntry.ele('STOCKITEMNAME').txt(stockItemName);
        // ISDEEMEDPOSITIVE / ISLASTDEEMEDPOSITIVE are intentionally NOT
        // emitted on INVENTORYALLOCATIONS.LIST — the sign is conveyed by
        // ACTUALQTY/BILLEDQTY/AMOUNT and emitting them here breaks Tally
        // import conformance (see tally-xml-conformance.test.ts).
        stockEntry.ele('ACTUALQTY').txt(tallyQty(line.quantity, line.dr_cr));
        stockEntry.ele('BILLEDQTY').txt(tallyQty(line.quantity, line.dr_cr));
        stockEntry.ele('RATE').txt(tallyRate(line.rate));
        stockEntry.ele('AMOUNT').txt(tallyAmount(line.amount, line.dr_cr));
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
  stockItems?: StockItemMasterInput[],
): FullExportResult {
  return {
    mastersXml: generateMastersXml(ledgers, companyName, groups, stockItems),
    transactionsXml: generateVouchersXml(vouchers, companyName),
  };
}
