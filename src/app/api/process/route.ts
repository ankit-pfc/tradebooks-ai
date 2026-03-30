import { NextRequest, NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { parseTradebook } from '@/lib/parsers/zerodha/tradebook';
import { parseContractNotes } from '@/lib/parsers/zerodha/contract-notes';
import { parseFundsStatement } from '@/lib/parsers/zerodha/funds-statement';
import { parseDividends } from '@/lib/parsers/zerodha/dividends';
import { deriveFYLabel } from '@/lib/engine/accounting-policy';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { rateLimit } from '@/lib/rate-limit';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/lib/upload-constants';
import { runProcessingPipeline, type PipelineFileInput } from '@/lib/processing/pipeline';
import type { BatchFileType } from '@/lib/types/domain';

// ---------------------------------------------------------------------------
// Route handler — legacy one-shot upload + process
// Kept for backward compatibility. New code should use the two-phase flow:
//   POST /api/batches → POST /api/batches/:id/files → POST /api/batches/:id/process
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 uploads per hour per user
    const rl = rateLimit(`upload:${userId}`, { interval: 60 * 60 * 1000, limit: 10 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429 },
      );
    }

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
    const uploadFiles: File[] =
      rawFiles.length > 0 ? rawFiles : singleFile ? [singleFile] : [];

    if (uploadFiles.length === 0) {
      return NextResponse.json(
        { error: 'At least one file is required' },
        { status: 400 },
      );
    }

    // File size and MIME type validation
    for (const file of uploadFiles) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds the 50MB size limit` },
          { status: 400 },
        );
      }
      if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: `File "${file.name}" has unsupported type: ${file.type}` },
          { status: 400 },
        );
      }
    }

    // Read all file buffers
    const pipelineFiles: PipelineFileInput[] = await Promise.all(
      uploadFiles.map(async (file) => ({
        fileId: crypto.randomUUID(),
        fileName: file.name,
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType: file.type || 'application/octet-stream',
      })),
    );

    // Resolve period dates — from form data or from file metadata (quick parse)
    let resolvedPeriodFrom = periodFrom ?? '';
    let resolvedPeriodTo = periodTo ?? '';

    if (!resolvedPeriodFrom || !resolvedPeriodTo) {
      type DateRange = { from: string; to: string };
      const metadataRanges: DateRange[] = [];

      for (const f of pipelineFiles) {
        const detectedType = detectFileType(f.buffer, f.fileName) as BatchFileType;
        let range: DateRange | undefined | null;
        if (detectedType === 'tradebook') {
          range = parseTradebook(f.buffer, f.fileName).metadata.date_range;
        } else if (detectedType === 'contract_note') {
          range = parseContractNotes(f.buffer, f.fileName).metadata.date_range;
        } else if (detectedType === 'funds_statement') {
          range = parseFundsStatement(f.buffer, f.fileName).metadata.date_range;
        } else if (detectedType === 'dividends') {
          range = parseDividends(f.buffer, f.fileName).metadata.date_range;
        }
        if (range) metadataRanges.push(range);
      }

      if (metadataRanges.length > 0) {
        resolvedPeriodFrom =
          resolvedPeriodFrom ||
          metadataRanges.reduce(
            (min, r) => (r.from < min ? r.from : min),
            metadataRanges[0].from,
          );
        resolvedPeriodTo =
          resolvedPeriodTo ||
          metadataRanges.reduce(
            (max, r) => (r.to > max ? r.to : max),
            metadataRanges[0].to,
          );
      }
    }

    if (!resolvedPeriodFrom || !resolvedPeriodTo) {
      return NextResponse.json(
        {
          error:
            'Could not determine period dates. Please provide periodFrom and periodTo.',
        },
        { status: 400 },
      );
    }

    const fyLabel = deriveFYLabel(resolvedPeriodFrom, resolvedPeriodTo);
    const repo = getBatchRepository();

    // Create batch record
    const batch = await repo.createBatch({
      user_id: userId,
      company_name: companyName,
      accounting_mode: accountingMode as 'investor' | 'trader',
      period_from: resolvedPeriodFrom,
      period_to: resolvedPeriodTo,
      prior_batch_id: priorBatchId ?? undefined,
      fy_label: fyLabel || undefined,
    });

    // Persist uploaded files to storage and register in batch_files
    const storage = getFileStorage();
    const now = new Date().toISOString();
    const uploadedFileMeta = await Promise.all(
      pipelineFiles.map(async (f) => {
        const ext = f.fileName.includes('.') ? f.fileName.split('.').pop()! : 'bin';
        const detectedType = detectFileType(f.buffer, f.fileName) as BatchFileType;
        let storagePath = '';
        let fileStatus: 'uploaded' | 'failed' = 'uploaded';
        try {
          storagePath = await storage.upload(userId, batch.id, f.fileId, ext, f.buffer);
        } catch {
          fileStatus = 'failed';
        }
        return {
          id: f.fileId,
          batch_id: batch.id,
          file_name: f.fileName,
          mime_type: f.mimeType,
          size_bytes: f.buffer.length,
          detected_type: detectedType,
          status: fileStatus,
          content_hash: null as string | null,
          error_message: null as string | null,
          uploaded_at: fileStatus === 'uploaded' ? now : null,
          created_at: now,
          storage_path: storagePath,
        };
      }),
    );
    await repo.addUploadedFiles(batch.id, uploadedFileMeta);

    // Run the shared pipeline
    let result;
    try {
      result = await runProcessingPipeline({
        userId,
        batchId: batch.id,
        companyName,
        accountingMode: accountingMode as 'investor' | 'trader',
        periodFrom: resolvedPeriodFrom,
        periodTo: resolvedPeriodTo,
        priorBatchId: priorBatchId ?? undefined,
        files: pipelineFiles,
      });
    } catch (pipelineErr) {
      const msg =
        pipelineErr instanceof Error ? pipelineErr.message : 'Processing failed';
      await repo.updateBatchStatus(batch.id, 'failed', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      batchId: batch.id,
      tradeCount: result.tradeCount,
      eventCount: result.eventCount,
      voucherCount: result.voucherCount,
      ledgerCount: result.ledgerCount,
      checks: result.checks,
      summary: result.summary,
      mastersXml: result.mastersXml,
      transactionsXml: result.transactionsXml,
      mastersArtifactId: result.mastersArtifactId,
      transactionsArtifactId: result.transactionsArtifactId,
      filesSummary: result.filesSummary,
      chargeSource: result.chargeSource,
      fyLabel: result.fyLabel,
      matchResult: result.matchResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown processing error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
