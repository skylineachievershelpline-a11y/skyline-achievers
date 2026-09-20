CREATE TABLE public.paid_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  tagline text,
  description text,
  price_pkr numeric NOT NULL DEFAULT 0,
  old_price_pkr numeric,
  highlights text[] NOT NULL DEFAULT '{}',
  thumbnail_path text,
  duration_label text,
  is_published boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paid_courses TO service_role;
ALTER TABLE public.paid_courses ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.paid_course_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.paid_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  video_source text NOT NULL DEFAULT 'upload',
  video_path text,
  video_url text,
  thumbnail_path text,
  aspect_ratio text NOT NULL DEFAULT '16/9',
  duration_seconds integer,
  is_preview boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.paid_course_lessons TO service_role;
ALTER TABLE public.paid_course_lessons ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  account_name text,
  account_number text,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.course_payment_methods TO service_role;
ALTER TABLE public.course_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.course_payment_settings (
  id text PRIMARY KEY,
  intro text,
  steps text,
  support_contact text,
  turnaround_note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.course_payment_settings TO service_role;
ALTER TABLE public.course_payment_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.course_payment_settings (id, intro, steps, support_contact, turnaround_note)
VALUES (
  'main',
  'Skyline Achievers premium courses ka access payment verify hone ke baad milta hai.',
  E'1. Neeche diye gaye account par course ki poori fees send karein.\n2. Payment ka screenshot yahin upload karein aur transaction ID likhein.\n3. Team payment verify karegi aur 24 ghante ke andar course ka access mil jayega.',
  '',
  'Access within 24 hours after verification.'
);

CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.paid_courses(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  buyer_kind text NOT NULL DEFAULT 'member',
  buyer_name text NOT NULL,
  buyer_code text,
  phone text,
  method_label text,
  amount_pkr numeric,
  reference text,
  proof_path text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (course_id, buyer_id)
);
GRANT ALL ON public.course_enrollments TO service_role;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE INDEX course_enrollments_status_idx ON public.course_enrollments (status, created_at DESC);

CREATE TRIGGER paid_courses_updated_at BEFORE UPDATE ON public.paid_courses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER paid_course_lessons_updated_at BEFORE UPDATE ON public.paid_course_lessons
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER course_payment_methods_updated_at BEFORE UPDATE ON public.course_payment_methods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER course_enrollments_updated_at BEFORE UPDATE ON public.course_enrollments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();