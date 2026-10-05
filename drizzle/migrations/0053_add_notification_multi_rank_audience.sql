ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS audience_level_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS notifications_audience_level_ids_idx
  ON public.notifications USING gin (audience_level_ids);

DROP POLICY IF EXISTS "Members read their notifications" ON public.notifications;
CREATE POLICY "Members read their notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.current_member_level() IS NOT NULL
  AND (
    (audience_level_id IS NULL AND cardinality(audience_level_ids) = 0)
    OR audience_level_id = public.current_member_level()
    OR public.current_member_level() = ANY(audience_level_ids)
  )
);