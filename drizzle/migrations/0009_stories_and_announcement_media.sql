CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('text','image','video')),
  caption text,
  text_body text,
  background text,
  media_bucket text,
  media_path text,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

GRANT SELECT ON public.stories TO anon;
GRANT SELECT ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads live stories" ON public.stories;
CREATE POLICY "Anyone reads live stories"
  ON public.stories FOR SELECT
  TO anon, authenticated
  USING (is_published AND expires_at > now());

CREATE INDEX IF NOT EXISTS stories_live_idx ON public.stories (expires_at DESC);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS media_bucket text,
  ADD COLUMN IF NOT EXISTS media_path text;
