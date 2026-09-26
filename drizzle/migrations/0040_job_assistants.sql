CREATE TABLE public.job_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'calling' CHECK (role IN ('calling','full_funnel')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','removed')),
  daily_lead_limit integer NOT NULL DEFAULT 50,
  notes text,
  auth_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX job_assistants_phone_active ON public.job_assistants (right(regexp_replace(phone,'\D','','g'),10)) WHERE status <> 'removed';
CREATE INDEX job_assistants_fbo ON public.job_assistants (fbo_id);
GRANT ALL ON public.job_assistants TO service_role;
ALTER TABLE public.job_assistants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER job_assistants_updated BEFORE UPDATE ON public.job_assistants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();