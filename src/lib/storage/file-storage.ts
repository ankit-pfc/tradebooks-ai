import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface FileStorage {
    /**
     * Upload a file buffer to storage.
     * Returns the canonical storage_path used for future retrieval.
     */
    upload(
        userId: string,
        batchId: string,
        fileId: string,
        ext: string,
        buffer: Buffer,
    ): Promise<string>;

    /** Download a file by its storage_path and return the buffer. */
    download(storagePath: string): Promise<Buffer>;

    /** Delete a file from storage by its storage_path. */
    delete(storagePath: string): Promise<void>;

    /**
     * Generate a time-limited signed URL for direct download.
     * Falls back to the storage_path itself for local storage.
     */
    getSignedUrl(storagePath: string, expirySeconds?: number): Promise<string>;
}

// ---------------------------------------------------------------------------
// Supabase implementation
// ---------------------------------------------------------------------------

const SIGNED_URL_EXPIRY_SECONDS = 3600;
const UPLOADS_BUCKET = 'uploads';

export const supabaseFileStorage: FileStorage = {
    async upload(userId, batchId, fileId, ext, buffer) {
        const supabase = await createClient();
        const storagePath = `${userId}/${batchId}/${fileId}.${ext}`;
        const { error } = await supabase.storage
            .from(UPLOADS_BUCKET)
            .upload(storagePath, buffer, {
                contentType: 'application/octet-stream',
                upsert: false,
            });
        if (error) throw new Error(`Supabase storage upload failed: ${error.message}`);
        return storagePath;
    },

    async download(storagePath) {
        const supabase = await createClient();
        const { data, error } = await supabase.storage
            .from(UPLOADS_BUCKET)
            .download(storagePath);
        if (error || !data) throw new Error(`Supabase storage download failed: ${error?.message}`);
        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
    },

    async delete(storagePath) {
        const supabase = await createClient();
        const { error } = await supabase.storage
            .from(UPLOADS_BUCKET)
            .remove([storagePath]);
        if (error) throw new Error(`Supabase storage delete failed: ${error.message}`);
    },

    async getSignedUrl(storagePath, expirySeconds = SIGNED_URL_EXPIRY_SECONDS) {
        const supabase = await createClient();
        const { data, error } = await supabase.storage
            .from(UPLOADS_BUCKET)
            .createSignedUrl(storagePath, expirySeconds);
        if (error || !data) throw new Error(`Supabase signed URL failed: ${error?.message}`);
        return data.signedUrl;
    },
};

// ---------------------------------------------------------------------------
// Local filesystem implementation (dev / no-Supabase fallback)
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.DATA_PATH || join(tmpdir(), 'tradebooks-data');
const LOCAL_UPLOADS_DIR = join(DATA_DIR, 'uploads');

export const localFileStorage: FileStorage = {
    async upload(userId, batchId, fileId, ext, buffer) {
        const dir = join(LOCAL_UPLOADS_DIR, userId, batchId);
        await mkdir(dir, { recursive: true });
        const storagePath = join(dir, `${fileId}.${ext}`);
        await writeFile(storagePath, buffer);
        return storagePath;
    },

    async download(storagePath) {
        return readFile(storagePath);
    },

    async delete(storagePath) {
        await unlink(storagePath).catch(() => {
            // Ignore ENOENT — already deleted is fine
        });
    },

    async getSignedUrl(storagePath) {
        // Local storage has no signed URLs — return the path directly
        return storagePath;
    },
};

// ---------------------------------------------------------------------------
// Factory — mirrors getBatchRepository() selector pattern
// ---------------------------------------------------------------------------

export function getFileStorage(): FileStorage {
    if (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) {
        return supabaseFileStorage;
    }
    return localFileStorage;
}
