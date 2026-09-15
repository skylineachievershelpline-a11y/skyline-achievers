CREATE TABLE public.landing_quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_text text NOT NULL CHECK (char_length(quote_text) BETWEEN 3 AND 280),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_quotes TO anon, authenticated;
GRANT ALL ON public.landing_quotes TO service_role;
ALTER TABLE public.landing_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active landing quotes"
ON public.landing_quotes FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE TABLE public.landing_intro (
  id text NOT NULL DEFAULT 'default' PRIMARY KEY CHECK (id = 'default'),
  title text NOT NULL DEFAULT 'What is Skyline Achievers?' CHECK (char_length(title) BETWEEN 3 AND 140),
  description text CHECK (description IS NULL OR char_length(description) <= 600),
  video_source text NOT NULL DEFAULT 'external' CHECK (video_source IN ('upload', 'external')),
  video_path text,
  video_url text,
  thumbnail_path text,
  aspect_ratio text NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9', '9:16', '1:1', '4:3')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_intro TO anon, authenticated;
GRANT ALL ON public.landing_intro TO service_role;
ALTER TABLE public.landing_intro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active landing intro"
ON public.landing_intro FOR SELECT TO anon, authenticated
USING (is_active = true);

CREATE TABLE public.landing_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_name text NOT NULL CHECK (char_length(person_name) BETWEEN 2 AND 100),
  designation text CHECK (designation IS NULL OR char_length(designation) <= 100),
  photo_path text,
  review_text text NOT NULL CHECK (char_length(review_text) BETWEEN 10 AND 700),
  rating integer CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.landing_reviews TO anon, authenticated;
GRANT ALL ON public.landing_reviews TO service_role;
ALTER TABLE public.landing_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read approved active landing reviews"
ON public.landing_reviews FOR SELECT TO anon, authenticated
USING (status = 'approved' AND is_active = true);
CREATE POLICY "Anyone can submit pending landing reviews"
ON public.landing_reviews FOR INSERT TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND is_active = false
  AND sort_order = 0
  AND photo_path IS NULL
);

CREATE TRIGGER landing_quotes_set_updated_at
BEFORE UPDATE ON public.landing_quotes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER landing_intro_set_updated_at
BEFORE UPDATE ON public.landing_intro
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER landing_reviews_set_updated_at
BEFORE UPDATE ON public.landing_reviews
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.landing_quotes (quote_text, sort_order, is_active) VALUES
  ('Small steps. Better skills. Bigger possibilities.', 1, true),
  ('Your phone is a tool. Learn how to use it.', 2, true),
  ('Learn something today that your future self will thank you for.', 3, true),
  ('Progress begins when learning becomes action.', 4, true);

INSERT INTO public.landing_intro (id, title, description, is_active)
VALUES (
  'default',
  'What is Skyline Achievers?',
  'A learning-focused community that helps people use their mobile phone and internet to build practical skills, work more productively, and grow with consistent guidance.',
  false
);