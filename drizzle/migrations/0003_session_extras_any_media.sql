ALTER TABLE public.beginner_session_extras
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS file_bucket text;

ALTER TABLE public.beginner_session_extras
  ADD CONSTRAINT beginner_session_extras_kind_check
  CHECK (kind IN ('video', 'image', 'pdf', 'link'));