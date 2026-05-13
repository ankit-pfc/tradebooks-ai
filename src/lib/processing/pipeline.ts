import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
import { parseContractNotesXml } from '@/lib/parsers/zerodha/contract-notes-xml';
import { parseFundsStatement } from '@/lib/parsers/zerodha/funds-statement';
import { parseDividends } from '@/lib/parsers/zerodha/dividends';
import { parseTaxPnl } from '@/lib/parsers/zerodha/taxpnl';
import { parseHoldings } from '@/lib/parsers/zerodha/holdings';
import {
  buildCanonicalEvents,
  buildUnifiedSecurityId,
  pairContractNoteData,
  type ContractNoteSheet,
} from '@/lib/engine/canonical-events';
import { CostLotTracker } from '@/lib/engine/cost-lots';
import { buildVouchers } from '@/lib/engine/voucher-builder';
import {
  INVESTOR_DEFAULT,
  TRADER_DEFAULT,
  getDefaultTallyProfile,
  mergeOverridesIntoProfile,
  deriveFYLabel,
  buildProfileFromSettings,
} from '@/lib/engine/accounting-policy';
import { AccountingMode } from '@/lib/types/accounting';
import { collectRequiredLedgers } from '@/lib/export/ledger-masters';
import { generateFullExport, type StockItemMasterInput } from '@/lib/export/tally-xml';
import { getBatchRepository, getSettingsRepository, getLedgerRepository } from '@/lib/db';
import { matchTrades } from '@/lib/engine/trade-matcher';
import { mergePurchaseVouchers, disambiguateVoucherNumbers, type PurchaseMergeMode } from '@/lib/engine/voucher-merger';
import type { BatchFileType, BatchProcessingResult } from '@/lib/types/domain';
import { EventType, type CanonicalEvent, type CostLot } from '@/lib/types/events';
import { TradeClassification, TradeClassificationStrategy } from '@/lib/engine/trade-classifier';
import { checkMtfExposureWarning } from '@/lib/reconciliation/checks';
import { resolveInvestmentLedger } from '@/lib/engine/ledger-resolver';
import { InvoiceIntent, VoucherStatus, VoucherType, type VoucherLine } from '@/lib/types/vouchers';
import type { BuiltVoucherDraft, UncoveredSellTreatment } from '@/lib/engine/voucher-builder';
import type { LedgerMasterInput } from '@/lib/export/tally-xml';
import type { TallyProfile } from '@/lib/types/accounting';
import * as L from '@/lib/constants/ledger-names';
import Decimal from 'decimal.js';
import type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  ZerodhaHoldingsRow,
  ZerodhaTaxPnlExitRow,
  ZerodhaTaxPnlOpenPositionRow,
  ParseMetadata,
  CorporateActionInput,
} from '@/lib/parsers/zerodha/types';
import type { TraceRecorder } from '@/lib/trace';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PipelineFileInput {
  fileId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}

export type OpeningBalanceSource = 'none' | 'prior_batch' | 'tally_existing';

export interface PipelineInput {
  userId: string;
  batchId: string;
  companyName: string;
  accountingMode: 'investor' | 'trader';
  /** Resolved period start — required. Caller must provide this before invoking. */
  periodFrom: string;
  /** Resolved period end — required. Caller must provide this before invoking. */
  periodTo: string;
  priorBatchId?: string;
  openingBalanceSource?: OpeningBalanceSource;
  purchaseMergeMode?: PurchaseMergeMode;
  classificationStrategy?: TradeClassificationStrategy;
  /**
   * Manually-declared corporate actions (bonus, split, rights, merger/demerger).
   *
   * These are not parsed from Zerodha exports — users declare them via the
   * /api/batches/[batchId]/corporate-actions route when the processing
   * pipeline throws a `disposeLots` error on a scrip that underwent a
   * ratio change (e.g. face-value split with ISIN change). The processing
   * route re-reads persisted CAs from the batch record before invoking
   * the pipeline, so reprocessing a batch picks them up automatically.
   */
  corporateActions?: CorporateActionInput[];
  files: PipelineFileInput[];
  /**
   * Optional pipeline tracer. When provided, each stage records its
   * inputs/outputs into the recorder so a downstream debugger can rebuild
   * the row → event → voucher → XML lineage. Pre-GA only.
   */
  trace?: TraceRecorder;
}

export interface PipelineOutput {
  tradeCount: number;
  eventCount: number;
  voucherCount: number;
  ledgerCount: number;
  checks: BatchProcessingResult['checks'];
  summary: { passed: number; warnings: number; failed: number };
  classificationSummary: NonNullable<BatchProcessingResult['summary']['classification_summary']>;
  mastersXml: string;
  transactionsXml: string;
  filesSummary: { fileName: string; detectedType: BatchFileType }[];
  chargeSource: 'contract_note' | 'none';
  fyLabel?: string;
  matchResult?: {
    matched: number;
    unmatchedTradebook: number;
    unmatchedContractNote: number;
  };
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ParsedFile {
  fileId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
  detectedType: BatchFileType;
}

interface ParsedFileSet {
  tradebook?: { rows: ZerodhaTradebookRow[]; metadata: ParseMetadata };
  taxPnl?: {
    exits: ZerodhaTaxPnlExitRow[];
    openPositions: ZerodhaTaxPnlOpenPositionRow[];
    metadata: ParseMetadata;
  };
  contractNote?: {
    sheets: ContractNoteSheet[];
    charges: ZerodhaContractNoteCharges[];
    metadata: ParseMetadata;
    diagnostics?: string[];
  };
  fundsStatement?: { rows: ZerodhaFundsStatementRow[]; metadata: ParseMetadata };
  dividends?: { rows: ZerodhaDividendRow[]; metadata: ParseMetadata };
  holdings?: { equity: ZerodhaHoldingsRow[]; statementDate: string | null; metadata: ParseMetadata };
  files: ParsedFile[];
}

function buildContractNoteSymbolLookup(
  tradebookRows: ZerodhaTradebookRow[] | undefined,
): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const row of tradebookRows ?? []) {
    const isin = row.isin?.trim().toUpperCase();
    if (!isin || isin === 'NA' || isin === 'N/A' || isin === '-') {
      continue;
    }

    const symbol = row.symbol.trim().toUpperCase();
    lookup.set(symbol, symbol);

    const descriptionKey = `${symbol} - ${row.segment.trim().toUpperCase()} / ${isin}`;
    lookup.set(descriptionKey, symbol);
  }

  return lookup;
}

function symbolFromSecurityId(securityId: string): string {
  const parts = securityId.split(':');
  return parts.length > 1 ? parts[1] : securityId;
}

function stockItemNameFromSecurityId(_securityId: string, symbol: string): string {
  return `${symbol}-SH`;
}

function buildEventSymbolLookup(events: Array<{ security_id: string | null; security_symbol?: string | null }>): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const event of events) {
    if (event.security_id && event.security_symbol) {
      lookup.set(event.security_id, event.security_symbol);
    }
  }
  return lookup;
}

function normalizeComparableDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parts = trimmed.split(/[-/]/);
  if (parts.length >= 3 && parts[0].length === 2) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return trimmed.slice(0, 10);
}

function buildTradebookBuyKeySet(rows: ZerodhaTradebookRow[] | undefined): Set<string> {
  const keys = new Set<string>();
  for (const row of rows ?? []) {
    if (row.trade_type !== 'buy') continue;
    const securityId = buildUnifiedSecurityId(row.exchange, row.symbol, row.isin, row.segment);
    keys.add(`${securityId}|${normalizeComparableDate(row.trade_date)}`);
  }
  return keys;
}

function countByKey<T, K extends keyof T>(items: T[], key: K): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = String(item[key]);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function buildTaxPnlSecurityId(row: ZerodhaTaxPnlExitRow): string {
  const isin = row.isin.trim().toUpperCase();
  if (isin && isin !== 'NA' && isin !== 'N/A' && isin !== '-') {
    return `ISIN:${isin}`;
  }
  return `EQ:${row.symbol.trim().toUpperCase()}`;
}

function seedPriorCostLotsFromTaxPnl(params: {
  tracker: CostLotTracker;
  exits: ZerodhaTaxPnlExitRow[] | undefined;
  periodFrom: string;
  periodTo: string;
  batchId: string;
  sourceFileId: string;
  existingTradebookBuyKeys: Set<string>;
}): number {
  let seeded = 0;

  for (const row of params.exits ?? []) {
    if (!row.entry_date || !row.exit_date) continue;
    if (row.entry_date >= params.periodFrom) continue;
    if (row.exit_date < params.periodFrom || row.exit_date > params.periodTo) continue;

    const quantity = new Decimal(row.quantity);
    const buyValue = new Decimal(row.buy_value);
    if (!quantity.greaterThan(0) || buyValue.isNegative()) continue;

    const securityId = buildTaxPnlSecurityId(row);
    if (params.existingTradebookBuyKeys.has(`${securityId}|${row.entry_date}`)) {
      continue;
    }

    const rate = quantity.isZero()
      ? new Decimal(0)
      : buyValue.div(quantity).toDecimalPlaces(6);
    const rowKey = [
      'taxpnl-opening',
      row.symbol,
      row.isin,
      row.entry_date,
      row.exit_date,
      row.quantity,
      row.buy_value,
    ].join('|');

    const syntheticBuy: CanonicalEvent = {
      event_id: crypto.randomUUID(),
      import_batch_id: params.batchId,
      event_type: EventType.BUY_TRADE,
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'CNC',
      event_date: row.entry_date,
      settlement_date: null,
      security_id: securityId,
      security_symbol: row.symbol.trim().toUpperCase(),
      quantity: quantity.toFixed(),
      rate: rate.toFixed(),
      gross_amount: buyValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      charge_type: null,
      charge_amount: '0',
      source_file_id: params.sourceFileId,
      source_row_ids: [rowKey],
      contract_note_ref: null,
      external_ref: `TAXPNL-OPENING-${row.exit_date}`,
      event_hash: rowKey,
    };

    params.tracker.addLot(syntheticBuy);
    seeded += 1;
  }

  return seeded;
}

/**
 * Subtract one day from a YYYY-MM-DD string and return the result in the
 * same format. Used to date synthetic opening-position lots so they sort
 * BEFORE any in-period buys under FIFO.
 */
function shiftDateByOneDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map((v) => parseInt(v, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Build the per-scrip start-of-FY security_id used by the Tax P&L opening
 * position seeder.
 *
 * If the row lacks an ISIN (older Zerodha layouts), `symbolToIsin` provides
 * a fallback derived from Tradewise Exits — keeping the position-seeded lot
 * and the exits-seeded lot on the same security_id so the opening voucher
 * and FIFO disposal both see them as the same scrip.
 */
function buildOpenPositionSecurityId(
  row: ZerodhaTaxPnlOpenPositionRow,
  symbolToIsin: Map<string, string>,
): string {
  const rowIsin = (row.isin ?? '').trim().toUpperCase();
  if (rowIsin && rowIsin !== 'NA' && rowIsin !== 'N/A' && rowIsin !== '-') {
    return `ISIN:${rowIsin}`;
  }
  const symbolKey = row.symbol.trim().toUpperCase();
  const fallbackIsin = symbolToIsin.get(symbolKey);
  if (fallbackIsin) {
    return `ISIN:${fallbackIsin}`;
  }
  return `EQ:${symbolKey}`;
}

/**
 * Seed synthetic buy lots for opening shares that are STILL HELD at year-end
 * (i.e. not covered by a Tradewise Exits row).
 *
 * For each start-of-FY Open Positions row we compute:
 *   still_held_qty = start_position_qty
 *                  - sum(tradewise_exits.qty for same scrip where entry_date < periodFrom)
 *
 * If `still_held_qty > 0`, that's the remainder the Tradewise Exits seed
 * cannot cover (those exits only represent disposed lots). We add a single
 * synthetic buy lot for the remainder at the Open Positions per-unit cost.
 *
 * Tagged with `TAXPNL-OPENING-POSITION-` so it's distinguishable from the
 * `TAXPNL-OPENING-` exits-derived seed.
 */
function seedPriorOpeningLotsFromTaxPnl(params: {
  tracker: CostLotTracker;
  openPositions: ZerodhaTaxPnlOpenPositionRow[] | undefined;
  exits: ZerodhaTaxPnlExitRow[] | undefined;
  periodFrom: string;
  batchId: string;
  sourceFileId: string;
}): number {
  if (!params.openPositions || params.openPositions.length === 0) return 0;

  // Filter to start-of-period equity-shaped rows. Non-equity (F&O, currency,
  // commodity) lines are skipped because the rest of the pipeline only models
  // equity inventory.
  const startRows = params.openPositions.filter((row) => {
    if (!row.is_start_of_period) return false;
    if (!row.symbol) return false;
    const itype = row.instrument_type.toUpperCase();
    // Allow blank (older files) and explicit "EQ" / equity-like markers; skip
    // anything that looks like derivative / currency / commodity.
    if (
      itype.includes('FUT') ||
      itype.includes('OPT') ||
      itype.includes('CURRENCY') ||
      itype.includes('COMMODITY')
    ) {
      return false;
    }
    return true;
  });

  if (startRows.length === 0) return 0;

  // Walk Tradewise Exits once to derive two side-effects:
  //  1. `disposedPriorBySecurityId` — total prior-FY quantity already covered
  //     by `seedPriorCostLotsFromTaxPnl`, keyed by the same security_id that
  //     seeder uses (so the keys match what we'll compute below).
  //  2. `symbolToIsin` — fallback ISIN for Open Positions rows that lack one
  //     (older Zerodha layouts), so both seeds key the same scrip the same way.
  const disposedPriorBySecurityId: Map<string, Decimal> = new Map();
  const symbolToIsin: Map<string, string> = new Map();
  for (const exit of params.exits ?? []) {
    if (!exit.entry_date) continue;
    if (exit.entry_date >= params.periodFrom) continue;
    const securityId = buildTaxPnlSecurityId(exit);
    const qty = new Decimal(exit.quantity);
    disposedPriorBySecurityId.set(
      securityId,
      (disposedPriorBySecurityId.get(securityId) ?? new Decimal(0)).add(qty),
    );
    const isin = (exit.isin ?? '').trim().toUpperCase();
    if (isin && isin !== 'NA' && isin !== 'N/A' && isin !== '-') {
      symbolToIsin.set(exit.symbol.trim().toUpperCase(), isin);
    }
  }

  const syntheticAcquisitionDate = shiftDateByOneDay(params.periodFrom);
  let seeded = 0;

  for (const row of startRows) {
    const securityId = buildOpenPositionSecurityId(row, symbolToIsin);
    const startQty = new Decimal(row.quantity);
    const disposed = disposedPriorBySecurityId.get(securityId) ?? new Decimal(0);
    const remainder = startQty.sub(disposed);
    if (!remainder.greaterThan(0)) continue;

    const averagePrice = new Decimal(row.average_price);
    if (averagePrice.isNegative()) continue;
    const totalCost = remainder.mul(averagePrice);

    const rowKey = [
      'taxpnl-opening-position',
      row.symbol,
      row.isin ?? '',
      row.as_of_date,
      remainder.toFixed(),
      averagePrice.toFixed(),
    ].join('|');

    const syntheticBuy: CanonicalEvent = {
      event_id: crypto.randomUUID(),
      import_batch_id: params.batchId,
      event_type: EventType.BUY_TRADE,
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'CNC',
      event_date: syntheticAcquisitionDate,
      settlement_date: null,
      security_id: securityId,
      security_symbol: row.symbol.trim().toUpperCase(),
      quantity: remainder.toFixed(),
      rate: averagePrice.toDecimalPlaces(6).toFixed(),
      gross_amount: totalCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      charge_type: null,
      charge_amount: '0',
      source_file_id: params.sourceFileId,
      source_row_ids: [rowKey],
      contract_note_ref: null,
      external_ref: `TAXPNL-OPENING-POSITION-${row.as_of_date}`,
      event_hash: rowKey,
    };

    params.tracker.addLot(syntheticBuy);
    seeded += 1;
  }

  return seeded;
}

/**
 * Seed synthetic buy lots from a holdings snapshot (Zerodha "Holdings" XLSX).
 *
 * Each `Equity` row represents a still-held position entering the batch
 * period: quantity_available shares at average_price effective unit cost.
 * We register one synthetic buy lot per row, dated just before periodFrom
 * so it sorts ahead of in-period activity under FIFO.
 *
 * Skipped:
 * - Rows whose security_id is already represented by Tax-P&L opening
 *   positions (those carry the same information; we don't want double-
 *   counting when the user uploads both files).
 * - Rows with zero/negative quantity_available or negative average_price.
 *
 * This complements `seedPriorOpeningLotsFromTaxPnl` — users who do NOT have
 * a Tax P&L file can still establish prior-period cost basis via the
 * holdings snapshot. When both files are present, Tax P&L wins because it
 * is dated and survives partial-FY uploads.
 */
function seedPriorOpeningLotsFromHoldings(params: {
  tracker: CostLotTracker;
  holdings: ZerodhaHoldingsRow[] | undefined;
  periodFrom: string;
  batchId: string;
  sourceFileId: string;
}): number {
  if (!params.holdings || params.holdings.length === 0) return 0;

  // Avoid double-seeding: a scrip already covered by a Tax-P&L open position
  // (or carried forward from a prior batch) shows up as an open lot here.
  const alreadySeededIds = new Set<string>();
  for (const [securityId, lots] of params.tracker.getAllOpenLots()) {
    if (lots.length > 0) alreadySeededIds.add(securityId);
  }

  const syntheticAcquisitionDate = shiftDateByOneDay(params.periodFrom);
  let seeded = 0;

  for (const row of params.holdings) {
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol) continue;

    const quantity = new Decimal(row.quantity_available || '0');
    if (!quantity.greaterThan(0)) continue;

    const averagePrice = new Decimal(row.average_price || '0');
    if (averagePrice.isNegative()) continue;

    const isin = row.isin?.trim().toUpperCase();
    const securityId =
      isin && isin !== 'NA' && isin !== 'N/A' && isin !== '-'
        ? `ISIN:${isin}`
        : `EQ:${symbol}`;

    if (alreadySeededIds.has(securityId)) continue;

    const totalCost = quantity.mul(averagePrice);
    const rowKey = [
      'holdings-opening',
      symbol,
      isin ?? '',
      row.quantity_available,
      row.average_price,
    ].join('|');

    const syntheticBuy: CanonicalEvent = {
      event_id: crypto.randomUUID(),
      import_batch_id: params.batchId,
      event_type: EventType.BUY_TRADE,
      trade_classification: TradeClassification.INVESTMENT,
      trade_product: 'CNC',
      event_date: syntheticAcquisitionDate,
      settlement_date: null,
      security_id: securityId,
      security_symbol: symbol,
      quantity: quantity.toFixed(),
      rate: averagePrice.toDecimalPlaces(6).toFixed(),
      gross_amount: totalCost.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      charge_type: null,
      charge_amount: '0',
      source_file_id: params.sourceFileId,
      source_row_ids: [rowKey],
      contract_note_ref: null,
      external_ref: `HOLDINGS-OPENING-${symbol}`,
      event_hash: rowKey,
    };

    params.tracker.addLot(syntheticBuy);
    alreadySeededIds.add(securityId);
    seeded += 1;
  }

  return seeded;
}

function buildOpeningStockVoucher(params: {
  batchId: string;
  periodFrom: string;
  tracker: CostLotTracker;
  symbolLookup: Map<string, string>;
  tallyProfile: TallyProfile;
}): BuiltVoucherDraft | null {
  // Source lots from the live tracker so prior-batch lots, Tax-P&L
  // exits-derived lots, AND Tax-P&L open-positions-derived lots all flow
  // into the same opening voucher. The tracker only ever holds open
  // (quantity > 0) lots after seeding, so no further filtering is needed,
  // but we keep a defensive `greaterThan(0)` check in case the contract
  // ever changes.
  const openLots = Object.values(params.tracker.toJSON().lots)
    .flat()
    .filter((lot) => new Decimal(lot.open_quantity).greaterThan(0));

  if (openLots.length === 0) return null;

  const draftId = crypto.randomUUID();
  const lines: VoucherLine[] = [];
  let lineNo = 1;
  let totalOpeningValue = new Decimal(0);

  for (const lot of openLots) {
    const quantity = new Decimal(lot.open_quantity);
    const amount = lot.remaining_total_cost
      ? new Decimal(lot.remaining_total_cost)
      : quantity.mul(new Decimal(lot.effective_unit_cost));
    if (quantity.isZero() || amount.isZero()) continue;

    const symbol =
      lot.security_symbol ??
      params.symbolLookup.get(lot.security_id) ??
      symbolFromSecurityId(lot.security_id);
    const investmentLedger = resolveInvestmentLedger(params.tallyProfile, symbol).name;
    const rate = amount.div(quantity).toDecimalPlaces(6).toString();

    totalOpeningValue = totalOpeningValue.add(amount);
    lines.push({
      voucher_line_id: crypto.randomUUID(),
      voucher_draft_id: draftId,
      line_no: lineNo++,
      ledger_name: investmentLedger,
      amount: amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
      dr_cr: 'DR',
      security_id: lot.security_id,
      quantity: quantity.toFixed(),
      rate,
      stock_item_name: stockItemNameFromSecurityId(lot.security_id, symbol),
      cost_center: null,
      bill_ref: null,
    });
  }

  if (lines.length === 0 || totalOpeningValue.isZero()) return null;

  lines.push({
    voucher_line_id: crypto.randomUUID(),
    voucher_draft_id: draftId,
    line_no: lineNo,
    ledger_name: L.OPENING_BALANCE_EQUITY.name,
    amount: totalOpeningValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    dr_cr: 'CR',
    security_id: null,
    quantity: null,
    rate: null,
    stock_item_name: null,
    cost_center: null,
    bill_ref: null,
  });

  return {
    voucher_draft_id: draftId,
    import_batch_id: params.batchId,
    voucher_type: VoucherType.JOURNAL,
    invoice_intent: InvoiceIntent.NONE,
    voucher_date: params.periodFrom,
    external_reference: `OPENING-${params.periodFrom}`,
    narrative: `Opening stock brought forward from previous FY as on ${params.periodFrom}`,
    total_debit: totalOpeningValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    total_credit: totalOpeningValue.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
    draft_status: VoucherStatus.DRAFT,
    source_event_ids: ['prior-fy-closing-lots'],
    created_at: new Date().toISOString(),
    lines,
  };
}

function mergeLedgerMasters(
  base: LedgerMasterInput[],
  additions: LedgerMasterInput[],
): LedgerMasterInput[] {
  const byName = new Map<string, LedgerMasterInput>();
  for (const ledger of [...base, ...additions]) {
    if (!byName.has(ledger.name)) {
      byName.set(ledger.name, ledger);
    }
  }
  return Array.from(byName.values());
}

// ---------------------------------------------------------------------------
// Main pipeline function
// ---------------------------------------------------------------------------

export async function runProcessingPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const {
    userId,
    batchId,
    companyName,
    accountingMode,
    periodFrom,
    periodTo,
    priorBatchId,
    purchaseMergeMode = 'same_rate',
    corporateActions = [],
    files,
    trace,
  } = input;

  // Default classification strategy is derived from accountingMode so that
  // the common path (Zerodha tradebook with no product column) succeeds
  // without forcing the user to pick a strategy:
  //
  //   * investor → ASSUME_ALL_EQ_INVESTMENT — investor-mode users treat
  //     equity holdings as investment by design, which matches Tally's
  //     INVESTOR accounting profile. Missing-product rows become INVESTMENT.
  //
  //   * trader → HEURISTIC_SAME_DAY_FLAT_INTRADAY — trader-mode users care
  //     about the intraday/delivery split, so we fall back to the heuristic
  //     that reclassifies same-day net-flat groups as speculative.
  //
  // Callers can still pass an explicit strategy to override this default.
  const classificationStrategy =
    input.classificationStrategy ??
    (accountingMode === 'trader'
      ? TradeClassificationStrategy.HEURISTIC_SAME_DAY_FLAT_INTRADAY
      : TradeClassificationStrategy.ASSUME_ALL_EQ_INVESTMENT);

  const repo = getBatchRepository();

  // Step 1: Detect + parse files
  const parsedFileSet: ParsedFileSet = { files: [] };
  const fileIds: {
    tradebook?: string;
    fundsStatement?: string;
    contractNote?: string;
    taxPnl?: string;
    dividends?: string;
    holdings?: string;
    corporateActions?: string;
  } = {};

  for (const f of files) {
    const detectedType = detectFileType(f.buffer, f.fileName) as BatchFileType;
    parsedFileSet.files.push({
      fileId: f.fileId,
      fileName: f.fileName,
      buffer: f.buffer,
      mimeType: f.mimeType,
      detectedType,
    });
    trace?.attachFile({
      fileId: f.fileId,
      fileName: f.fileName,
      mimeType: f.mimeType,
      buffer: f.buffer,
      detectedType,
    });

    switch (detectedType) {
      case 'tradebook': {
        const parsed = parseTradebook(f.buffer, f.fileName);
        parsedFileSet.tradebook = { rows: parsed.rows, metadata: parsed.metadata };
        fileIds.tradebook = f.fileId;
        break;
      }
      case 'contract_note': {
        // XML files start with '<' (0x3c); XLSX files start with PK zip magic
        const parsed = f.buffer[0] === 0x3c
          ? parseContractNotesXml(f.buffer, f.fileName)
          : parseContractNotes(f.buffer, f.fileName);
        const sheets = pairContractNoteData(
          parsed.trades,
          parsed.charges,
          parsed.tradesPerSheet,
        );
        parsedFileSet.contractNote = {
          sheets,
          charges: parsed.charges,
          metadata: parsed.metadata,
          diagnostics: parsed.diagnostics,
        };
        fileIds.contractNote = f.fileId;
        break;
      }
      case 'funds_statement': {
        const parsed = parseFundsStatement(f.buffer, f.fileName);
        parsedFileSet.fundsStatement = { rows: parsed.rows, metadata: parsed.metadata };
        fileIds.fundsStatement = f.fileId;
        break;
      }
      case 'dividends': {
        const parsed = parseDividends(f.buffer, f.fileName);
        parsedFileSet.dividends = { rows: parsed.rows, metadata: parsed.metadata };
        fileIds.dividends = f.fileId;
        break;
      }
      case 'taxpnl': {
        const parsed = parseTaxPnl(f.buffer, f.fileName);
        parsedFileSet.taxPnl = {
          exits: parsed.exits,
          openPositions: parsed.open_positions,
          metadata: parsed.metadata,
        };
        fileIds.taxPnl = f.fileId;
        break;
      }
      case 'holdings': {
        // Holdings snapshot is an opening-balance source: the equity sheet
        // tells us what scrips the user held entering this batch's period
        // and at what average cost. It does NOT carry per-lot history, so
        // each holding becomes a single synthetic buy lot. Mutual-fund rows
        // are parsed but not seeded — the rest of the pipeline only models
        // equity inventory.
        const parsed = parseHoldings(f.buffer, f.fileName);
        parsedFileSet.holdings = {
          equity: parsed.equity,
          statementDate: parsed.metadata.date_range?.from ?? null,
          metadata: parsed.metadata,
        };
        fileIds.holdings = f.fileId;
        break;
      }
      case 'pnl': {
        // Generic Zerodha P&L statement — informational only. The pipeline
        // derives P&L from tradebook + tax P&L, so there is nothing to parse
        // here. We still record the detected type so the upload UI can show
        // "not needed — safe to skip" instead of "unknown".
        break;
      }
      default:
        break;
    }
  }

  // Step 2: Validate at least one processable file
  if (!parsedFileSet.tradebook && !parsedFileSet.contractNote && !parsedFileSet.dividends) {
    throw new Error(
      'No tradebook, contract note, or dividends file detected. ' +
      `Detected types: ${parsedFileSet.files.map((f) => f.detectedType).join(', ')}`,
    );
  }

  if (trace) {
    trace.stage(
      'parse',
      () => ({
        files: parsedFileSet.files.map((f) => ({
          fileId: f.fileId,
          fileName: f.fileName,
          detectedType: f.detectedType,
        })),
        tradebookRows: parsedFileSet.tradebook?.rows ?? [],
        contractNoteSheets: parsedFileSet.contractNote?.sheets ?? [],
        contractNoteCharges: parsedFileSet.contractNote?.charges ?? [],
        fundsRows: parsedFileSet.fundsStatement?.rows ?? [],
        dividendRows: parsedFileSet.dividends?.rows ?? [],
        taxPnlExits: parsedFileSet.taxPnl?.exits ?? [],
        taxPnlOpenPositions: parsedFileSet.taxPnl?.openPositions ?? [],
        holdingsRows: parsedFileSet.holdings?.equity ?? [],
      }),
      { diagnostics: parsedFileSet.contractNote?.diagnostics },
    );
  }

  // Step 3: Build canonical events
  const contractNoteSymbolByDescription = buildContractNoteSymbolLookup(parsedFileSet.tradebook?.rows);
  const events = buildCanonicalEvents({
    tradebookRows: parsedFileSet.tradebook?.rows,
    fundsRows: parsedFileSet.fundsStatement?.rows,
    contractNoteSheets: parsedFileSet.contractNote?.sheets,
    dividendRows: parsedFileSet.dividends?.rows,
    corporateActions,
    contractNoteSymbolByDescription,
    batchId,
    fileIds: {
      ...fileIds,
      // Corporate actions are user-declared, not file-derived — use a stable
      // sentinel so source_file_id is non-null on the resulting events.
      corporateActions: 'manual:corporate_actions',
    },
    classificationStrategy,
    deterministicIds: true,
  });

  if (trace) {
    trace.indexEvents(events);
    trace.stage('canonical-events', () => ({
      events,
      byType: countByKey(events, 'event_type'),
      symbolLookup: Object.fromEntries(contractNoteSymbolByDescription),
    }));
  }

  // Step 4: Trade matching (when both tradebook and contract notes are present)
  let matchResult: ReturnType<typeof matchTrades> | undefined;
  if (parsedFileSet.tradebook && parsedFileSet.contractNote) {
    const cnTradesWithDate = parsedFileSet.contractNote.sheets.flatMap((sheet) =>
      sheet.trades.map((trade) => ({ trade, tradeDate: sheet.charges.trade_date })),
    );
    matchResult = matchTrades(parsedFileSet.tradebook.rows, cnTradesWithDate);
    if (trace) {
      trace.stage('trade-match', () => ({
        matched: matchResult!.matched,
        unmatchedTradebook: matchResult!.unmatchedTradebook,
        unmatchedContractNote: matchResult!.unmatchedContractNote,
      }));
    }
  }

  // Step 5: Load user settings and resolve accounting profile
  let profile = accountingMode === 'trader' ? TRADER_DEFAULT : INVESTOR_DEFAULT;
  const settingsRepo = getSettingsRepository();
  const userSettings = await settingsRepo.getSettings(userId);
  if (userSettings) {
    profile = buildProfileFromSettings(userSettings);
    if (accountingMode === 'trader' && userSettings.accounting_mode !== 'TRADER') {
      profile = { ...profile, mode: AccountingMode.TRADER };
    } else if (accountingMode === 'investor' && userSettings.accounting_mode !== 'INVESTOR') {
      profile = { ...profile, mode: AccountingMode.INVESTOR };
    }
  }
  const baseTallyProfile = getDefaultTallyProfile(
    accountingMode === 'trader' ? AccountingMode.TRADER : AccountingMode.INVESTOR,
  );
  const ledgerOverrides = await getLedgerRepository().listOverrides(userId);
  const tallyProfile = ledgerOverrides.length > 0
    ? mergeOverridesIntoProfile(baseTallyProfile, ledgerOverrides)
    : baseTallyProfile;

  // Step 6: Load prior batch closing lots as opening balances (multi-FY)
  let tracker: CostLotTracker;
  let priorLots: Record<string, CostLot[]> | null = null;
  if (priorBatchId) {
    priorLots = await repo.getClosingLots(priorBatchId);
    tracker = priorLots ? CostLotTracker.fromJSON({ lots: priorLots }) : new CostLotTracker();
  } else {
    tracker = new CostLotTracker();
  }

  // Step 7: Seed Tax-P&L-derived prior lots BEFORE the opening voucher is
  // built — both the Tradewise-Exits seed (covers disposed prior lots) and
  // the Open-Positions seed (covers still-held prior lots) feed the same
  // CostLotTracker that drives the opening stock B/F voucher. Order matters:
  // the voucher must consolidate every prior-period lot, not just the
  // prior-batch path.
  const seededTaxPnlLots = seedPriorCostLotsFromTaxPnl({
    tracker,
    exits: parsedFileSet.taxPnl?.exits,
    periodFrom,
    periodTo,
    batchId,
    sourceFileId: fileIds.taxPnl ?? 'taxpnl:unknown',
    existingTradebookBuyKeys: buildTradebookBuyKeySet(parsedFileSet.tradebook?.rows),
  });
  const seededTaxPnlOpeningLots = seedPriorOpeningLotsFromTaxPnl({
    tracker,
    openPositions: parsedFileSet.taxPnl?.openPositions,
    exits: parsedFileSet.taxPnl?.exits,
    periodFrom,
    batchId,
    sourceFileId: fileIds.taxPnl ?? 'taxpnl:unknown',
  });
  // Holdings snapshot seeding runs AFTER Tax-P&L seeding so a scrip already
  // covered by Tax P&L is left alone (the seeder skips security_ids that
  // already have open lots). Users without a Tax P&L file can still seed
  // opening cost basis by uploading the Zerodha holdings export.
  seedPriorOpeningLotsFromHoldings({
    tracker,
    holdings: parsedFileSet.holdings?.equity,
    periodFrom,
    batchId,
    sourceFileId: fileIds.holdings ?? 'holdings:unknown',
  });
  const openingVoucher = buildOpeningStockVoucher({
    batchId,
    periodFrom,
    tracker,
    symbolLookup: buildEventSymbolLookup(events),
    tallyProfile,
  });
  const uncoveredSellTreatment: UncoveredSellTreatment = 'tally_existing_opening';

  if (trace) {
    trace.stage('opening-seed', () => ({
      priorLots,
      seededTaxPnlLots,
      seededTaxPnlOpeningLots,
      openingVoucher,
      uncoveredSellTreatment,
      mergedLots: tracker.toJSON().lots,
    }));
  }

  const rawVouchers = buildVouchers(
    events,
    profile,
    tracker,
    tallyProfile,
    uncoveredSellTreatment,
  );
  // mergePurchaseVouchers consolidates same-rate fills; disambiguateVoucherNumbers
  // appends -2/-3 suffixes to any remaining duplicate VOUCHERNUMBER pairs so
  // multi-script CNs and multi-rate same-script CNs don't collide on Tally import
  // (item #16 from 3rd review).
  const mergedVouchers = mergePurchaseVouchers(rawVouchers, purchaseMergeMode);
  const vouchers = [
    ...(openingVoucher ? [openingVoucher] : []),
    ...disambiguateVoucherNumbers(mergedVouchers),
  ];
  const openingLedgerMasters: LedgerMasterInput[] = openingVoucher
    ? [
        {
          name: L.OPENING_BALANCE_EQUITY.name,
          parent_group: L.OPENING_BALANCE_EQUITY.group,
          affects_stock: false,
        },
        ...openingVoucher.lines
          .filter((line) => line.quantity !== null && line.rate !== null)
          .map((line) => ({
            name: line.ledger_name,
            parent_group: tallyProfile.investment.group,
            affects_stock: true,
          })),
      ]
    : [];
  const ledgers = mergeLedgerMasters(
    collectRequiredLedgers(events, profile, { tallyProfile }),
    openingLedgerMasters,
  );

  const classificationSummary: NonNullable<BatchProcessingResult['summary']['classification_summary']> = {
    INVESTMENT: 0,
    SPECULATIVE_BUSINESS: 0,
    NON_SPECULATIVE_BUSINESS: 0,
    PROFILE_DRIVEN: 0,
    mtf_trades: 0,
  };

  for (const event of events) {
    if (event.event_type !== 'BUY_TRADE' && event.event_type !== 'SELL_TRADE') {
      continue;
    }

    const classification = event.trade_classification ?? TradeClassification.PROFILE_DRIVEN;
    classificationSummary[classification] += 1;
    if (event.trade_product === 'MTF') {
      classificationSummary.mtf_trades += 1;
    }
  }

  // Collect unique stock item names from inventory lines so Tally receives
  // explicit STOCKITEM master definitions and does not need to auto-create them.
  const stockItemNames = new Set<string>();
  for (const v of vouchers) {
    for (const line of v.lines ?? []) {
      if (line.quantity !== null && line.rate !== null) {
        const itemName = line.stock_item_name ?? line.ledger_name;
        stockItemNames.add(itemName);
      }
    }
  }
  const stockItems: StockItemMasterInput[] = Array.from(stockItemNames).map((name) => ({
    name,
    baseUnit: 'NOS',
  }));

  if (trace) {
    trace.indexVouchers(vouchers);
    trace.stage('vouchers', () => ({
      rawTradeVoucherCount: rawVouchers.length,
      mergedTradeVoucherCount: mergedVouchers.length,
      finalVoucherCount: vouchers.length,
      vouchers,
      ledgers,
      stockItemNames: Array.from(stockItemNames),
    }));
  }

  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    companyName,
    tallyProfile.customGroups,
    stockItems,
  );

  if (trace) {
    trace.stage('export-xml', () => ({
      mastersXmlBytes: mastersXml.length,
      transactionsXmlBytes: transactionsXml.length,
    }));
    trace.attachArtifact('events', events);
    trace.attachArtifact('vouchers', vouchers);
    trace.attachArtifact('ledgers', ledgers);
    trace.attachArtifact('stockItems', stockItems);
    trace.attachArtifact('mastersXml', mastersXml);
    trace.attachArtifact('transactionsXml', transactionsXml);
  }

  // Step 8: Build reconciliation checks
  const imbalancedVouchers = vouchers.filter((v) => v.total_debit !== v.total_credit);
  const checks: BatchProcessingResult['checks'] = [
    {
      check_name: 'Voucher Balance',
      status: imbalancedVouchers.length === 0 ? 'PASSED' : 'WARNING',
      details:
        imbalancedVouchers.length === 0
          ? `All ${vouchers.length} vouchers have balanced debit/credit totals.`
          : `${imbalancedVouchers.length} voucher(s) have a small balance difference: ` +
          imbalancedVouchers
            .map(
              (v) =>
                `${v.voucher_draft_id.slice(0, 8)}… DR=${v.total_debit} CR=${v.total_credit}`,
            )
            .join('; ') +
          '. You may correct these in Tally after import.',
    },
    {
      check_name: 'Trade Count',
      status: 'PASSED',
      details: `Generated ${events.length} events from ${parsedFileSet.files.length} file(s).`,
    },
    {
      check_name: 'Event-to-Voucher Mapping',
      status: events.length > 0 && vouchers.length > 0 ? 'PASSED' : 'WARNING',
      details: `${events.length} events mapped to ${vouchers.length} vouchers.`,
    },
    {
      check_name: 'XML Generation',
      status:
        mastersXml.includes('<ENVELOPE>') && transactionsXml.includes('<ENVELOPE>')
          ? 'PASSED'
          : 'FAILED',
      details: 'Masters and Transactions XML generated with valid Tally envelope.',
    },
  ];

  if (seededTaxPnlLots > 0 || seededTaxPnlOpeningLots > 0) {
    const parts: string[] = [];
    if (seededTaxPnlLots > 0) {
      parts.push(
        `${seededTaxPnlLots} disposed prior-period lot(s) from Tradewise Exits (covers in-FY sales of pre-FY purchases)`,
      );
    }
    if (seededTaxPnlOpeningLots > 0) {
      parts.push(
        `${seededTaxPnlOpeningLots} still-held opening position(s) from Open Positions (covers shares carried over but not yet sold)`,
      );
    }
    checks.push({
      check_name: 'Tax P&L Cost Basis',
      status: 'PASSED',
      details:
        `Seeded ${parts.join(' and ')} from Zerodha Tax P&L so the Tally Opening Stock B/F voucher reflects full prior-FY inventory.`,
    });
  }

  const mtfCheck = checkMtfExposureWarning(events);
  if (mtfCheck.status !== 'PASSED') {
    checks.push({
      check_name: 'MTF Review',
      status: mtfCheck.status,
      details: mtfCheck.details,
    });
  }

  if (matchResult) {
    const totalTradebook =
      matchResult.matched.length + matchResult.unmatchedTradebook.length;
    const totalCN =
      matchResult.matched.length + matchResult.unmatchedContractNote.length;
    const matchRate = matchResult.matched.length / Math.max(totalTradebook, 1);

    let tradeMatchStatus: 'PASSED' | 'WARNING';
    let tradeMatchDetails: string;

    if (matchRate >= 1.0) {
      tradeMatchStatus = 'PASSED';
      tradeMatchDetails = `All ${matchResult.matched.length} tradebook trades matched to contract note entries.`;
    } else if (totalCN === 0) {
      tradeMatchStatus = 'WARNING';
      const diagInfo = parsedFileSet.contractNote?.diagnostics?.length
        ? ` Parser diagnostics: ${parsedFileSet.contractNote.diagnostics.join('; ')}`
        : '';
      tradeMatchDetails = `Contract note had no individual trade entries to match against. Your ${totalTradebook} tradebook trades were processed as-is. ` +
        `If your contract note contains trades, the file layout may not match the expected format — please re-check and re-upload.${diagInfo}`;
    } else {
      tradeMatchStatus = 'WARNING';
      tradeMatchDetails =
        `${matchResult.matched.length} of ${totalTradebook} trades matched (${(matchRate * 100).toFixed(0)}%). ` +
        `${matchResult.unmatchedTradebook.length} tradebook trade(s) had no matching contract note entry — ` +
        `possible date or symbol format differences between files. Your Tally XML is unaffected.`;
    }

    checks.push({
      check_name: 'Trade Match',
      status: tradeMatchStatus,
      details: tradeMatchDetails,
    });
  }

  const passed = checks.filter((c) => c.status === 'PASSED').length;
  const warnings = checks.filter((c) => c.status === 'WARNING').length;
  const failed = checks.filter((c) => c.status === 'FAILED').length;

  // Step 9: Compute FY label
  const fyLabel = deriveFYLabel(periodFrom, periodTo);

  // Step 10: Persist processing output and update batch status
  await repo.updateBatchStatus(batchId, 'succeeded', 'Processing complete');

  await repo.saveProcessingOutput({
    batchId,
    voucherCount: vouchers.length,
    processingResult: {
      summary: { passed, warnings, failed, classification_summary: classificationSummary },
      checks,
    },
    exceptions: [],
  });

  // Step 12: Save closing lots snapshot for multi-FY carryforward
  const closingLots = tracker.toJSON().lots;
  if (Object.keys(closingLots).length > 0) {
    await repo.saveClosingLots(batchId, closingLots);
  }

  const tradeCount =
    (parsedFileSet.tradebook?.rows.length ?? 0) +
    (parsedFileSet.contractNote?.sheets.reduce((s, sh) => s + sh.trades.length, 0) ?? 0);

  if (trace) {
    trace.recordOutputs({
      tradeCount,
      eventCount: events.length,
      voucherCount: vouchers.length,
      ledgerCount: ledgers.length,
      checks,
      summary: { passed, warnings, failed },
      classificationSummary,
      chargeSource: parsedFileSet.contractNote ? 'contract_note' : 'none',
      fyLabel: fyLabel || undefined,
      matchResult: matchResult
        ? {
          matched: matchResult.matched.length,
          unmatchedTradebook: matchResult.unmatchedTradebook.length,
          unmatchedContractNote: matchResult.unmatchedContractNote.length,
        }
        : undefined,
    });
  }

  return {
    tradeCount,
    eventCount: events.length,
    voucherCount: vouchers.length,
    ledgerCount: ledgers.length,
    checks,
    summary: { passed, warnings, failed },
    classificationSummary,
    mastersXml,
    transactionsXml,
    filesSummary: parsedFileSet.files.map((f) => ({
      fileName: f.fileName,
      detectedType: f.detectedType,
    })),
    chargeSource: parsedFileSet.contractNote ? 'contract_note' : 'none',
    fyLabel: fyLabel || undefined,
    matchResult: matchResult
      ? {
        matched: matchResult.matched.length,
        unmatchedTradebook: matchResult.unmatchedTradebook.length,
        unmatchedContractNote: matchResult.unmatchedContractNote.length,
      }
      : undefined,
  };
}
