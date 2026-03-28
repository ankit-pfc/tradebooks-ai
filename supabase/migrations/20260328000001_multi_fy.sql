-- Multi-FY support: closing lot snapshots and prior batch linkage
ALTER TABLE public.batches
  ADD COLUMN closing_lots_snapshot jsonb,
  ADD COLUMN prior_batch_id uuid REFERENCES public.batches(id),
  ADD COLUMN fy_label text;
