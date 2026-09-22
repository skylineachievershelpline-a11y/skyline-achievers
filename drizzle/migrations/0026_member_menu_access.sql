CREATE TABLE public.member_menu_hidden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  menu_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, menu_key)
);

GRANT SELECT ON public.member_menu_hidden TO authenticated;
GRANT ALL ON public.member_menu_hidden TO service_role;

ALTER TABLE public.member_menu_hidden ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own hidden menu"
ON public.member_menu_hidden
FOR SELECT
TO authenticated
USING (member_id = auth.uid());

CREATE INDEX member_menu_hidden_member_idx ON public.member_menu_hidden(member_id);
