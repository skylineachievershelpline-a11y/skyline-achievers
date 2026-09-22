ALTER TABLE public.trainee_journey
  ADD COLUMN IF NOT EXISTS mentorship_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS mentorship_account_id uuid,
  ADD COLUMN IF NOT EXISTS mentorship_account_code text;

CREATE INDEX IF NOT EXISTS beginner_sessions_kind_idx
  ON public.beginner_sessions (session_kind, session_number);