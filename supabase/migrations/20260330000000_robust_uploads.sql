-- ---------------------------------------------------------------------------
-- Migration: Robust batch upload support
-- Adds per-file lifecycle tracking, content hashing, and 'uploading' batch status
-- ---------------------------------------------------------------------------

-- Extend batches status check to include 'uploading' (pre-processing phase)
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;
ALTER TABLE batches ADD CONSTRAINT batches_status_check
  CHECK (status IN ('uploading', 'queued', 'running', 'succeeded', 'failed', 'needs_review'));

-- Add per-file status tracking, integrity hash, and error tracking to batch_files
ALTER TABLE batch_files
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('pending', 'uploading', 'uploaded', 'failed', 'processing', 'processed')),
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Index for cross-batch duplicate detection via SHA-256 hash
CREATE INDEX IF NOT EXISTS idx_batch_files_content_hash
  ON batch_files(content_hash)
  WHERE content_hash IS NOT NULL;

-- Index for per-status queries (e.g. "all failed files in a batch")
CREATE INDEX IF NOT EXISTS idx_batch_files_status
  ON batch_files(batch_id, status);
