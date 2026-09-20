CREATE TABLE public.training_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_groups TO authenticated;
GRANT ALL ON public.training_groups TO service_role;

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read published training groups"
ON public.training_groups FOR SELECT TO authenticated
USING (is_published);

CREATE TRIGGER training_groups_set_updated_at
BEFORE UPDATE ON public.training_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.training_categories
  ADD COLUMN group_id uuid REFERENCES public.training_groups(id) ON DELETE SET NULL;

CREATE TABLE public.training_category_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.training_categories(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.levels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, level_id)
);

GRANT SELECT ON public.training_category_access TO authenticated;
GRANT ALL ON public.training_category_access TO service_role;

ALTER TABLE public.training_category_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read section access"
ON public.training_category_access FOR SELECT TO authenticated
USING (true);

ALTER TABLE public.resources ADD COLUMN thumbnail_path text;

ALTER TABLE public.resources DROP CONSTRAINT resources_resource_type_check;

ALTER TABLE public.resources ADD CONSTRAINT resources_resource_type_check
  CHECK (resource_type = ANY (ARRAY['pdf'::text, 'audio'::text, 'presentation'::text, 'book'::text, 'link'::text, 'note'::text, 'image'::text]));
