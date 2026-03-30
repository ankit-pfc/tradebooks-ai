import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { rateLimit } from '@/lib/rate-limit';
import { runProcessingPipeline } from '@/lib/processing/pipeline';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
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

    // Verify all uploaded files are ready
    const files = await repo.getFilesByBatch(batchId);
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files uploaded to this batch' },
        { status: 409 },
      );
    }
    const notReady = files.filter((f) => f.status !== 'uploaded');
    if (notReady.length > 0) {
      return NextResponse.json(
        {
          error: `${notReady.length} file(s) are not ready: ${notReady.map((f) => `${f.file_name} (${f.status})`).join(', ')}`,
        },
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
      files.map(async (f) => {
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
        files: pipelineFiles,
      });
    } catch (pipelineErr) {
      const msg = pipelineErr instanceof Error ? pipelineErr.message : 'Processing failed';
      await repo.updateBatchStatus(batchId, 'failed', msg);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({
      batchId,
      eventCount: result.eventCount,
      voucherCount: result.voucherCount,
      ledgerCount: result.ledgerCount,
      checks: result.checks,
      summary: result.summary,
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
