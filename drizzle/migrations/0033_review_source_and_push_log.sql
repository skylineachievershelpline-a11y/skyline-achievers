ALTER TABLE public.trainee_session_reviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website';

CREATE TABLE IF NOT EXISTS public.push_log (
  key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.push_log TO service_role;
ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;