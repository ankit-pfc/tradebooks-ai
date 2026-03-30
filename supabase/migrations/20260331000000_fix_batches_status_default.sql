-- Fix: batches.status column was missing its DEFAULT value on the remote database.
-- Without this, inserts that omit status send NULL which fails the check constraint.
ALTER TABLE public.batches ALTER COLUMN status SET DEFAULT 'queued';
