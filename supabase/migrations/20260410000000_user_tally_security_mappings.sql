-- Explicit broker-security -> Tally master mappings.
-- This is the durable source of truth that prevents Zerodha symbols from
-- generating duplicate Tally ledgers/stock items when a client's Tally company
-- already uses a different fixed name.
CREATE TABLE public.user_tally_security_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  security_id           text,
  broker_symbol         text NOT NULL,
  isin                  text,
  tally_ledger_name     text NOT NULL,
  tally_ledger_group    text NOT NULL,
  tally_stock_item_name text NOT NULL,
  base_unit             text NOT NULL DEFAULT 'NOS',
  match_source          text NOT NULL DEFAULT 'manual'
    CHECK (match_source IN ('manual', 'tally_alias', 'auto_exact', 'auto_pattern')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, broker_symbol)
);

CREATE INDEX user_tally_security_mappings_user_security_id_idx
  ON public.user_tally_security_mappings (user_id, security_id)
  WHERE security_id IS NOT NULL;

CREATE INDEX user_tally_security_mappings_user_isin_idx
  ON public.user_tally_security_mappings (user_id, isin)
  WHERE isin IS NOT NULL;

ALTER TABLE public.user_tally_security_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tally security mappings"
  ON public.user_tally_security_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tally security mappings"
  ON public.user_tally_security_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tally security mappings"
  ON public.user_tally_security_mappings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tally security mappings"
  ON public.user_tally_security_mappings FOR DELETE
  USING (auth.uid() = user_id);
