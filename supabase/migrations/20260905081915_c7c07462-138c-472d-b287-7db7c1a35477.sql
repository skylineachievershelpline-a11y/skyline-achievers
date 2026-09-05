CREATE TABLE public.live_trainings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.live_trainings TO service_role;
ALTER TABLE public.live_trainings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.live_premieres (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid NOT NULL REFERENCES public.live_trainings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  scheduled_at timestamptz NOT NULL,
  created_by uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX live_premieres_created_by_idx ON public.live_premieres (created_by);
GRANT ALL ON public.live_premieres TO service_role;
ALTER TABLE public.live_premieres ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER live_trainings_set_updated_at BEFORE UPDATE ON public.live_trainings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER live_premieres_set_updated_at BEFORE UPDATE ON public.live_premieres
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();