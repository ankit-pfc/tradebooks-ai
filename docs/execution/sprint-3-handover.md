# Sprint 3 Handover — Frontend: Two-Phase Upload UI

**Date:** 2026-03-30
**Depends on:** Sprint 1 (schema + storage layer) + Sprint 2 (API endpoints)
**Branch:** build on current `main`

---

## What Sprints 1 & 2 Built

Sprint 1 delivered: `BatchFileStatus` type, `content_hash`/`status`/`error_message`/`uploaded_at` on `BatchFileMeta`, `'uploading'` in `AppBatchStatus`, `FileStorage` interface + implementations at `src/lib/storage/file-storage.ts`, and per-file repo methods (`updateFileStatus`, `getFilesByBatch`, `deleteFile`, `findDuplicateFile`).

Sprint 2 delivered the four new REST endpoints and extracted the processing pipeline:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/batches` | Create batch (status `uploading`). Body: `{ companyName, accountingMode, periodFrom?, periodTo?, priorBatchId? }`. Returns `{ batchId, status }`. |
| `POST /api/batches/[batchId]/files` | Upload single file. Header: `X-Content-Hash: <sha256-hex>`. Body: FormData `file` field. Returns `{ fileId, fileName, detectedType, sizeBytes, status, duplicateWarning? }`. On storage failure: returns `status: 'failed'` (retryable). |
| `DELETE /api/batches/[batchId]/files/[fileId]` | Remove file before processing. Returns 204. Only allowed when batch is `uploading`. |
| `POST /api/batches/[batchId]/process` | Trigger processing. Returns `{ batchId, eventCount, voucherCount, ledgerCount, checks, summary, mastersArtifactId, transactionsArtifactId, filesSummary, chargeSource, fyLabel?, matchResult? }`. |

The old `POST /api/process` (multipart, one-shot) is still alive for backward compat.

---

## Current State of Upload Page

**File:** `src/app/(app)/upload/page.tsx` — 4-step wizard, `"use client"`, ~500 lines.

**Step 1 — Configure:** Company name, accounting mode, FY date picker, prior batch selector. Already wired to `GET /api/batches/prior`.

**Step 2 — Upload Files:** `<FileDropzone>` adds files to local React state. File type detection is client-side by filename only (heuristic, not server-authoritative). No per-file status indicators. "Process Files" button posts all files at once to `POST /api/process` as FormData.

**Step 3 — Processing:** Animated fake timers (`setTimeout`) advancing through 5 hardcoded steps (`parse`, `events`, `vouchers`, `reconcile`, `xml`). Not connected to real backend status.

**Step 4 — Results:** Shows real response from `/api/process` (checks, XML download buttons, counts).

---

## Sprint 3 Work Items

### 3A. Upload Hook — `src/hooks/use-batch-upload.ts` (new)

Custom React hook that encapsulates the two-phase flow. This is the main logic unit — the page becomes a thin consumer.

```typescript
interface FileUploadState {
  fileId: string | null;
  file: File;
  status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  detectedType: string | null;
  sizeBytes: number;
  errorMessage: string | null;
  duplicateWarning: { batchId: string; fileName: string } | null;
}

interface BatchUploadState {
  batchId: string | null;
  batchStatus: 'idle' | 'uploading' | 'running' | 'succeeded' | 'failed';
  files: Map<string, FileUploadState>;  // keyed by File object identity (use file.name+file.size as key)
  error: string | null;
}

function useBatchUpload() {
  return {
    state: BatchUploadState,
    createBatch(config: { companyName: string; accountingMode: string; periodFrom?: string; periodTo?: string; priorBatchId?: string }): Promise<void>,
    uploadFile(file: File): Promise<void>,   // uses batchId from state
    removeFile(file: File): Promise<void>,
    retryFile(file: File): Promise<void>,
    startProcessing(): Promise<ProcessingResult>,
    reset(): void,
  }
}
```

**Client-side SHA-256** (Web Crypto API, runs in browser):
```typescript
async function computeHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

**uploadFile flow inside hook:**
1. Set file state `status: 'uploading'`
2. `const hash = await computeHash(file)`
3. Build FormData with `file` field
4. `fetch('POST /api/batches/${batchId}/files', { headers: { 'X-Content-Hash': hash }, body: formData })`
5. On success: update file state with `fileId`, `detectedType`, `status: 'uploaded'`, `duplicateWarning?`
6. On error or `status: 'failed'` response: set `status: 'failed'`, `errorMessage`

**startProcessing flow inside hook:**
1. Set batchStatus `'running'`
2. `fetch('POST /api/batches/${batchId}/process')`
3. On success: set batchStatus `'succeeded'`, return result
4. On error: set batchStatus `'failed'`, throw

---

### 3B. Upload Page Refactor — `src/app/(app)/upload/page.tsx`

**Step 2 changes:**
- Replace `UploadedFile[]` local state with `useBatchUpload()`
- On entering Step 2: call `createBatch(formConfig)` immediately (optimistic batch creation)
- As each file is dropped: call `uploadFile(file)` immediately (don't wait for "Process" button)
- Show `<FileUploadStatus>` component per file instead of static file cards
- "Process Files" button: enabled only when `state.batchStatus === 'uploading'` AND all files have `status: 'uploaded'` (no `pending` or `failed` files)
- Show a "all files uploaded" confirmation before enabling the button

**Step 3 changes:**
- Remove all fake `setTimeout` timers (`INITIAL_STEPS` simulation)
- Call `startProcessing()` from hook when user clicks "Process Files"
- Show a single spinner + "Processing your files…" message while `batchStatus === 'running'`
- On error: show error message + "Try again" button (retry processing, not re-upload)

**Step 4** — no structural changes needed; already renders from real API response.

**Back-navigation guard:** If user is on Step 2 with a `batchId` and goes back to Step 1, call `reset()` on the hook (batchId is abandoned — no cleanup needed server-side, orphan batches will be cleaned up later).

---

### 3C. Per-File Status Component — `src/components/upload/file-upload-status.tsx` (new)

Renders one file's upload state inline. Used as a list item inside Step 2.

```typescript
interface FileUploadStatusProps {
  fileName: string;
  sizeBytes: number;
  status: FileUploadState['status'];
  detectedType: string | null;
  errorMessage: string | null;
  duplicateWarning: { batchId: string; fileName: string } | null;
  onRemove?: () => void;
  onRetry?: () => void;
}
```

**Visual states:**
- `pending`: gray spinner + filename + size
- `uploading`: animated spinner + "Uploading…"
- `uploaded`: green check + detected type badge + size + X button (calls `onRemove`)
- `failed`: red X icon + truncated error message + "Retry" button (calls `onRetry`)
- `duplicateWarning` (shown alongside `uploaded`): amber badge "Duplicate detected in another batch"

Reuse the existing `FILE_TYPE_BADGE` color map from `upload/page.tsx` — move it to this component or a shared constant.

---

## Tests (required by CLAUDE.md TDD rules)

**`src/hooks/use-batch-upload.test.ts`** — test with `renderHook` from `@testing-library/react`:
1. `createBatch` sets `batchId` and `batchStatus: 'uploading'`
2. `uploadFile` transitions file from `pending` → `uploading` → `uploaded`
3. `uploadFile` sets `status: 'failed'` when fetch returns `status: 'failed'`
4. `removeFile` removes file from state map
5. `startProcessing` sets batchStatus `'running'` → `'succeeded'` on success
6. `startProcessing` sets batchStatus `'failed'` on error

Mock `fetch` with `vi.fn()`. Do not make real network calls.

**`src/components/upload/file-upload-status.test.tsx`** — test with `@testing-library/react`:
1. Renders filename and size for all states
2. Shows spinner for `uploading`
3. Shows green check + detected type for `uploaded`
4. Shows "Retry" button for `failed`; clicking calls `onRetry`
5. Shows amber duplicate warning when `duplicateWarning` is set
6. X button calls `onRemove`

---

## Key Patterns from Existing Codebase

- `src/app/(app)/upload/page.tsx` — existing page to refactor; study the existing Step 1 form data structure and `PriorBatch` fetch pattern
- `src/components/upload/file-dropzone.tsx` — existing dropzone component; keep its interface, just handle the returned `File[]` differently
- Existing UI primitives: `Button`, `Card`, `Progress`, `Label` from `@/components/ui/*` — keep using these
- State updates in `useBatchUpload` should use `useReducer` or `useState` with functional updates to avoid stale closure issues in concurrent uploads

---

## Acceptance Criteria

- [ ] Dropping 3 files shows each file uploading independently with per-file status
- [ ] A failed file shows error + Retry; retrying re-uploads just that file
- [ ] Duplicate file shows amber warning but upload still succeeds
- [ ] "Process Files" button is disabled until all files are `uploaded`
- [ ] Step 3 shows real processing spinner (no fake timers)
- [ ] Step 4 shows real results — same as today
- [ ] `npm run build && npm run lint && npm run test:run` all pass

## Open Questions for Sprint 3 Agent

- Should `createBatch` happen on entering Step 2, or on first file drop? (Recommendation: on entering Step 2, so the batchId is ready before any drop.)
- If the user drops 4 files simultaneously, should uploads be sequential or parallel? (Recommendation: parallel — each `uploadFile` call is independent.)
