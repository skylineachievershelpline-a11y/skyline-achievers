CREATE SEQUENCE IF NOT EXISTS public.trainee_id_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_trainee_id()
RETURNS text
LANGUAGE sql
SET search_path TO 'public'
AS $$
  SELECT 'SKB-' || nextval('public.trainee_id_seq')::TEXT;
$$;

CREATE TABLE public.trainees (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trainee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  upline_id UUID REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'upline',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','removed')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trainees TO authenticated;
GRANT ALL ON public.trainees TO service_role;
ALTER TABLE public.trainees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainees read own record"
ON public.trainees FOR SELECT TO authenticated
USING (id = auth.uid());

CREATE POLICY "Uplines read their trainees"
ON public.trainees FOR SELECT TO authenticated
USING (upline_id = auth.uid());

CREATE TRIGGER trainees_set_updated_at
BEFORE UPDATE ON public.trainees
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trainee_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  upline_id UUID NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trainee_invites TO authenticated;
GRANT ALL ON public.trainee_invites TO service_role;
ALTER TABLE public.trainee_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uplines read own invite links"
ON public.trainee_invites FOR SELECT TO authenticated
USING (upline_id = auth.uid());

CREATE TRIGGER trainee_invites_set_updated_at
BEFORE UPDATE ON public.trainee_invites
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.trainee_session_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trainee_id UUID NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.beginner_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trainee_id, session_id)
);

GRANT SELECT ON public.trainee_session_unlocks TO authenticated;
GRANT ALL ON public.trainee_session_unlocks TO service_role;
ALTER TABLE public.trainee_session_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainees read own unlocks"
ON public.trainee_session_unlocks FOR SELECT TO authenticated
USING (trainee_id = auth.uid());