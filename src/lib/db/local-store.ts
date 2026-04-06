import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
    BatchDetail,
    BatchException,
    BatchFileMeta,
    BatchFileStatus,
    BatchProcessingResult,
    BatchRecord,
} from '@/lib/types';
import type { CostLot } from '@/lib/types/events';

type PersistedBatch = BatchDetail & {
    uploaded_file_paths: Record<string, string>;
    closing_lots_snapshot?: Record<string, CostLot[]> | null;
};

interface AppState {
    batches: PersistedBatch[];
}

const DATA_DIR = process.env.DATA_PATH || join(tmpdir(), 'tradebooks-data');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const DB_FILE = join(DATA_DIR, 'store.json');

async function ensureStore(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await mkdir(UPLOADS_DIR, { recursive: true });
    try {
        await readFile(DB_FILE, 'utf-8');
    } catch {
        const initial: AppState = { batches: [] };
        await writeFile(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    }
}

async function readState(): Promise<AppState> {
    await ensureStore();
    const raw = await readFile(DB_FILE, 'utf-8');
    return JSON.parse(raw) as AppState;
}

async function writeState(state: AppState): Promise<void> {
    await writeFile(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function createBatch(input: {
    user_id: string;
    company_name: string;
    accounting_mode: 'investor' | 'trader';
    period_from: string;
    period_to: string;
    prior_batch_id?: string;
    fy_label?: string;
}): Promise<PersistedBatch> {
    const state = await readState();
    const now = new Date().toISOString();
    const batch: PersistedBatch = {
        id: crypto.randomUUID(),
        user_id: input.user_id,
        company_name: input.company_name,
        accounting_mode: input.accounting_mode,
        period_from: input.period_from,
        period_to: input.period_to,
        status: 'uploading',
        status_message: null,
        file_count: 0,
        voucher_count: 0,
        created_at: now,
        updated_at: now,
        prior_batch_id: input.prior_batch_id ?? null,
        fy_label: input.fy_label ?? null,
        files: [],
        exceptions: [],
        processing_result: null,
        uploaded_file_paths: {},
        closing_lots_snapshot: null,
    };
    state.batches.unshift(batch);
    await writeState(state);
    return batch;
}

export async function listBatches(): Promise<BatchRecord[]> {
    const state = await readState();
    return state.batches.map(
        ({ uploaded_file_paths: _u, ...rest }) => rest,
    );
}

export async function getBatch(batchId: string): Promise<PersistedBatch | null> {
    const state = await readState();
    return state.batches.find((b) => b.id === batchId) ?? null;
}

export function toPublicBatchDetail(batch: PersistedBatch): BatchDetail {
    const { uploaded_file_paths: _u, ...rest } = batch;
    return rest;
}

export async function setBatchStatus(
    batchId: string,
    status: BatchRecord['status'],
    statusMessage: string | null,
): Promise<void> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return;
    batch.status = status;
    batch.status_message = statusMessage;
    batch.updated_at = new Date().toISOString();
    await writeState(state);
}

export async function addBatchFiles(
    batchId: string,
    files: Array<BatchFileMeta & { storage_path: string }>,
): Promise<void> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return;
    for (const f of files) {
        const { storage_path, ...fileMeta } = f;
        batch.files.push(fileMeta);
        batch.uploaded_file_paths[fileMeta.id] = storage_path;
    }
    batch.file_count = batch.files.length;
    batch.updated_at = new Date().toISOString();
    await writeState(state);
}

export async function updateFileStatus(
    fileId: string,
    status: BatchFileStatus,
    errorMessage?: string,
): Promise<void> {
    const state = await readState();
    for (const batch of state.batches) {
        const file = batch.files.find((f) => f.id === fileId);
        if (file) {
            file.status = status;
            file.error_message = errorMessage ?? null;
            if (status === 'uploaded') {
                file.uploaded_at = new Date().toISOString();
            }
            batch.updated_at = new Date().toISOString();
            await writeState(state);
            return;
        }
    }
}

export async function getFilesByBatch(batchId: string): Promise<BatchFileMeta[]> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return [];
    // Backfill defaults for files persisted before the robust-upload migration.
    // Object.assign puts defaults first; properties on f override them when present.
    return batch.files.map((f): BatchFileMeta =>
        Object.assign(
            {
                status: 'uploaded' as BatchFileStatus,
                content_hash: null as string | null,
                error_message: null as string | null,
                uploaded_at: null as string | null,
            },
            f,
        ),
    );
}

export async function deleteFile(batchId: string, fileId: string): Promise<void> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return;
    batch.files = batch.files.filter((f) => f.id !== fileId);
    delete batch.uploaded_file_paths[fileId];
    batch.file_count = batch.files.length;
    batch.updated_at = new Date().toISOString();
    await writeState(state);
}

export async function findDuplicateFile(
    userId: string,
    contentHash: string,
): Promise<{ batchId: string; fileName: string } | null> {
    const state = await readState();
    for (const batch of state.batches) {
        if (batch.user_id !== userId) continue;
        const match = batch.files.find((f) => f.content_hash === contentHash);
        if (match) return { batchId: batch.id, fileName: match.file_name };
    }
    return null;
}

export async function saveProcessingOutcome(params: {
    batchId: string;
    voucherCount: number;
    processingResult: BatchProcessingResult;
    exceptions: BatchException[];
}): Promise<void> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === params.batchId);
    if (!batch) return;
    batch.voucher_count = params.voucherCount;
    batch.processing_result = params.processingResult;
    batch.exceptions = params.exceptions;
    batch.status = params.exceptions.some((e) => e.severity === 'error')
        ? 'needs_review'
        : 'succeeded';
    batch.status_message = null;
    batch.updated_at = new Date().toISOString();
    await writeState(state);
}

export async function getUploadedFilePath(
    batchId: string,
    fileId: string,
): Promise<string | null> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return null;
    return batch.uploaded_file_paths[fileId] ?? null;
}

export async function listExceptions(): Promise<BatchException[]> {
    const state = await readState();
    return state.batches.flatMap((b) => b.exceptions);
}

export function getUploadsDir(): string {
    return UPLOADS_DIR;
}

export async function saveClosingLots(
    batchId: string,
    snapshot: Record<string, CostLot[]>,
): Promise<void> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return;
    batch.closing_lots_snapshot = snapshot;
    batch.updated_at = new Date().toISOString();
    await writeState(state);
}

export async function getClosingLots(
    batchId: string,
): Promise<Record<string, CostLot[]> | null> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return null;
    return batch.closing_lots_snapshot ?? null;
}

export async function listPriorBatches(
    userId: string,
    companyName: string,
): Promise<BatchRecord[]> {
    const state = await readState();
    return state.batches
        .filter(
            (b) =>
                b.user_id === userId &&
                b.company_name === companyName &&
                b.status === 'succeeded',
        )
        .sort((a, b) => b.period_to.localeCompare(a.period_to))
        .map(({ uploaded_file_paths: _u, closing_lots_snapshot: _c, ...rest }) => rest);
}
