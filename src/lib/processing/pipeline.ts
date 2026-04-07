import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
import { parseContractNotesXml } from '@/lib/parsers/zerodha/contract-notes-xml';
import { parseFundsStatement } from '@/lib/parsers/zerodha/funds-statement';
import { parseDividends } from '@/lib/parsers/zerodha/dividends';
import {
  buildCanonicalEvents,
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
import { TradeClassification } from '@/lib/engine/trade-classifier';
import { checkMtfExposureWarning } from '@/lib/reconciliation/checks';
import type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  ParseMetadata,
} from '@/lib/parsers/zerodha/types';

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
    files,
  } = input;

  const repo = getBatchRepository();

  // Step 1: Detect + parse files
  const parsedFileSet: ParsedFileSet = { files: [] };
  const fileIds: {
    tradebook?: string;
    fundsStatement?: string;
    contractNote?: string;
    dividends?: string;
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
    contractNoteSymbolByDescription,
    batchId,
    fileIds,
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

  // Step 6: Load prior batch closing lots as opening balances (multi-FY)
  let tracker: CostLotTracker;
  if (priorBatchId) {
    const priorLots = await repo.getClosingLots(priorBatchId);
    tracker = priorLots ? CostLotTracker.fromJSON({ lots: priorLots }) : new CostLotTracker();
  } else {
    tracker = new CostLotTracker();
  }

  // Step 7: Build vouchers, collect ledger masters, generate XML
  const rawVouchers = buildVouchers(events, profile, tracker, tallyProfile);
  // mergePurchaseVouchers consolidates same-rate fills; disambiguateVoucherNumbers
  // appends -2/-3 suffixes to any remaining duplicate VOUCHERNUMBER pairs so
  // multi-script CNs and multi-rate same-script CNs don't collide on Tally import
  // (item #16 from 3rd review).
  const mergedVouchers = mergePurchaseVouchers(rawVouchers, purchaseMergeMode);
  const vouchers = disambiguateVoucherNumbers(mergedVouchers);
  const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });

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
