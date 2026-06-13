ALTER TABLE public.user_tally_stock_items
  ADD COLUMN IF NOT EXISTS opening_quantity text,
  ADD COLUMN IF NOT EXISTS opening_value text,
  ADD COLUMN IF NOT EXISTS opening_rate text;
