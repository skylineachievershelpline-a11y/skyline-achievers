ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS audience_level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL;

ALTER TABLE public.stories
  DROP CONSTRAINT IF EXISTS stories_kind_check;
ALTER TABLE public.stories
  ADD CONSTRAINT stories_kind_check CHECK (kind IN ('text','image','video','audio'));

ALTER TABLE public.stories
  ADD CONSTRAINT stories_audience_type_check CHECK (audience_type IN ('everyone','beginners','level'));

CREATE INDEX IF NOT EXISTS stories_audience_idx
  ON public.stories (audience_type, audience_level_id, expires_at DESC);

GRANT SELECT ON public.stories TO anon;
GRANT SELECT ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;