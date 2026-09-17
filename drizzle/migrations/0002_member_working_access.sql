ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS working_enabled boolean NOT NULL DEFAULT true;