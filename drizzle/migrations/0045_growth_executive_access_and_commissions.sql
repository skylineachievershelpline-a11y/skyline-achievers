-- Paid unlock of the Skyline Growth Executive feature, per FBO.
CREATE TABLE public.growth_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  method text,
  sender_name text,
  reference_no text,
  proof_path text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by text,
  expires_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.growth_access TO service_role;
ALTER TABLE public.growth_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER growth_access_updated
BEFORE UPDATE ON public.growth_access
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Commission ledger: every earned rupee has an owner assistant and an FBO.
CREATE TABLE public.growth_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL,
  assistant_id uuid NOT NULL REFERENCES public.job_assistants(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.job_leads(id) ON DELETE SET NULL,
  kind text NOT NULL,
  cycle_start date NOT NULL,
  cycle_end date NOT NULL,
  units integer NOT NULL DEFAULT 1,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  note text,
  verified_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX growth_commissions_assistant_idx ON public.growth_commissions (assistant_id, cycle_start);
CREATE INDEX growth_commissions_fbo_idx ON public.growth_commissions (fbo_id, cycle_start);
CREATE UNIQUE INDEX growth_commissions_lead_kind_idx ON public.growth_commissions (lead_id, kind) WHERE lead_id IS NOT NULL;

GRANT ALL ON public.growth_commissions TO service_role;
ALTER TABLE public.growth_commissions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER growth_commissions_updated
BEFORE UPDATE ON public.growth_commissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cycle maths needs the moment a lead actually converted.
ALTER TABLE public.job_leads ADD COLUMN IF NOT EXISTS enrolled_at timestamptz;
ALTER TABLE public.job_leads ADD COLUMN IF NOT EXISTS cc_done_at timestamptz;