CREATE TABLE public.content_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'session',
  session_id uuid REFERENCES public.beginner_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  thumbnail_path text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_sections TO authenticated;
GRANT ALL ON public.content_sections TO service_role;

ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read published sections"
ON public.content_sections FOR SELECT TO authenticated
USING (is_published);

CREATE TRIGGER content_sections_set_updated_at
BEFORE UPDATE ON public.content_sections
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.beginner_session_extras
  ADD COLUMN section_id uuid REFERENCES public.content_sections(id) ON DELETE SET NULL;

ALTER TABLE public.resources
  ADD COLUMN section_id uuid REFERENCES public.content_sections(id) ON DELETE SET NULL;
