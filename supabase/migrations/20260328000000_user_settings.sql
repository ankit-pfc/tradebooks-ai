-- User settings for persisting accounting preferences
CREATE TABLE public.user_settings (
  user_id           uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name      text NOT NULL DEFAULT '',
  accounting_mode   text NOT NULL DEFAULT 'INVESTOR'
    CHECK (accounting_mode IN ('INVESTOR', 'TRADER')),
  cost_basis_method text NOT NULL DEFAULT 'FIFO'
    CHECK (cost_basis_method IN ('FIFO', 'WEIGHTED_AVERAGE')),
  charge_treatment  text NOT NULL DEFAULT 'HYBRID'
    CHECK (charge_treatment IN ('CAPITALIZE', 'EXPENSE', 'HYBRID')),
  voucher_granularity text NOT NULL DEFAULT 'TRADE_LEVEL'
    CHECK (voucher_granularity IN ('TRADE_LEVEL', 'CONTRACT_NOTE_LEVEL', 'DAILY_SUMMARY_BY_SCRIPT', 'DAILY_SUMMARY_POOLED')),
  ledger_strategy   text NOT NULL DEFAULT 'SCRIPT_LEVEL'
    CHECK (ledger_strategy IN ('SCRIPT_LEVEL', 'POOLED')),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);
