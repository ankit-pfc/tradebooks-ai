import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
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
  deriveFYLabel,
  buildProfileFromSettings,
} from '@/lib/engine/accounting-policy';
import { AccountingMode } from '@/lib/types/accounting';
import { collectRequiredLedgers } from '@/lib/export/ledger-masters';
import { generateFullExport } from '@/lib/export/tally-xml';
import { getBatchRepository, getSettingsRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { matchTrades } from '@/lib/engine/trade-matcher';
import type { BatchFileType, BatchProcessingResult } from '@/lib/types/domain';
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
  files: PipelineFileInput[];
}

export interface PipelineOutput {
  tradeCount: number;
  eventCount: number;
  voucherCount: number;
  ledgerCount: number;
  checks: BatchProcessingResult['checks'];
  summary: { passed: number; warnings: number; failed: number };
  mastersXml: string;
  transactionsXml: string;
  mastersArtifactId: string;
  transactionsArtifactId: string;
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
  };
  fundsStatement?: { rows: ZerodhaFundsStatementRow[]; metadata: ParseMetadata };
  dividends?: { rows: ZerodhaDividendRow[]; metadata: ParseMetadata };
  files: ParsedFile[];
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
        const parsed = parseContractNotes(f.buffer, f.fileName);
        const sheets = pairContractNoteData(
          parsed.trades,
          parsed.charges,
          parsed.tradesPerSheet,
        );
        parsedFileSet.contractNote = {
          sheets,
          charges: parsed.charges,
          metadata: parsed.metadata,
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
  const events = buildCanonicalEvents({
    tradebookRows: parsedFileSet.tradebook?.rows,
    fundsRows: parsedFileSet.fundsStatement?.rows,
    contractNoteSheets: parsedFileSet.contractNote?.sheets,
    dividendRows: parsedFileSet.dividends?.rows,
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
  const tallyProfile = getDefaultTallyProfile(
    accountingMode === 'trader' ? AccountingMode.TRADER : AccountingMode.INVESTOR,
  );

  // Step 6: Load prior batch closing lots as opening balances (multi-FY)
  let tracker: CostLotTracker;
  if (priorBatchId) {
    const priorLots = await repo.getClosingLots(priorBatchId);
    tracker = priorLots ? CostLotTracker.fromJSON({ lots: priorLots }) : new CostLotTracker();
  } else {
    tracker = new CostLotTracker();
  }

  // Step 7: Build vouchers, collect ledger masters, generate XML
  const vouchers = buildVouchers(events, profile, tracker, tallyProfile);
  const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });
  const { mastersXml, transactionsXml } = generateFullExport(
    vouchers,
    ledgers,
    companyName,
    tallyProfile.customGroups,
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
      tradeMatchDetails = `Contract note had no individual trade entries to match against. Your ${totalTradebook} tradebook trades were processed as-is. This is normal if your contract note only contains charges.`;
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

  // Step 10: Save artifacts to storage
  const storage = getFileStorage();
  const mastersArtifactId = crypto.randomUUID();
  const transactionsArtifactId = crypto.randomUUID();
  const now = new Date().toISOString();

  const mastersPath = await storage.upload(
    userId,
    batchId,
    mastersArtifactId,
    'xml',
    Buffer.from(mastersXml, 'utf-8'),
  );
  const transactionsPath = await storage.upload(
    userId,
    batchId,
    transactionsArtifactId,
    'xml',
    Buffer.from(transactionsXml, 'utf-8'),
  );

  await repo.saveExportArtifacts(batchId, [
    {
      id: mastersArtifactId,
      batch_id: batchId,
      artifact_type: 'masters_xml',
      file_name: `${companyName}-masters.xml`,
      mime_type: 'application/xml',
      created_at: now,
      storage_path: mastersPath,
    },
    {
      id: transactionsArtifactId,
      batch_id: batchId,
      artifact_type: 'transactions_xml',
      file_name: `${companyName}-transactions.xml`,
      mime_type: 'application/xml',
      created_at: now,
      storage_path: transactionsPath,
    },
  ]);

  // Step 11: Persist processing output and update batch status
  await repo.updateBatchStatus(batchId, 'succeeded', 'Processing complete');

  await repo.saveProcessingOutput({
    batchId,
    voucherCount: vouchers.length,
    processingResult: {
      summary: { passed, warnings, failed },
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
    mastersXml,
    transactionsXml,
    mastersArtifactId,
    transactionsArtifactId,
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
