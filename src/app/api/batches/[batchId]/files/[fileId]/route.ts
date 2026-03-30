import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ batchId: string; fileId: string }> },
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { batchId, fileId } = await params;
    const repo = getBatchRepository();

    const batch = await repo.getBatch(batchId);
    if (!batch) {
      return NextResponse.json({ error: `Batch not found: ${batchId}` }, { status: 404 });
    }
    if (batch.user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (batch.status !== 'uploading') {
      return NextResponse.json(
        { error: 'Batch is not in uploading state' },
        { status: 409 },
      );
    }

    const files = await repo.getFilesByBatch(batchId);
    const file = files.find((f) => f.id === fileId);
    if (!file) {
      return NextResponse.json({ error: `File not found: ${fileId}` }, { status: 404 });
    }

    // Remove from storage (best-effort — don't fail if already gone)
    if (file.status === 'uploaded') {
      const storagePath = await repo.resolveUploadedFilePath(batchId, fileId);
      if (storagePath) {
        await getFileStorage().delete(storagePath).catch(() => undefined);
      }
    }

    await repo.deleteFile(batchId, fileId);

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
