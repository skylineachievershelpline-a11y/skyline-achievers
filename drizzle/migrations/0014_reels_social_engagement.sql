-- Reels: likes, saves, moderated comments, view history and rank-based posting.

ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS base_likes integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.can_post_reels()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_profiles mp
    JOIN public.levels l ON l.id = mp.level_id
    WHERE mp.id = auth.uid() AND mp.status = 'active' AND l.rank_order >= 2
  );
$$;

DROP POLICY IF EXISTS "Managers create own reels" ON public.reels;
DROP POLICY IF EXISTS "Managers delete own reels" ON public.reels;

CREATE POLICY "Ranked members create own reels"
ON public.reels FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.can_post_reels());

CREATE POLICY "Ranked members delete own reels"
ON public.reels FOR DELETE TO authenticated
USING (created_by = auth.uid() AND public.can_post_reels());

CREATE TABLE IF NOT EXISTS public.reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, viewer_id)
);
GRANT ALL ON public.reel_likes TO service_role;
ALTER TABLE public.reel_likes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reel_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, viewer_id)
);
GRANT ALL ON public.reel_saves TO service_role;
ALTER TABLE public.reel_saves ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reel_comments_status_check CHECK (status IN ('pending', 'approved', 'rejected'))
);
CREATE INDEX IF NOT EXISTS reel_comments_reel_idx ON public.reel_comments (reel_id, created_at DESC);
GRANT ALL ON public.reel_comments TO service_role;
ALTER TABLE public.reel_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reel_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reel_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS reel_views_viewer_idx ON public.reel_views (viewer_id, seen_at DESC);
GRANT ALL ON public.reel_views TO service_role;
ALTER TABLE public.reel_views ENABLE ROW LEVEL SECURITY;
