CREATE TABLE IF NOT EXISTS public.member_training_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.training_categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, category_id)
);

GRANT SELECT ON public.member_training_access TO authenticated;
GRANT ALL ON public.member_training_access TO service_role;

ALTER TABLE public.member_training_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own training access"
ON public.member_training_access
FOR SELECT
TO authenticated
USING (member_id = auth.uid());

CREATE INDEX IF NOT EXISTS member_training_access_member_idx ON public.member_training_access(member_id);