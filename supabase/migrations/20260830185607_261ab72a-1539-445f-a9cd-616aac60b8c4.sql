CREATE TABLE public.beginner_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code text NOT NULL,
  title text NOT NULL,
  description text,
  video_source text NOT NULL DEFAULT 'upload',
  video_path text,
  video_url text,
  thumbnail_path text,
  aspect_ratio text NOT NULL DEFAULT '16:9',
  duration_seconds integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX beginner_sessions_code_key ON public.beginner_sessions (upper(session_code));

GRANT ALL ON public.beginner_sessions TO service_role;

ALTER TABLE public.beginner_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER beginner_sessions_set_updated_at
BEFORE UPDATE ON public.beginner_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();