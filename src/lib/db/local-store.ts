import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
    BatchDetail,
    BatchException,
    BatchFileMeta,
    BatchProcessingResult,
    BatchRecord,
    ExportArtifactRef,
} from '@/lib/types';
import type { CostLot } from '@/lib/types/events';

type PersistedBatch = BatchDetail & {
    uploaded_file_paths: Record<string, string>;
    exported_file_paths: Record<string, string>;
    closing_lots_snapshot?: Record<string, CostLot[]> | null;
};

interface AppState {
    batches: PersistedBatch[];
}

const DATA_DIR = process.env.DATA_PATH || join(process.cwd(), '.data');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const ARTIFACTS_DIR = join(DATA_DIR, 'artifacts');
const DB_FILE = join(DATA_DIR, 'store.json');

async function ensureStore(): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await mkdir(UPLOADS_DIR, { recursive: true });
    await mkdir(ARTIFACTS_DIR, { recursive: true });
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
        status: 'queued',
        status_message: null,
        file_count: 0,
        voucher_count: 0,
        created_at: now,
        updated_at: now,
        prior_batch_id: input.prior_batch_id ?? null,
        fy_label: input.fy_label ?? null,
        files: [],
        exceptions: [],
        exports: [],
        processing_result: null,
        uploaded_file_paths: {},
        exported_file_paths: {},
        closing_lots_snapshot: null,
    };
    state.batches.unshift(batch);
    await writeState(state);
    return batch;
}

export async function listBatches(): Promise<BatchRecord[]> {
    const state = await readState();
    return state.batches.map(
        ({ uploaded_file_paths: _u, exported_file_paths: _e, ...rest }) => rest,
    );
}

export async function getBatch(batchId: string): Promise<PersistedBatch | null> {
    const state = await readState();
    return state.batches.find((b) => b.id === batchId) ?? null;
}

export function toPublicBatchDetail(batch: PersistedBatch): BatchDetail {
    const { uploaded_file_paths: _u, exported_file_paths: _e, ...rest } = batch;
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
        const { storage_path, ...meta } = f;
        batch.files.push(meta);
        batch.uploaded_file_paths[meta.id] = storage_path;
    }
    batch.file_count = batch.files.length;
    batch.updated_at = new Date().toISOString();
    await writeState(state);
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

export async function saveExportArtifacts(
    batchId: string,
    artifacts: Array<ExportArtifactRef & { storage_path: string }>,
): Promise<void> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return;
    batch.exports = artifacts.map(({ storage_path: _s, ...artifact }) => artifact);
    for (const artifact of artifacts) {
        batch.exported_file_paths[artifact.id] = artifact.storage_path;
    }
    batch.updated_at = new Date().toISOString();
    await writeState(state);
}

export async function getArtifactPath(
    batchId: string,
    artifactId: string,
): Promise<string | null> {
    const state = await readState();
    const batch = state.batches.find((b) => b.id === batchId);
    if (!batch) return null;
    return batch.exported_file_paths[artifactId] ?? null;
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

export function getArtifactsDir(): string {
    return ARTIFACTS_DIR;
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
        .map(({ uploaded_file_paths: _u, exported_file_paths: _e, closing_lots_snapshot: _c, ...rest }) => rest);
}
