CREATE TABLE public.training_group_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, level_id)
);

GRANT SELECT ON public.training_group_access TO authenticated;
GRANT ALL ON public.training_group_access TO service_role;

ALTER TABLE public.training_group_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read category access" ON public.training_group_access
  FOR SELECT TO authenticated USING (true);
