CREATE TABLE public.notification_dismissals (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, member_id)
);

GRANT SELECT, INSERT, DELETE ON public.notification_dismissals TO authenticated;
GRANT ALL ON public.notification_dismissals TO service_role;

ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own dismissals" ON public.notification_dismissals
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY "Members insert own dismissals" ON public.notification_dismissals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Members delete own dismissals" ON public.notification_dismissals
  FOR DELETE TO authenticated USING (auth.uid() = member_id);