ALTER TABLE public.job_assistants ADD COLUMN access_token text NOT NULL DEFAULT encode(gen_random_bytes(24),'hex');
CREATE UNIQUE INDEX job_assistants_token ON public.job_assistants (access_token);
ALTER TABLE public.job_leads ADD COLUMN follow_up_at timestamptz, ADD COLUMN last_called_at timestamptz, ADD COLUMN call_count integer NOT NULL DEFAULT 0;
CREATE TABLE public.job_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.job_leads(id) ON DELETE CASCADE,
  assistant_id uuid NOT NULL REFERENCES public.job_assistants(id) ON DELETE CASCADE,
  fbo_id uuid NOT NULL,
  outcome text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX job_lead_activities_assistant ON public.job_lead_activities (assistant_id, created_at);
GRANT ALL ON public.job_lead_activities TO service_role;
ALTER TABLE public.job_lead_activities ENABLE ROW LEVEL SECURITY;