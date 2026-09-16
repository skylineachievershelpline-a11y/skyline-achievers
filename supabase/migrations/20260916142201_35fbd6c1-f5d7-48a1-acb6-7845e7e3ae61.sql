-- Resources that hung off a series move to that series' first lecture.
UPDATE public.resources r
SET lecture_id = sub.lecture_id, series_id = NULL
FROM (
  SELECT DISTINCT ON (series_id) series_id, id AS lecture_id
  FROM public.lectures
  WHERE series_id IS NOT NULL
  ORDER BY series_id, sort_order, created_at
) sub
WHERE r.series_id = sub.series_id AND r.lecture_id IS NULL;

UPDATE public.resources SET series_id = NULL WHERE series_id IS NOT NULL AND lecture_id IS NOT NULL;

-- Every lecture becomes a standalone training video attached to a level.
UPDATE public.lectures l
SET level_id = COALESCE(l.level_id, s.level_id), series_id = NULL
FROM public.series s
WHERE l.series_id = s.id;

-- Access is now recorded per video.
DELETE FROM public.content_access WHERE content_type = 'series';

INSERT INTO public.content_access (content_type, content_id, level_id)
SELECT 'lecture', l.id, lv.id
FROM public.lectures l
JOIN public.levels base ON base.id = l.level_id
JOIN public.levels lv ON lv.rank_order >= base.rank_order
WHERE NOT EXISTS (
  SELECT 1 FROM public.content_access ca
  WHERE ca.content_type = 'lecture' AND ca.content_id = l.id AND ca.level_id = lv.id
);

CREATE OR REPLACE FUNCTION public.can_access_lecture(_lecture_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lectures l
    WHERE l.id = _lecture_id AND l.is_published AND NOT l.is_archived
      AND EXISTS (
        SELECT 1 FROM public.content_access ca
        WHERE ca.content_type = 'lecture'
          AND ca.content_id = l.id
          AND ca.level_id = public.current_member_level()
      )
  );
$function$;

DROP POLICY IF EXISTS "Members read accessible lectures" ON public.lectures;
CREATE POLICY "Members read accessible lectures" ON public.lectures
FOR SELECT TO authenticated
USING (
  is_published AND NOT is_archived AND EXISTS (
    SELECT 1 FROM public.content_access ca
    WHERE ca.content_type = 'lecture'
      AND ca.content_id = lectures.id
      AND ca.level_id = public.current_member_level()
  )
);

DROP POLICY IF EXISTS "Members read accessible resources" ON public.resources;
CREATE POLICY "Members read accessible resources" ON public.resources
FOR SELECT TO authenticated
USING (is_published AND lecture_id IS NOT NULL AND public.can_access_lecture(lecture_id));

DROP TRIGGER IF EXISTS trg_series_default_access ON public.series;
