# Robust Batch Upload System

## Context

Currently, the entire upload + processing pipeline is a single synchronous `POST /api/process` request. Files are held in memory, written to local disk (even in prod), and if anything fails the whole batch fails with no recovery. Users uploading multiple files (tradebook, contract notes, funds statement, dividends) have zero per-file visibility and no retry capability.

**Goal**: Split upload from processing, add per-file lifecycle tracking, wire up Supabase Storage for production, and make every failure recoverable.

---

## Architecture: Two-Phase Split

### Phase 1 — Upload
- `POST /api/batches` → create batch record (status: `uploading`)
- `POST /api/batches/[batchId]/files` → upload individual files, one at a time
  - Server validates size/MIME, computes SHA-256, runs `detectFileType()`, uploads to Supabase Storage
  - Each file gets its own `batch_files` row with `status: uploaded | failed`
  - Returns `{ fileId, detectedType, status }` per file
- `DELETE /api/batches/[batchId]/files/[fileId]` → remove a file before processing
- Client-side SHA-256 via Web Crypto API, sent in header for server verification

### Phase 2 — Processing
- `POST /api/batches/[batchId]/process` → trigger processing
  - Validates all files are in `uploaded` status
  - Downloads files from Supabase Storage (not local disk)
  - Runs existing pipeline: parse → events → vouchers → XML → reconciliation
  - Updates batch status: `uploading → running → succeeded | failed | needs_review`
- Processing logic extracted from monolithic route into `src/lib/processing/pipeline.ts`

### Legacy Compat
- Keep existing `POST /api/process` working — refactored to call the extracted pipeline internally
- No breaking changes to existing batch data

---

## Sprint 1: Schema + Storage Layer

### 1A. Database Migration
**File**: `supabase/migrations/2026XXXX_robust_uploads.sql`

```sql
-- Extend batch status enum
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('uploading','queued','running','succeeded','failed','needs_review'));

-- Add per-file status tracking to batch_files
ALTER TABLE batch_files ADD COLUMN status TEXT NOT NULL DEFAULT 'uploaded'
  CHECK (status IN ('pending','uploading','uploaded','failed','processing','processed'));
ALTER TABLE batch_files ADD COLUMN content_hash TEXT;       -- SHA-256 hex
ALTER TABLE batch_files ADD COLUMN error_message TEXT;      -- failure reason
ALTER TABLE batch_files ADD COLUMN uploaded_at TIMESTAMPTZ; -- when upload completed

-- Index for dedup lookups
CREATE INDEX idx_batch_files_content_hash ON batch_files(content_hash) WHERE content_hash IS NOT NULL;
```

### 1B. Domain Type Updates
**File**: `src/lib/types/domain.ts`

- Add `BatchFileStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'processing' | 'processed'`
- Add `content_hash`, `status`, `error_message`, `uploaded_at` to `BatchFileMeta`
- Add `'uploading'` to `AppBatchStatus`

### 1C. Storage Abstraction
**File**: `src/lib/storage/file-storage.ts` (new)

```typescript
interface FileStorage {
  upload(userId: string, batchId: string, fileId: string, ext: string, buffer: Buffer): Promise<string>; // returns storage_path
  download(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  getSignedUrl(storagePath: string, expirySeconds?: number): Promise<string>;
}
```

Two implementations:
- `SupabaseFileStorage` — uses `supabase.storage.from('uploads')` with path `{userId}/{batchId}/{fileId}.{ext}`
- `LocalFileStorage` — uses local disk (dev fallback)

Selection via `getFileStorage()` using same env-var pattern as `getBatchRepository()`.

### 1D. Repository Updates
**File**: `src/lib/db/repository.ts`

Add methods:
- `updateFileStatus(fileId: string, status: BatchFileStatus, errorMessage?: string): Promise<void>`
- `getFilesByBatch(batchId: string): Promise<BatchFileMeta[]>`
- `deleteFile(batchId: string, fileId: string): Promise<void>`
- `findDuplicateFile(userId: string, contentHash: string): Promise<{batchId: string, fileName: string} | null>`

Implement in both `supabase-store.ts` and `local-store.ts`.

---

## Sprint 2: API Endpoints

### 2A. Create Batch Endpoint
**File**: `src/app/api/batches/create/route.ts` (new)

```
POST /api/batches
Body: { companyName, accountingMode, periodFrom?, periodTo?, priorBatchId? }
Response: { batchId, status: 'uploading' }
```

### 2B. Upload File Endpoint
**File**: `src/app/api/batches/[batchId]/files/route.ts` (new)

```
POST /api/batches/[batchId]/files
Headers: X-Content-Hash: <sha256-hex>
Body: FormData with single `file` field
Response: { fileId, fileName, detectedType, sizeBytes, status, duplicateWarning? }
```

Flow:
1. Auth check + verify batch belongs to user + batch status is `uploading`
2. Validate file size (50MB) and MIME type
3. Read buffer, compute SHA-256, compare with header hash
4. Run `detectFileType()` for classification
5. Upload to Supabase Storage via `FileStorage.upload()`
6. Insert `batch_files` row with status `uploaded`
7. Check `content_hash` for cross-batch deduplication — return warning if duplicate found
8. Return file metadata

Error handling: If storage upload fails, insert row with `status: failed` and `error_message`. Client can retry.

### 2C. Delete File Endpoint
**File**: `src/app/api/batches/[batchId]/files/[fileId]/route.ts` (new)

```
DELETE /api/batches/[batchId]/files/[fileId]
```
- Delete from storage + remove `batch_files` row
- Only allowed when batch status is `uploading`

### 2D. Trigger Processing Endpoint
**File**: `src/app/api/batches/[batchId]/process/route.ts` (new)

```
POST /api/batches/[batchId]/process
Response: { batchId, status, checks, summary, mastersArtifactId, transactionsArtifactId, ... }
```

Flow:
1. Verify all files have `status: uploaded`
2. Update batch status to `running`
3. Download each file from storage via `FileStorage.download()`
4. Verify SHA-256 matches stored `content_hash`
5. Call `runProcessingPipeline()` (extracted logic)
6. Save results, artifacts, exceptions
7. Update batch status

### 2E. Extract Processing Pipeline
**File**: `src/lib/processing/pipeline.ts` (new)

Extract lines 146-465 from `/api/process/route.ts` into:
```typescript
interface PipelineInput {
  userId: string;
  batchId: string;
  companyName: string;
  accountingMode: 'investor' | 'trader';
  periodFrom?: string;
  periodTo?: string;
  priorBatchId?: string;
  files: Array<{ fileId: string; fileName: string; buffer: Buffer; mimeType: string }>;
}

interface PipelineOutput {
  eventCount: number;
  voucherCount: number;
  ledgerCount: number;
  checks: Check[];
  summary: Summary;
  mastersArtifactId: string;
  transactionsArtifactId: string;
  filesSummary: FileSummary[];
  // ... rest of current response fields
}

async function runProcessingPipeline(input: PipelineInput): Promise<PipelineOutput>
```

Refactor existing `POST /api/process` to call this function (backward compat).

---

## Sprint 3: Frontend

### 3A. Upload Hook
**File**: `src/hooks/use-batch-upload.ts` (new)

Custom hook managing the two-phase flow:
```typescript
function useBatchUpload() {
  return {
    // Phase 1
    createBatch(config: BatchConfig): Promise<string>,
    uploadFile(batchId: string, file: File): Promise<FileUploadResult>,
    removeFile(batchId: string, fileId: string): Promise<void>,
    retryFile(batchId: string, file: File): Promise<FileUploadResult>,

    // Phase 2
    startProcessing(batchId: string): Promise<ProcessingResult>,

    // State
    files: Map<string, FileUploadState>,  // per-file status + progress
    batchStatus: BatchStatus,
    error: string | null,
  }
}
```

Client-side SHA-256 via Web Crypto API:
```typescript
async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 3B. Upload Page Refactor
**File**: `src/app/(app)/upload/page.tsx`

Key changes:
- Step 2 (Upload Files): Show per-file upload status with progress bars
  - Each file shows: name, detected type, size, status (uploading/uploaded/failed), retry button
  - Failed files show error message + retry button
  - "Process" button only enabled when all files are `uploaded`
- Step 3 (Processing): Real processing status (not faked timers)
- Add file removal (X button) before processing starts
- Show duplicate file warnings inline

### 3C. Per-File Status UI Component
**File**: `src/components/upload/file-upload-status.tsx` (new)

Shows individual file upload state:
- Uploading: progress spinner + file name
- Uploaded: green check + detected type badge + size
- Failed: red X + error message + retry button
- Duplicate warning: yellow badge

---

## Sprint 4: Resilience + Cleanup

### 4A. Orphan Cleanup
**File**: `src/lib/storage/cleanup.ts` (new)

- Function to find batches stuck in `uploading` status for >24 hours
- Delete their files from storage + mark batch as `failed`
- Can be called via a cron API route or manually

### 4B. Batch Retry
**File**: `src/app/api/batches/[batchId]/retry/route.ts` (new)

- Re-trigger processing on a `failed` batch
- Resets batch status to `running`, re-runs pipeline

### 4C. Tests
- Unit tests for `FileStorage` implementations
- Unit tests for `computeHash` and checksum verification
- Integration tests for upload → process flow
- Tests for error recovery (file upload failure, processing failure)

---

## File Change Summary

| File | Action |
|------|--------|
| `supabase/migrations/2026XXXX_robust_uploads.sql` | New — schema changes |
| `src/lib/types/domain.ts` | Edit — add BatchFileStatus, update types |
| `src/lib/storage/file-storage.ts` | New — storage abstraction |
| `src/lib/db/repository.ts` | Edit — add new methods |
| `src/lib/db/supabase-store.ts` | Edit — implement new methods |
| `src/lib/db/local-store.ts` | Edit — implement new methods |
| `src/lib/processing/pipeline.ts` | New — extracted pipeline logic |
| `src/app/api/process/route.ts` | Edit — refactor to use pipeline.ts |
| `src/app/api/batches/create/route.ts` | New — create batch endpoint |
| `src/app/api/batches/[batchId]/files/route.ts` | New — upload file endpoint |
| `src/app/api/batches/[batchId]/files/[fileId]/route.ts` | New — delete file endpoint |
| `src/app/api/batches/[batchId]/process/route.ts` | New — trigger processing |
| `src/app/api/batches/[batchId]/retry/route.ts` | New — retry failed batch |
| `src/hooks/use-batch-upload.ts` | New — upload hook |
| `src/components/upload/file-upload-status.tsx` | New — per-file status UI |
| `src/app/(app)/upload/page.tsx` | Edit — refactor to two-phase flow |
| `src/lib/storage/cleanup.ts` | New — orphan cleanup |

## Verification

1. Upload 3+ files of different types → each shows individual progress + detected type
2. Kill browser mid-upload → return and see uploaded files persisted, can upload remaining
3. Upload a corrupted file → see per-file error, retry with correct file, proceed
4. Upload duplicate file → see warning, choose to continue or replace
5. Trigger processing → see real progress, download XML artifacts
6. Legacy `POST /api/process` still works for any existing integrations
7. `npm run build`, `npm run lint`, `npm run test:run` all pass
