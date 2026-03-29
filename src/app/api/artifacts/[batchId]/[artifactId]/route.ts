import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { NextResponse } from 'next/server';
import { getBatchRepository } from '@/lib/db';

const CONTENT_TYPES: Record<string, string> = {
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.csv': 'text/csv',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string; artifactId: string }> },
) {
  try {
    const { batchId, artifactId } = await params;
    const repo = getBatchRepository();
    const filePath = await repo.resolveArtifactPath(batchId, artifactId);

    if (!filePath) {
      return NextResponse.json(
        { error: `Artifact not found: ${artifactId}` },
        { status: 404 },
      );
    }

    // Supabase store returns a signed URL; redirect instead of reading from disk
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return NextResponse.redirect(filePath, 307);
    }

    const content = await readFile(filePath, 'utf-8');
    const ext = extname(filePath);
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    const fileName = `${artifactId}${ext}`;

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to download artifact';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
