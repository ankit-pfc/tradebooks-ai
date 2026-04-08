import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { rateLimit } from '@/lib/rate-limit';
import { runProcessingPipeline } from '@/lib/processing/pipeline';
import type { PurchaseMergeMode } from '@/lib/engine/voucher-merger';
import { TradeClassificationStrategy } from '@/lib/engine/trade-classifier';
import { isPipelineValidationError } from '@/lib/errors/pipeline-validation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const purchaseMergeMode: PurchaseMergeMode = 'same_rate';
    // Leave classificationStrategy undefined when the client does not pass one
    // so the pipeline can derive the right default from accountingMode
    // (investor → ASSUME_ALL_EQ_INVESTMENT, trader → HEURISTIC_SAME_DAY_FLAT_INTRADAY).
    // The previous default of STRICT_PRODUCT bypassed that logic and tripped
    // E_CLASSIFICATION_AMBIGUOUS for any tradebook/CN row without a product code.
    let classificationStrategy: TradeClassificationStrategy | undefined;

    try {
      const body = await request.json();
      const raw = body?.classificationStrategy;
      if (typeof raw === 'string' && Object.values(TradeClassificationStrategy).includes(raw as TradeClassificationStrategy)) {
        classificationStrategy = raw as TradeClassificationStrategy;
      } else if (raw !== undefined) {
        return NextResponse.json(
          {
            error: `Invalid classificationStrategy: ${String(raw)}`,
            code: 'E_INVALID_CLASSIFICATION_STRATEGY',
          },
          { status: 400 },
        );
      }
    } catch {
      // Empty body is allowed; pipeline picks the default from accountingMode.
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const repo = getBatchRepository();

    const batch = await repo.getBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: `Batch not found: ${batchId}` }, { status: 404 });
    }
    if (batch.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify files are ready — skip failed files, block only on in-flight ones
    const files = await repo.getFilesByBatch(batchId);
    const uploadedFiles = files.filter((f) => f.status === 'uploaded');
    const inFlight = files.filter((f) => f.status === 'pending' || f.status === 'uploading');

    if (inFlight.length > 0) {
      return NextResponse.json(
        {
          error: `${inFlight.length} file(s) are still uploading: ${inFlight.map((f) => f.file_name).join(', ')}`,
        },
        { status: 409 },
      );
    }
    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files successfully uploaded to this batch' },
        { status: 409 },
      );
    }

    // Rate limit: 10 processing jobs per hour per user
    const rl = rateLimit(`upload:${userId}`, { interval: 60 * 60 * 1000, limit: 10 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many uploads. Please try again later.' },
        { status: 429 },
      );
    }

    await repo.updateBatchStatus(batchId, 'running', null);

    // Download files from storage and verify checksums
    const storage = getFileStorage();
    const pipelineFiles = await Promise.all(
      uploadedFiles.map(async (f) => {
        const storagePath = await repo.resolveUploadedFilePath(batchId, f.id);
        if (!storagePath) throw new Error(`Storage path missing for file ${f.id}`);
        const buffer = await storage.download(storagePath);

        // Checksum verification — log but don't abort on mismatch
        if (f.content_hash) {
          const actualHash = createHash('sha256').update(buffer).digest('hex');
          if (actualHash !== f.content_hash) {
            console.warn(
              `[process] Checksum mismatch for file ${f.id}: expected ${f.content_hash}, got ${actualHash}`,
            );
          }
        }

        return {
          fileId: f.id,
          fileName: f.file_name,
          buffer,
          mimeType: f.mime_type,
        };
      }),
    );

    // TODO: corporate actions temporarily disabled — re-enable when unblocked
    // const corporateActions = await repo.getCorporateActions(batchId);
    const corporateActions: import('@/lib/parsers/zerodha/types').CorporateActionInput[] = [];

    let result;
    try {
      result = await runProcessingPipeline({
        userId,
        batchId,
        companyName: batch.company_name,
        accountingMode: batch.accounting_mode,
        periodFrom: batch.period_from,
        periodTo: batch.period_to,
        priorBatchId: batch.prior_batch_id ?? undefined,
        purchaseMergeMode,
        classificationStrategy,
        corporateActions,
        files: pipelineFiles,
      });
    } catch (pipelineErr) {
      if (isPipelineValidationError(pipelineErr)) {
        await repo.updateBatchStatus(batchId, 'failed', pipelineErr.message);
        return NextResponse.json(
          { error: pipelineErr.message, code: pipelineErr.code, details: pipelineErr.details },
          { status: 422 },
        );
      }

      const msg = pipelineErr instanceof Error ? pipelineErr.message : 'Processing failed';
      await repo.updateBatchStatus(batchId, 'failed', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      batchId,
      tradeCount: result.tradeCount,
      eventCount: result.eventCount,
      voucherCount: result.voucherCount,
      ledgerCount: result.ledgerCount,
      checks: result.checks,
      summary: result.summary,
      mastersXml: result.mastersXml,
      transactionsXml: result.transactionsXml,
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
