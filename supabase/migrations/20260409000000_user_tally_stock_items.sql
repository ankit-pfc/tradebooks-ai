-- Tally stock item names imported from the user's Tally Master XML.
-- These names are used as authority when generating inventory allocations so
-- transaction imports reduce existing opening stock instead of creating
-- duplicate stock items.
CREATE TABLE public.user_tally_stock_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  base_unit  text NOT NULL DEFAULT 'NOS',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.user_tally_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tally stock items"
  ON public.user_tally_stock_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tally stock items"
  ON public.user_tally_stock_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tally stock items"
  ON public.user_tally_stock_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tally stock items"
  ON public.user_tally_stock_items FOR DELETE
  USING (auth.uid() = user_id);
