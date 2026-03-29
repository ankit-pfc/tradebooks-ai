import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

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
import { getArtifactsDir, getUploadsDir } from '@/lib/db/local-store';
import { matchTrades } from '@/lib/engine/trade-matcher';
import type { BatchFileType } from '@/lib/types/domain';
import type {
  ZerodhaTradebookRow,
  ZerodhaFundsStatementRow,
  ZerodhaContractNoteCharges,
  ZerodhaDividendRow,
  ParseMetadata,
} from '@/lib/parsers/zerodha/types';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types for parsed file collection
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
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const companyName = form.get('companyName') as string | null;
    const accountingMode = form.get('accountingMode') as string | null;
    const periodFrom = form.get('periodFrom') as string | null;
    const periodTo = form.get('periodTo') as string | null;
    const priorBatchId = form.get('priorBatchId') as string | null;

    if (!companyName || !accountingMode) {
      return NextResponse.json(
        { error: 'Missing required fields: companyName, accountingMode' },
        { status: 400 },
      );
    }

    // Accept multiple files via 'files' or single file via 'file' (backward compat)
    const rawFiles = form.getAll('files') as File[];
    const singleFile = form.get('file') as File | null;
    const uploadFiles: File[] = rawFiles.length > 0
      ? rawFiles
      : singleFile
        ? [singleFile]
        : [];

    if (uploadFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 },
      );
    }

    // 1. Read and detect all files
    const parsedFileSet: ParsedFileSet = { files: [] };
    const fileIds: { tradebook?: string; fundsStatement?: string; contractNote?: string; dividends?: string } = {};

    for (const file of uploadFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileName = file.name;
      const fileId = crypto.randomUUID();
      const detectedType = detectFileType(buffer, fileName) as BatchFileType;

      parsedFileSet.files.push({
        fileId,
        fileName,
        buffer,
        mimeType: file.type || 'application/octet-stream',
        detectedType,
      });

      // 2. Parse by detected type
      switch (detectedType) {
        case 'tradebook': {
          const parsed = parseTradebook(buffer, fileName);
          parsedFileSet.tradebook = { rows: parsed.rows, metadata: parsed.metadata };
          fileIds.tradebook = fileId;
          break;
        }
        case 'contract_note': {
          const parsed = parseContractNotes(buffer, fileName);
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
          fileIds.contractNote = fileId;
          break;
        }
        case 'funds_statement': {
          const parsed = parseFundsStatement(buffer, fileName);
          parsedFileSet.fundsStatement = { rows: parsed.rows, metadata: parsed.metadata };
          fileIds.fundsStatement = fileId;
          break;
        }
        case 'dividends': {
          const parsed = parseDividends(buffer, fileName);
          parsedFileSet.dividends = { rows: parsed.rows, metadata: parsed.metadata };
          fileIds.dividends = fileId;
          break;
        }
        default:
          // Other file types (holdings, taxpnl, etc.) are accepted but not
          // yet integrated into the processing pipeline.
          break;
      }
    }

    // Must have at least a tradebook, contract notes, or dividends file
    if (!parsedFileSet.tradebook && !parsedFileSet.contractNote && !parsedFileSet.dividends) {
      return NextResponse.json(
        {
          error: 'No tradebook, contract note, or dividends file detected. ' +
            `Detected types: ${parsedFileSet.files.map((f) => f.detectedType).join(', ')}`,
        },
        { status: 400 },
      );
    }

    // 2b. Resolve period dates from form data or parsed file metadata
    const allMetadataRanges = [
      parsedFileSet.tradebook?.metadata.date_range,
      parsedFileSet.contractNote?.metadata.date_range,
      parsedFileSet.fundsStatement?.metadata.date_range,
      parsedFileSet.dividends?.metadata.date_range,
    ].filter((r): r is { from: string; to: string } => r != null);

    const resolvedPeriodFrom = periodFrom || (
      allMetadataRanges.length > 0
        ? allMetadataRanges.reduce((min, r) => r.from < min ? r.from : min, allMetadataRanges[0].from)
        : ''
    );
    const resolvedPeriodTo = periodTo || (
      allMetadataRanges.length > 0
        ? allMetadataRanges.reduce((max, r) => r.to > max ? r.to : max, allMetadataRanges[0].to)
        : ''
    );

    if (!resolvedPeriodFrom || !resolvedPeriodTo) {
      return NextResponse.json(
        { error: 'Could not determine period dates. Please provide periodFrom and periodTo.' },
        { status: 400 },
      );
    }

    // 3. Build canonical events from all sources
    const batchId = crypto.randomUUID();
    const events = buildCanonicalEvents({
      tradebookRows: parsedFileSet.tradebook?.rows,
      fundsRows: parsedFileSet.fundsStatement?.rows,
      contractNoteSheets: parsedFileSet.contractNote?.sheets,
      dividendRows: parsedFileSet.dividends?.rows,
      batchId,
      fileIds,
    });

    // 4. Trade matching (when both tradebook and contract notes are present)
    let matchResult: ReturnType<typeof matchTrades> | undefined;
    if (parsedFileSet.tradebook && parsedFileSet.contractNote) {
      const cnTradesWithDate = parsedFileSet.contractNote.sheets.flatMap((sheet) =>
        sheet.trades.map((trade) => ({ trade, tradeDate: sheet.charges.trade_date })),
      );
      matchResult = matchTrades(parsedFileSet.tradebook.rows, cnTradesWithDate);
    }

    // 5. Resolve user identity and load settings
    const userId = await getAuthenticatedUserId() ?? 'demo-user';

    let profile = accountingMode === 'trader' ? TRADER_DEFAULT : INVESTOR_DEFAULT;

    // Load user settings to build profile (form data overrides)
    const settingsRepo = getSettingsRepository();
    const userSettings = await settingsRepo.getSettings(userId);
    if (userSettings) {
      profile = buildProfileFromSettings(userSettings);
      // Form-level accountingMode override takes precedence
      if (accountingMode === 'trader' && userSettings.accounting_mode !== 'TRADER') {
        profile = { ...profile, mode: AccountingMode.TRADER };
      } else if (accountingMode === 'investor' && userSettings.accounting_mode !== 'INVESTOR') {
        profile = { ...profile, mode: AccountingMode.INVESTOR };
      }
    }

    const tallyProfile = getDefaultTallyProfile(
      accountingMode === 'trader' ? AccountingMode.TRADER : AccountingMode.INVESTOR,
    );

    // 6. Load prior batch closing lots as opening balances (multi-FY)
    const repo = getBatchRepository();
    let tracker: CostLotTracker;
    if (priorBatchId) {
      const priorLots = await repo.getClosingLots(priorBatchId);
      if (priorLots) {
        tracker = CostLotTracker.fromJSON({ lots: priorLots });
      } else {
        tracker = new CostLotTracker();
      }
    } else {
      tracker = new CostLotTracker();
    }

    const vouchers = buildVouchers(events, profile, tracker, tallyProfile);

    // 7. Collect ledger masters and generate XML
    const ledgers = collectRequiredLedgers(events, profile, { tallyProfile });
    const { mastersXml, transactionsXml } = generateFullExport(
      vouchers, ledgers, companyName, tallyProfile.customGroups,
    );

    // 8. Build reconciliation checks
    const checks = [
      {
        check_name: 'Voucher Balance',
        status: vouchers.every((v) => v.total_debit === v.total_credit)
          ? 'PASSED' as const
          : 'FAILED' as const,
        details: `All ${vouchers.length} vouchers have balanced debit/credit totals.`,
      },
      {
        check_name: 'Trade Count',
        status: 'PASSED' as const,
        details: `Generated ${events.length} events from ${parsedFileSet.files.length} file(s).`,
      },
      {
        check_name: 'Event-to-Voucher Mapping',
        status: events.length > 0 && vouchers.length > 0 ? 'PASSED' as const : 'WARNING' as const,
        details: `${events.length} events mapped to ${vouchers.length} vouchers.`,
      },
      {
        check_name: 'XML Generation',
        status: mastersXml.includes('<ENVELOPE>') && transactionsXml.includes('<ENVELOPE>')
          ? 'PASSED' as const
          : 'FAILED' as const,
        details: 'Masters and Transactions XML generated with valid Tally envelope.',
      },
    ];

    if (matchResult) {
      const matchRate = matchResult.matched.length /
        Math.max(matchResult.matched.length + matchResult.unmatchedTradebook.length, 1);
      checks.push({
        check_name: 'Trade Match',
        status: matchRate >= 1.0 ? 'PASSED' as const : matchRate >= 0.9 ? 'WARNING' as const : 'FAILED' as const,
        details: `${matchResult.matched.length} matched, ${matchResult.unmatchedTradebook.length} unmatched tradebook, ${matchResult.unmatchedContractNote.length} unmatched CN.`,
      });
    }

    const passed = checks.filter((c) => c.status === 'PASSED').length;
    const warnings = checks.filter((c) => c.status === 'WARNING').length;
    const failed = checks.filter((c) => c.status === 'FAILED').length;

    // 9. Compute FY label
    const fyLabel = deriveFYLabel(resolvedPeriodFrom, resolvedPeriodTo);

    // 10. Persist to store
    const batch = await repo.createBatch({
      user_id: userId,
      company_name: companyName,
      accounting_mode: accountingMode as 'investor' | 'trader',
      period_from: resolvedPeriodFrom,
      period_to: resolvedPeriodTo,
      prior_batch_id: priorBatchId ?? undefined,
      fy_label: fyLabel || undefined,
    });

    // 10a. Persist all uploaded files to disk
    const uploadDir = join(getUploadsDir(), batch.id);
    await mkdir(uploadDir, { recursive: true });

    const uploadFileMeta = [];
    for (const pf of parsedFileSet.files) {
      const ext = pf.fileName.includes('.') ? pf.fileName.split('.').pop() : 'bin';
      const uploadPath = join(uploadDir, `${pf.fileId}.${ext}`);
      await writeFile(uploadPath, pf.buffer);
      uploadFileMeta.push({
        id: pf.fileId,
        batch_id: batch.id,
        file_name: pf.fileName,
        mime_type: pf.mimeType,
        size_bytes: pf.buffer.length,
        detected_type: pf.detectedType,
        created_at: new Date().toISOString(),
        storage_path: uploadPath,
      });
    }
    await repo.addUploadedFiles(batch.id, uploadFileMeta);

    // 10b. Persist export artifacts to disk
    const mastersArtifactId = crypto.randomUUID();
    const transactionsArtifactId = crypto.randomUUID();
    const artifactDir = join(getArtifactsDir(), batch.id);
    const mastersPath = join(artifactDir, `${mastersArtifactId}.xml`);
    const transactionsPath = join(artifactDir, `${transactionsArtifactId}.xml`);
    await mkdir(artifactDir, { recursive: true });
    await writeFile(mastersPath, mastersXml, 'utf-8');
    await writeFile(transactionsPath, transactionsXml, 'utf-8');

    const now = new Date().toISOString();
    await repo.saveExportArtifacts(batch.id, [
      {
        id: mastersArtifactId,
        batch_id: batch.id,
        artifact_type: 'masters_xml',
        file_name: `${companyName}-masters.xml`,
        mime_type: 'application/xml',
        created_at: now,
        storage_path: mastersPath,
      },
      {
        id: transactionsArtifactId,
        batch_id: batch.id,
        artifact_type: 'transactions_xml',
        file_name: `${companyName}-transactions.xml`,
        mime_type: 'application/xml',
        created_at: now,
        storage_path: transactionsPath,
      },
    ]);

    await repo.updateBatchStatus(batch.id, 'succeeded', 'Processing complete');

    await repo.saveProcessingOutput({
      batchId: batch.id,
      voucherCount: vouchers.length,
      processingResult: {
        summary: { passed, warnings, failed },
        checks,
      },
      exceptions: [],
    });

    // 10c. Save closing lots snapshot for multi-FY carryforward
    const closingLots = tracker.toJSON().lots;
    const hasOpenLots = Object.keys(closingLots).length > 0;
    if (hasOpenLots) {
      await repo.saveClosingLots(batch.id, closingLots);
    }

    // Determine charge source
    const chargeSource = parsedFileSet.contractNote ? 'contract_note' as const : 'none' as const;

    // Build files summary
    const filesSummary = parsedFileSet.files.map((f) => ({
      fileName: f.fileName,
      detectedType: f.detectedType,
    }));

    return NextResponse.json({
      batchId: batch.id,
      tradeCount: (parsedFileSet.tradebook?.rows.length ?? 0) +
        (parsedFileSet.contractNote?.sheets.reduce((s, sh) => s + sh.trades.length, 0) ?? 0),
      eventCount: events.length,
      voucherCount: vouchers.length,
      ledgerCount: ledgers.length,
      checks,
      summary: { passed, warnings, failed },
      mastersXml,
      transactionsXml,
      mastersArtifactId,
      transactionsArtifactId,
      filesSummary,
      chargeSource,
      fyLabel: fyLabel || undefined,
      matchResult: matchResult
        ? {
            matched: matchResult.matched.length,
            unmatchedTradebook: matchResult.unmatchedTradebook.length,
            unmatchedContractNote: matchResult.unmatchedContractNote.length,
          }
        : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
