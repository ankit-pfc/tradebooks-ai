-- Preserve distinct mappings for instruments that share a broker symbol.
-- Older schema used UNIQUE (user_id, broker_symbol), which caused one WIPRO-like
-- row to overwrite another when security_id / ISIN differed.

ALTER TABLE public.user_tally_security_mappings
  ADD COLUMN IF NOT EXISTS mapping_key text;

UPDATE public.user_tally_security_mappings
SET mapping_key = COALESCE(
  CASE
    WHEN security_id IS NOT NULL AND btrim(security_id) <> ''
      THEN 'SECURITY:' || upper(btrim(security_id))
  END,
  CASE
    WHEN isin IS NOT NULL AND btrim(isin) <> ''
      THEN 'ISIN:' || upper(btrim(isin))
  END,
  'SYMBOL:' || upper(btrim(broker_symbol))
)
WHERE mapping_key IS NULL OR btrim(mapping_key) = '';

ALTER TABLE public.user_tally_security_mappings
  ALTER COLUMN mapping_key SET NOT NULL;

WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY user_id, mapping_key
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.user_tally_security_mappings
)
DELETE FROM public.user_tally_security_mappings target
USING ranked
WHERE target.ctid = ranked.ctid
  AND ranked.rn > 1;

ALTER TABLE public.user_tally_security_mappings
  DROP CONSTRAINT IF EXISTS user_tally_security_mappings_user_id_broker_symbol_key;

ALTER TABLE public.user_tally_security_mappings
  ADD CONSTRAINT user_tally_security_mappings_user_id_mapping_key_key
  UNIQUE (user_id, mapping_key);

CREATE INDEX IF NOT EXISTS user_tally_security_mappings_user_symbol_idx
  ON public.user_tally_security_mappings (user_id, broker_symbol);
