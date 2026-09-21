ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS mentorship_fee_pkr numeric NOT NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS mentorship_paid_pkr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mentorship_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS mentorship_extensions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mentorship_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cc_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS cc_extensions integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS level_since timestamptz NOT NULL DEFAULT now();

UPDATE public.member_profiles
SET mentorship_paid_pkr = mentorship_fee_pkr,
    mentorship_completed_at = COALESCE(mentorship_completed_at, created_at),
    level_since = COALESCE(level_since, created_at)
WHERE mentorship_completed_at IS NULL;