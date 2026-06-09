import { NextResponse } from 'next/server';
import {
  getBatchRepository,
  getLedgerRepository,
  getSettingsRepository,
  getStockItemRepository,
  getStockMappingRepository,
} from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { buildTallyMappingPreview } from '@/lib/processing/tally-mapping-preview';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId } = await params;
    const batchRepo = getBatchRepository();
    const batch = await batchRepo.getBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: `Batch not found: ${batchId}` }, { status: 404 });
    }
    if (batch.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const batchFiles = await batchRepo.getFilesByBatch(batchId);
    const uploadedFiles = batchFiles.filter((file) => file.status === 'uploaded');
    const inFlight = batchFiles.filter(
      (file) => file.status === 'pending' || file.status === 'uploading',
    );

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

    const storage = getFileStorage();
    const files = await Promise.all(
      uploadedFiles.map(async (file) => {
        const storagePath = await batchRepo.resolveUploadedFilePath(batchId, file.id);
        if (!storagePath) throw new Error(`Storage path missing for file ${file.id}`);
        return {
          fileName: file.file_name,
          buffer: await storage.download(storagePath),
          detectedType: file.detected_type,
        };
      }),
    );

    const [settings, ledgerOverrides, stockItems, securityMappings] = await Promise.all([
      getSettingsRepository().getSettings(userId),
      getLedgerRepository().listOverrides(userId),
      getStockItemRepository().listStockItems(userId),
      getStockMappingRepository().listMappings(userId),
    ]);

    const preview = buildTallyMappingPreview({
      files,
      settings,
      accountingMode: batch.accounting_mode,
      ledgerOverrides,
      stockItems,
      securityMappings,
    });

    return NextResponse.json(preview);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build Tally mapping preview';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
