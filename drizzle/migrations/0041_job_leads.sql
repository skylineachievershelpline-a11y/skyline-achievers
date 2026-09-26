CREATE TABLE public.job_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  assistant_id uuid REFERENCES public.job_assistants(id) ON DELETE SET NULL,
  batch_label text,
  full_name text,
  phone text NOT NULL,
  phone_tail text NOT NULL,
  city text,
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','follow_up','enrolled','not_interested','cc_done','invalid')),
  assigned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fbo_id, phone_tail)
);
CREATE INDEX job_leads_assistant ON public.job_leads (assistant_id);
GRANT ALL ON public.job_leads TO service_role;
ALTER TABLE public.job_leads ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER job_leads_updated BEFORE UPDATE ON public.job_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();