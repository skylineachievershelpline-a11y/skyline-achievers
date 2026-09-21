ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.beginner_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resources_session_id_idx ON public.resources (session_id);