import { gzipSync, gunzipSync } from 'node:zlib';
import type { TraceBundle } from './types';

/**
 * Storage path for a per-batch trace bundle. The leading `_trace/` namespace
 * keeps these out of any user-facing file listings and makes the entire
 * feature deletable with a single `supabase storage rm -r _trace` later.
 */
export function traceStoragePath(batchId: string): string {
  return `_trace/${batchId}.json.gz`;
}

/** Persist a trace bundle as gzipped JSON. Best-effort: never throws. */
export async function persistTrace(bundle: TraceBundle): Promise<{
  ok: boolean;
  path: string;
  error?: string;
}> {
  const path = traceStoragePath(bundle.batchId);
  try {
    const json = JSON.stringify(bundle);
    const compressed = gzipSync(Buffer.from(json, 'utf-8'));
    await rawUpload(path, compressed);
    return { ok: true, path };
  } catch (err) {
    return {
      ok: false,
      path,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Load and decompress a trace bundle. Returns null when missing. */
export async function loadTrace(batchId: string): Promise<TraceBundle | null> {
  const path = traceStoragePath(batchId);
  try {
    const buf = await rawDownload(path);
    if (!buf) return null;
    const json = gunzipSync(buf).toString('utf-8');
    return JSON.parse(json) as TraceBundle;
  } catch {
    return null;
  }
}

async function rawDownload(path: string): Promise<Buffer | null> {
  if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { data, error } = await supabase.storage.from('uploads').download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
  const { readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dataDir = process.env.DATA_PATH || join(tmpdir(), 'tradebooks-data');
  const full = join(dataDir, 'uploads', path);
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

/**
 * Direct upload that bypasses the `userId/batchId/fileId.ext` path convention
 * the public FileStorage interface assumes. Trace files live under a fixed
 * `_trace/` prefix that doesn't fit that schema.
 */
async function rawUpload(path: string, buffer: Buffer): Promise<void> {
  if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from('uploads')
      .upload(path, buffer, {
        contentType: 'application/gzip',
        upsert: true,
      });
    if (error) throw new Error(error.message);
    return;
  }

  // Local fallback — write under DATA_PATH/uploads to mirror file-storage.ts
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, dirname } = await import('node:path');
  const dataDir = process.env.DATA_PATH || join(tmpdir(), 'tradebooks-data');
  const full = join(dataDir, 'uploads', path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buffer);
}
