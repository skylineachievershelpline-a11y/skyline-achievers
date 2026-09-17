DROP POLICY IF EXISTS "Members read accessible resources" ON public.resources;
CREATE POLICY "Members read accessible resources"
ON public.resources FOR SELECT TO authenticated
USING (
  is_published
  AND (lecture_id IS NULL OR public.can_access_lecture(lecture_id))
);