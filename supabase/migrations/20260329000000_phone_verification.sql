-- Add phone and backup email verification columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_email text,
  ADD COLUMN IF NOT EXISTS backup_email_verified boolean NOT NULL DEFAULT false;

-- Index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone)
  WHERE phone IS NOT NULL;
