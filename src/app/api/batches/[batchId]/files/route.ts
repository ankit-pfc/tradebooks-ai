import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';
import { getFileStorage } from '@/lib/storage/file-storage';
import { getAuthenticatedUserId } from '@/lib/supabase/auth-guard';
import { detectFileType } from '@/lib/parsers/zerodha/detect';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/lib/upload-constants';
import type { BatchFileType } from '@/lib/types/domain';

export async function POST(
  request: NextRequest,
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
    if (batch.status !== 'uploading') {
      return NextResponse.json(
        { error: 'Batch is not in uploading state' },
        { status: 409 },
      );
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const serverHash = createHash('sha256').update(buffer).digest('hex');
    const clientHash = request.headers.get('X-Content-Hash');
    if (clientHash && clientHash !== serverHash) {
      return NextResponse.json({ error: 'Content hash mismatch' }, { status: 400 });
    }

    const detectedType = detectFileType(buffer, file.name) as BatchFileType;
    const ext = file.name.includes('.') ? file.name.split('.').pop()! : 'bin';
    const fileId = crypto.randomUUID();
    const mimeType = file.type || 'application/octet-stream';
    const now = new Date().toISOString();

    let storagePath: string;
    let uploadStatus: 'uploaded' | 'failed' = 'uploaded';
    let errorMessage: string | null = null;

    try {
      storagePath = await getFileStorage().upload(userId, batchId, fileId, ext, buffer);
    } catch (storageErr) {
      uploadStatus = 'failed';
      errorMessage = storageErr instanceof Error ? storageErr.message : 'Storage upload failed';
      storagePath = '';
    }

    await repo.addUploadedFiles(batchId, [
      {
        id: fileId,
        batch_id: batchId,
        file_name: file.name,
        mime_type: mimeType,
        size_bytes: buffer.length,
        detected_type: detectedType,
        status: uploadStatus,
        content_hash: serverHash,
        error_message: errorMessage,
        uploaded_at: uploadStatus === 'uploaded' ? now : null,
        created_at: now,
        storage_path: storagePath,
      },
    ]);

    return NextResponse.json(
      {
        fileId,
        fileName: file.name,
        detectedType,
        sizeBytes: buffer.length,
        status: uploadStatus,
        ...(errorMessage ? { errorMessage } : {}),
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'File upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
