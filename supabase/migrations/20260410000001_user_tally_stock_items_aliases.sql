ALTER TABLE public.user_tally_stock_items
  ADD COLUMN IF NOT EXISTS aliases jsonb NOT NULL DEFAULT '[]'::jsonb;
