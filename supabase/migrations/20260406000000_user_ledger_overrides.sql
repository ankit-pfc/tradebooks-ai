-- User ledger overrides: allow users to rename system ledgers or add custom ones
CREATE TABLE public.user_ledger_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ledger_key    text NOT NULL,
  name          text NOT NULL,
  parent_group  text NOT NULL,
  is_custom     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ledger_key)
);

ALTER TABLE public.user_ledger_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger overrides"
  ON public.user_ledger_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ledger overrides"
  ON public.user_ledger_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ledger overrides"
  ON public.user_ledger_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ledger overrides"
  ON public.user_ledger_overrides FOR DELETE
  USING (auth.uid() = user_id);
