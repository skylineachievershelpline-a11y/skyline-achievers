CREATE TABLE public.training_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_categories TO authenticated;
GRANT ALL ON public.training_categories TO service_role;

ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read published training sections"
ON public.training_categories
FOR SELECT
TO authenticated
USING (is_published);

ALTER TABLE public.lectures
  ADD COLUMN category_id uuid REFERENCES public.training_categories(id) ON DELETE SET NULL;

CREATE INDEX lectures_category_id_idx ON public.lectures(category_id);

INSERT INTO public.training_categories (name, slug, description, sort_order) VALUES
  ('Training', 'training', 'Core Skyline Achievers training videos.', 1),
  ('Podcast', 'podcast', 'Podcast episodes and long-form conversations.', 2),
  ('Motivational', 'motivational', 'Motivational and mindset videos.', 3);

UPDATE public.lectures
SET category_id = (SELECT id FROM public.training_categories WHERE slug = 'training')
WHERE category_id IS NULL;