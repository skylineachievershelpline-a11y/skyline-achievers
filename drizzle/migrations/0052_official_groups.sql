CREATE TABLE public.official_groups (
  placement text PRIMARY KEY CHECK (placement IN ('member','mentorship','beginners','executive','report')),
  title text NOT NULL DEFAULT 'Official WhatsApp Group',
  rules text NOT NULL DEFAULT '',
  invite_url text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.official_groups TO service_role;
ALTER TABLE public.official_groups ENABLE ROW LEVEL SECURITY;