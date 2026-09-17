CREATE OR REPLACE FUNCTION public.can_access_lecture(_lecture_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lectures l
    JOIN public.content_access ca
      ON ca.content_type = 'lecture' AND ca.content_id = l.id
    WHERE l.id = _lecture_id
      AND l.is_published
      AND NOT l.is_archived
      AND ca.level_id = public.current_member_level()
  )
$$;

DROP POLICY IF EXISTS "Members read accessible lectures" ON public.lectures;
CREATE POLICY "Members read accessible lectures"
ON public.lectures
FOR SELECT
TO authenticated
USING (public.can_access_lecture(id));