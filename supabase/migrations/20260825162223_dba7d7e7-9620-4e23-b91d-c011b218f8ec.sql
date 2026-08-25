-- 1. Seed the six official training levels (idempotent by slug)
INSERT INTO public.levels (name, slug, description, rank_order, is_published) VALUES
  ('Beginners Training', 'beginners-training', 'Foundation training for new members.', 1, true),
  ('Personal Mentorship', 'personal-mentorship', 'One-to-one mentorship track.', 2, true),
  ('Assistant Supervisor Training', 'assistant-supervisor-training', 'Preparation for assistant supervisor duties.', 3, true),
  ('Supervisor Training', 'supervisor-training', 'Full supervisor responsibilities and leadership.', 4, true),
  ('Assistant Manager Training', 'assistant-manager-training', 'Preparation for assistant manager duties.', 5, true),
  ('Manager Training', 'manager-training', 'Advanced management and leadership training.', 6, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, rank_order = EXCLUDED.rank_order, is_published = true;

-- 2. Lectures may now live directly under a level, without a series
ALTER TABLE public.lectures ALTER COLUMN series_id DROP NOT NULL;
ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS level_id uuid REFERENCES public.levels(id) ON DELETE SET NULL;

UPDATE public.lectures l
SET level_id = s.level_id
FROM public.series s
WHERE l.series_id = s.id AND l.level_id IS NULL;

ALTER TABLE public.lectures DROP CONSTRAINT IF EXISTS lectures_placement_check;
ALTER TABLE public.lectures ADD CONSTRAINT lectures_placement_check
  CHECK (series_id IS NOT NULL OR level_id IS NOT NULL);

-- 3. Level-based access helper: a member unlocks content of their own level and below
CREATE OR REPLACE FUNCTION public.can_access_level_content(_level_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.levels base, public.levels mine
    WHERE base.id = _level_id
      AND mine.id = public.current_member_level()
      AND mine.rank_order >= base.rank_order
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_lecture(_lecture_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lectures l
    WHERE l.id = _lecture_id AND l.is_published AND NOT l.is_archived
      AND (
        (l.series_id IS NOT NULL AND public.can_access_series(l.series_id))
        OR (l.series_id IS NULL AND public.can_access_level_content(l.level_id))
      )
  );
$$;

DROP POLICY IF EXISTS "Members read accessible lectures" ON public.lectures;
CREATE POLICY "Members read accessible lectures" ON public.lectures
FOR SELECT
USING (
  is_published AND NOT is_archived AND (
    (series_id IS NOT NULL AND public.can_access_series(series_id))
    OR (series_id IS NULL AND public.can_access_level_content(level_id))
  )
);