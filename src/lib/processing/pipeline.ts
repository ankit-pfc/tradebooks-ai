import Decimal from 'decimal.js';
import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
import { parseContractNotesXml } from '@/lib/parsers/zerodha/contract-notes-xml';
import { parseFundsStatement } from '@/lib/parsers/zerodha/funds-statement';
import { parseDividends } from '@/lib/parsers/zerodha/dividends';
import { parseHoldings } from '@/lib/parsers/zerodha/holdings';
import { parseLedger } from '@/lib/parsers/zerodha/ledger';
import {
  buildCanonicalEvents,
  pairContractNoteData,
  type ContractNoteSheet,
} from '@/lib/engine/canonical-events';
import { CostLotTracker } from '@/lib/engine/cost-lots';
import { buildVouchers } from '@/lib/engine/voucher-builder';
import { resolveInvestmentLedger } from '@/lib/engine/ledger-resolver';
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
import {
  generateFullExport,
  type LedgerMasterInput,
  type StockItemMasterInput,
  type VoucherDraftWithLines,
} from '@/lib/export/tally-xml';
import { getBatchRepository, getSettingsRepository, getLedgerRepository } from '@/lib/db';
import { matchTrades } from '@/lib/engine/trade-matcher';
import { mergePurchaseVouchers, disambiguateVoucherNumbers, type PurchaseMergeMode } from '@/lib/engine/voucher-merger';
import type { BatchFileType, BatchProcessingResult } from '@/lib/types/domain';
import { TradeClassification, TradeClassificationStrategy } from '@/lib/engine/trade-classifier';
import { checkMtfExposureWarning } from '@/lib/reconciliation/checks';
import * as L from '@/lib/constants/ledger-names';
import type {
  ZerodhaHoldingsRow,
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  ZerodhaLedgerRow,
  ParseMetadata,
  CorporateActionInput,
} from '@/lib/parsers/zerodha/types';
import type { CostLot } from '@/lib/types/events';
import { InvoiceIntent, VoucherStatus, VoucherType, type VoucherLine } from '@/lib/types/vouchers';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PipelineFileInput {
  fileId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}

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
  contractNote?: {
    sheets: ContractNoteSheet[];
    charges: ZerodhaContractNoteCharges[];
    metadata: ParseMetadata;
    diagnostics?: string[];
  };
  fundsStatement?: { rows: ZerodhaFundsStatementRow[]; metadata: ParseMetadata };
  dividends?: { rows: ZerodhaDividendRow[]; metadata: ParseMetadata };
  holdings?: { rows: ZerodhaHoldingsRow[]; metadata: ParseMetadata };
  ledger?: { rows: ZerodhaLedgerRow[]; openingBalance: string; metadata: ParseMetadata };
  files: ParsedFile[];
}

interface OpeningSeedResult {
  lots: Record<string, CostLot[]>;
  vouchers: VoucherDraftWithLines[];
  additionalLedgers: LedgerMasterInput[];
}

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

function isValidIsinLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return ISIN_PATTERN.test(value.trim().toUpperCase());
}

function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeSecurityId(params: {
  isin?: string | null;
  symbol: string;
  fallbackSecurityId?: string | null;
}): string {
  const isin = params.isin?.trim().toUpperCase() ?? '';
  if (isValidIsinLike(isin)) {
    return `ISIN:${isin}`;
  }

  if (params.fallbackSecurityId) {
    return params.fallbackSecurityId;
  }

  return `EQ:${params.symbol.trim().toUpperCase()}`;
}

function deriveSymbolFromSecurityId(securityId: string): string {
  const parts = securityId.split(':');
  return parts.length > 1 ? parts[1] : securityId;
}

function stockItemNameFromSecurityId(securityId: string, fallbackSymbol: string): string {
  const normalizedSymbol = fallbackSymbol.trim().toUpperCase();
  if (normalizedSymbol) {
    return `${normalizedSymbol}-SH`;
  }

  const [, value] = securityId.split(':');
  const normalizedValue = value?.trim().toUpperCase();
  return `${normalizedValue || securityId.trim().toUpperCase()}-SH`;
}

function sanitizeReferenceToken(value: string): string {
  return value.replace(/[^A-Z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'OPENING';
}

function makeVoucherLine(
  draftId: string,
  lineNo: number,
  ledgerName: string,
  amount: string,
  drCr: 'DR' | 'CR',
  opts?: {
    security_id?: string | null;
    quantity?: string | null;
    rate?: string | null;
    stock_item_name?: string | null;
  },
): VoucherLine {
  return {
    voucher_line_id: crypto.randomUUID(),
    voucher_draft_id: draftId,
    line_no: lineNo,
    ledger_name: ledgerName,
    amount,
    dr_cr: drCr,
    security_id: opts?.security_id ?? null,
    quantity: opts?.quantity ?? null,
    rate: opts?.rate ?? null,
    stock_item_name: opts?.stock_item_name ?? null,
    cost_center: null,
    bill_ref: null,
  };
}

function buildOpeningSymbolLookup(
  tradebookRows: ZerodhaTradebookRow[] | undefined,
  holdingsRows: ZerodhaHoldingsRow[] | undefined,
): {
  symbolBySecurityId: Map<string, string>;
  securityIdBySymbol: Map<string, string>;
} {
  const symbolBySecurityId = new Map<string, string>();
  const securityIdBySymbol = new Map<string, string>();

  for (const row of tradebookRows ?? []) {
    const symbol = row.symbol.trim().toUpperCase();
    const securityId = normalizeSecurityId({ isin: row.isin, symbol, fallbackSecurityId: `EQ:${symbol}` });
    symbolBySecurityId.set(securityId, symbol);
    securityIdBySymbol.set(symbol, securityId);
  }

  for (const row of holdingsRows ?? []) {
    const symbol = row.symbol.trim().toUpperCase();
    const securityId = normalizeSecurityId({
      isin: row.isin,
      symbol,
      fallbackSecurityId: securityIdBySymbol.get(symbol) ?? null,
    });
    symbolBySecurityId.set(securityId, symbol);
    if (!securityIdBySymbol.has(symbol)) {
      securityIdBySymbol.set(symbol, securityId);
    }
  }

  return { symbolBySecurityId, securityIdBySymbol };
}

function mergeOpeningLots(
  primary: Record<string, CostLot[]>,
  supplement: Record<string, CostLot[]>,
): Record<string, CostLot[]> {
  const merged: Record<string, CostLot[]> = {};

  for (const [securityId, lots] of Object.entries(primary)) {
    merged[securityId] = lots.map((lot) => ({ ...lot }));
  }

  for (const [securityId, lots] of Object.entries(supplement)) {
    if (merged[securityId]?.length) continue;
    merged[securityId] = lots.map((lot) => ({ ...lot }));
  }

  return merged;
}

function buildLotsFromHoldings(
  holdingsRows: ZerodhaHoldingsRow[] | undefined,
  periodFrom: string,
  securityIdBySymbol: Map<string, string>,
): Record<string, CostLot[]> {
  const result: Record<string, CostLot[]> = {};

  for (const row of holdingsRows ?? []) {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) continue;

    const securityId = normalizeSecurityId({
      isin: row.isin,
      symbol,
      fallbackSecurityId: securityIdBySymbol.get(symbol) ?? null,
    });

    const totalQty = new Decimal(row.quantity_available || '0');
    const longTermQty = Decimal.min(
      Decimal.max(new Decimal(row.quantity_long_term || '0'), 0),
      totalQty,
    );
    const shortTermQty = totalQty.sub(longTermQty);
    const averagePrice = new Decimal(row.average_price || '0');

    if (totalQty.lte(0) || averagePrice.lt(0)) {
      continue;
    }

    const lots: CostLot[] = [];
    const longTermDate = shiftIsoDate(periodFrom, -366);
    const shortTermDate = shiftIsoDate(periodFrom, -1);

    if (longTermQty.gt(0)) {
      lots.push({
        cost_lot_id: crypto.randomUUID(),
        security_id: securityId,
        source_buy_event_id: `opening-holdings:${securityId}:lt`,
        open_quantity: longTermQty.toFixed(),
        original_quantity: longTermQty.toFixed(),
        effective_unit_cost: averagePrice.toFixed(6),
        acquisition_date: longTermDate,
        remaining_total_cost: longTermQty.mul(averagePrice).toFixed(2),
      });
    }

    if (shortTermQty.gt(0)) {
      lots.push({
        cost_lot_id: crypto.randomUUID(),
        security_id: securityId,
        source_buy_event_id: `opening-holdings:${securityId}:st`,
        open_quantity: shortTermQty.toFixed(),
        original_quantity: shortTermQty.toFixed(),
        effective_unit_cost: averagePrice.toFixed(6),
        acquisition_date: shortTermDate,
        remaining_total_cost: shortTermQty.mul(averagePrice).toFixed(2),
      });
    }

    if (lots.length > 0) {
      result[securityId] = lots;
    }
  }

  return result;
}

function buildOpeningSeed(params: {
  batchId: string;
  periodFrom: string;
  tallyProfile: ReturnType<typeof getDefaultTallyProfile>;
  symbolBySecurityId: Map<string, string>;
  openingLots: Record<string, CostLot[]>;
  ledgerOpeningBalance: string;
}): OpeningSeedResult {
  const vouchers: VoucherDraftWithLines[] = [];
  const ledgers = new Map<string, LedgerMasterInput>();
  const counterLedger = {
    name: L.OPENING_BALANCE_EQUITY.name,
    parent_group: L.OPENING_BALANCE_EQUITY.group,
    affects_stock: false,
  };

  for (const [securityId, lots] of Object.entries(params.openingLots)) {
    const symbol = params.symbolBySecurityId.get(securityId) ?? deriveSymbolFromSecurityId(securityId);
    const assetLedger = resolveInvestmentLedger(params.tallyProfile, symbol);
    ledgers.set(assetLedger.name, {
      name: assetLedger.name,
      parent_group: assetLedger.group,
      affects_stock: true,
    });

    lots.forEach((lot, index) => {
      const quantity = new Decimal(lot.open_quantity);
      const unitCost = new Decimal(lot.effective_unit_cost);
      if (quantity.lte(0)) return;

      const amount = new Decimal(lot.remaining_total_cost ?? quantity.mul(unitCost).toFixed(2))
        .toDecimalPlaces(2)
        .toFixed(2);
      const draftId = crypto.randomUUID();
      const reference = sanitizeReferenceToken(`OPEN-STOCK-${symbol}-${index + 1}-${params.periodFrom}`);
      const stockItemName = stockItemNameFromSecurityId(securityId, symbol);
      const longTermSeed = lot.acquisition_date <= shiftIsoDate(params.periodFrom, -366);
      const lines: VoucherLine[] = [
        makeVoucherLine(draftId, 1, assetLedger.name, amount, 'DR', {
          security_id: securityId,
          quantity: quantity.toFixed(),
          rate: unitCost.toFixed(6),
          stock_item_name: stockItemName,
        }),
        makeVoucherLine(draftId, 2, counterLedger.name, amount, 'CR'),
      ];

      vouchers.push({
        voucher_draft_id: draftId,
        import_batch_id: params.batchId,
        voucher_type: VoucherType.JOURNAL,
        invoice_intent: InvoiceIntent.NONE,
        voucher_date: params.periodFrom,
        external_reference: reference,
        narrative: longTermSeed
          ? `FY opening balance carried forward for ${symbol} (long-term lot)`
          : `FY opening balance carried forward for ${symbol}`,
        total_debit: amount,
        total_credit: amount,
        draft_status: VoucherStatus.DRAFT,
        source_event_ids: [],
        created_at: new Date().toISOString(),
        lines,
      });
      ledgers.set(counterLedger.name, counterLedger);
    });
  }

  const brokerOpening = new Decimal(params.ledgerOpeningBalance || '0');
  if (!brokerOpening.isZero()) {
    const brokerLedger = {
      name: params.tallyProfile.broker.name,
      parent_group: params.tallyProfile.broker.group,
      affects_stock: false,
    };
    ledgers.set(brokerLedger.name, brokerLedger);

    const amount = brokerOpening.abs().toFixed(2);
    const draftId = crypto.randomUUID();
    const isDebitBroker = brokerOpening.greaterThan(0);
    const lines: VoucherLine[] = isDebitBroker
      ? [
        makeVoucherLine(draftId, 1, brokerLedger.name, amount, 'DR'),
        makeVoucherLine(draftId, 2, counterLedger.name, amount, 'CR'),
      ]
      : [
        makeVoucherLine(draftId, 1, counterLedger.name, amount, 'DR'),
        makeVoucherLine(draftId, 2, brokerLedger.name, amount, 'CR'),
      ];

    vouchers.push({
      voucher_draft_id: draftId,
      import_batch_id: params.batchId,
      voucher_type: VoucherType.JOURNAL,
      invoice_intent: InvoiceIntent.NONE,
      voucher_date: params.periodFrom,
      external_reference: sanitizeReferenceToken(`OPEN-BROKER-${params.periodFrom}`),
      narrative: 'FY opening broker balance carried forward',
      total_debit: amount,
      total_credit: amount,
      draft_status: VoucherStatus.DRAFT,
      source_event_ids: [],
      created_at: new Date().toISOString(),
      lines,
    });
    ledgers.set(counterLedger.name, counterLedger);
  }

  return {
    lots: params.openingLots,
    vouchers,
    additionalLedgers: Array.from(ledgers.values()),
  };
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
    dividends?: string;
    holdings?: string;
    ledger?: string;
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
      case 'holdings': {
        const parsed = parseHoldings(f.buffer, f.fileName);
        parsedFileSet.holdings = { rows: parsed.equity, metadata: parsed.metadata };
        fileIds.holdings = f.fileId;
        break;
      }
      case 'ledger': {
        const parsed = parseLedger(f.buffer, f.fileName);
        parsedFileSet.ledger = {
          rows: parsed.rows,
          openingBalance: parsed.opening_balance,
          metadata: parsed.metadata,
        };
        fileIds.ledger = f.fileId;
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

  // Step 4: Trade matching (when both tradebook and contract notes are present)
  let matchResult: ReturnType<typeof matchTrades> | undefined;
  if (parsedFileSet.tradebook && parsedFileSet.contractNote) {
    const cnTradesWithDate = parsedFileSet.contractNote.sheets.flatMap((sheet) =>
      sheet.trades.map((trade) => ({ trade, tradeDate: sheet.charges.trade_date })),
    );
    matchResult = matchTrades(parsedFileSet.tradebook.rows, cnTradesWithDate);
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

  const { symbolBySecurityId, securityIdBySymbol } = buildOpeningSymbolLookup(
    parsedFileSet.tradebook?.rows,
    parsedFileSet.holdings?.rows,
  );

  // Step 6: Load prior batch closing lots and uploaded opening snapshots.
  const priorLots = priorBatchId
    ? (await repo.getClosingLots(priorBatchId)) ?? {}
    : {};
  const holdingsLots = buildLotsFromHoldings(
    parsedFileSet.holdings?.rows,
    periodFrom,
    securityIdBySymbol,
  );
  const openingSeed = buildOpeningSeed({
    batchId,
    periodFrom,
    tallyProfile,
    symbolBySecurityId,
    openingLots: mergeOpeningLots(priorLots, holdingsLots),
    ledgerOpeningBalance: parsedFileSet.ledger?.openingBalance ?? '0',
  });
  const tracker = CostLotTracker.fromJSON({ lots: openingSeed.lots });

  // Step 7: Build vouchers, collect ledger masters, generate XML
  const rawTradeVouchers = buildVouchers(events, profile, tracker, tallyProfile);
  // mergePurchaseVouchers consolidates same-rate fills; disambiguateVoucherNumbers
  // appends -2/-3 suffixes to any remaining duplicate VOUCHERNUMBER pairs so
  // multi-script CNs and multi-rate same-script CNs don't collide on Tally import
  // (item #16 from 3rd review).
  const mergedTradeVouchers = mergePurchaseVouchers(rawTradeVouchers, purchaseMergeMode);
  const tradeVouchers = disambiguateVoucherNumbers(mergedTradeVouchers);
  const vouchers = [...openingSeed.vouchers, ...tradeVouchers];
  const ledgersByName = new Map<string, LedgerMasterInput>();
  for (const ledger of collectRequiredLedgers(events, profile, { tallyProfile })) {
    ledgersByName.set(ledger.name, ledger);
  }
  for (const ledger of openingSeed.additionalLedgers) {
    ledgersByName.set(ledger.name, ledger);
  }
  const ledgers = Array.from(ledgersByName.values());

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
    baseUnit: 'SH',
  }));

  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    companyName,
    tallyProfile.customGroups,
    stockItems,
  );

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
