CREATE SEQUENCE IF NOT EXISTS public.growth_executive_id_seq START WITH 1;
GRANT USAGE, SELECT ON SEQUENCE public.growth_executive_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.generate_growth_executive_id()
RETURNS text
LANGUAGE sql
SET search_path TO 'public'
AS $$
  SELECT '22' || lpad(nextval('public.growth_executive_id_seq')::text, 10, '0');
$$;

ALTER TABLE public.job_assistants
  ADD COLUMN IF NOT EXISTS executive_id text,
  ADD COLUMN IF NOT EXISTS cnic text,
  ADD COLUMN IF NOT EXISTS cnic_front_path text,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS experience text,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_account_title text,
  ADD COLUMN IF NOT EXISTS payout_account_number text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS job_assistants_executive_id_unique ON public.job_assistants (executive_id) WHERE executive_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS job_assistants_email_active_unique ON public.job_assistants (lower(email)) WHERE email IS NOT NULL AND status <> 'removed';
CREATE UNIQUE INDEX IF NOT EXISTS job_assistants_cnic_active_unique ON public.job_assistants (regexp_replace(cnic,'\D','','g')) WHERE cnic IS NOT NULL AND status <> 'removed';
COMMENT ON COLUMN public.job_assistants.access_token IS 'DEPRECATED: legacy link portal replaced by authenticated Growth Executive account';

CREATE TABLE public.growth_executive_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  label text,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.growth_executive_invites TO service_role;
ALTER TABLE public.growth_executive_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX growth_executive_invites_fbo_idx ON public.growth_executive_invites(fbo_id, created_at DESC);
CREATE TRIGGER growth_executive_invites_updated BEFORE UPDATE ON public.growth_executive_invites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.growth_executive_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.growth_executive_invites(id) ON DELETE RESTRICT,
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  phone_tail text NOT NULL,
  email text NOT NULL,
  email_normalized text NOT NULL,
  cnic text NOT NULL,
  cnic_normalized text NOT NULL,
  cnic_front_path text NOT NULL,
  avatar_path text NOT NULL,
  experience text NOT NULL,
  qualification text NOT NULL,
  city text NOT NULL,
  requested_role text NOT NULL CHECK (requested_role IN ('calling','full_funnel')),
  payout_method text NOT NULL,
  payout_account_title text NOT NULL,
  payout_account_number text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','changes_requested','approved','rejected')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by text,
  assistant_id uuid REFERENCES public.job_assistants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.growth_executive_applications TO service_role;
ALTER TABLE public.growth_executive_applications ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX growth_app_phone_open_unique ON public.growth_executive_applications(phone_tail) WHERE status IN ('pending','changes_requested','approved');
CREATE UNIQUE INDEX growth_app_email_open_unique ON public.growth_executive_applications(email_normalized) WHERE status IN ('pending','changes_requested','approved');
CREATE UNIQUE INDEX growth_app_cnic_open_unique ON public.growth_executive_applications(cnic_normalized) WHERE status IN ('pending','changes_requested','approved');
CREATE INDEX growth_app_fbo_idx ON public.growth_executive_applications(fbo_id, created_at DESC);
CREATE TRIGGER growth_executive_applications_updated BEFORE UPDATE ON public.growth_executive_applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.growth_lead_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  label text,
  source_file_name text,
  total_rows integer NOT NULL DEFAULT 0,
  valid_rows integer NOT NULL DEFAULT 0,
  invalid_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  assigned_rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.growth_lead_batches TO service_role;
ALTER TABLE public.growth_lead_batches ENABLE ROW LEVEL SECURITY;
CREATE INDEX growth_lead_batches_fbo_idx ON public.growth_lead_batches(fbo_id, created_at DESC);

ALTER TABLE public.job_leads
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.growth_lead_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_position integer,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS qualification text,
  ADD COLUMN IF NOT EXISTS original_full_name text,
  ADD COLUMN IF NOT EXISTS original_phone text,
  ADD COLUMN IF NOT EXISTS original_city text,
  ADD COLUMN IF NOT EXISTS original_age integer,
  ADD COLUMN IF NOT EXISTS original_qualification text,
  ADD COLUMN IF NOT EXISTS attribution_assistant_id uuid REFERENCES public.job_assistants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrollment_verification_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cc_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS cc_verification_status text NOT NULL DEFAULT 'none';
CREATE INDEX IF NOT EXISTS job_leads_batch_idx ON public.job_leads(batch_id, batch_position);
CREATE INDEX IF NOT EXISTS job_leads_attribution_idx ON public.job_leads(attribution_assistant_id);

ALTER TABLE public.job_lead_activities
  ADD COLUMN IF NOT EXISTS previous_values jsonb,
  ADD COLUMN IF NOT EXISTS new_values jsonb,
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'executive';

CREATE TABLE public.growth_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  assistant_id uuid NOT NULL REFERENCES public.job_assistants(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.job_leads(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('enrollment','two_cc')),
  status text NOT NULL DEFAULT 'reported' CHECK (status IN ('reported','data_check','verified','rejected','eligible','ledgered')),
  reported_at timestamptz NOT NULL DEFAULT now(),
  checked_at timestamptz,
  verified_at timestamptz,
  verified_by text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id, kind)
);
GRANT ALL ON public.growth_verification_events TO service_role;
ALTER TABLE public.growth_verification_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX growth_verification_queue_idx ON public.growth_verification_events(status, created_at);
CREATE INDEX growth_verification_owner_idx ON public.growth_verification_events(fbo_id, assistant_id);
CREATE TRIGGER growth_verification_events_updated BEFORE UPDATE ON public.growth_verification_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.growth_commissions
  ADD COLUMN IF NOT EXISTS verification_event_id uuid REFERENCES public.growth_verification_events(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.growth_lead_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_of uuid REFERENCES public.growth_commissions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS reference text,
  ADD COLUMN IF NOT EXISTS payable_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS growth_commission_event_unique ON public.growth_commissions(verification_event_id) WHERE verification_event_id IS NOT NULL;

CREATE TABLE public.growth_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('enrollment','two_cc')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  commission_amount numeric(12,2) NOT NULL DEFAULT 0,
  service_fee numeric(12,2) NOT NULL DEFAULT 0,
  total_due numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'due' CHECK (status IN ('due','submitted','approved','rejected','paid')),
  due_at timestamptz NOT NULL,
  method text,
  sender_name text,
  reference_no text,
  proof_path text,
  admin_note text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fbo_id, kind, period_start, period_end)
);
GRANT ALL ON public.growth_settlements TO service_role;
ALTER TABLE public.growth_settlements ENABLE ROW LEVEL SECURITY;
CREATE INDEX growth_settlements_status_idx ON public.growth_settlements(status, due_at);
CREATE TRIGGER growth_settlements_updated BEFORE UPDATE ON public.growth_settlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.growth_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id uuid NOT NULL REFERENCES public.job_assistants(id) ON DELETE RESTRICT,
  fbo_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','paid')),
  payout_method text NOT NULL,
  payout_account_title text NOT NULL,
  payout_account_number text NOT NULL,
  admin_note text,
  payment_reference text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.growth_withdrawals TO service_role;
ALTER TABLE public.growth_withdrawals ENABLE ROW LEVEL SECURITY;
CREATE INDEX growth_withdrawals_queue_idx ON public.growth_withdrawals(status, requested_at);
CREATE INDEX growth_withdrawals_owner_idx ON public.growth_withdrawals(fbo_id, assistant_id);
CREATE TRIGGER growth_withdrawals_updated BEFORE UPDATE ON public.growth_withdrawals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.growth_rate_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from timestamptz NOT NULL,
  settings jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.growth_rate_cards TO service_role;
ALTER TABLE public.growth_rate_cards ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX growth_rate_cards_effective_unique ON public.growth_rate_cards(effective_from);

COMMENT ON TABLE public.growth_executive_invites IS 'Private FBO-generated application links for Skyline Growth Executive applicants';
COMMENT ON TABLE public.growth_executive_applications IS 'Verified applications before authenticated Growth Executive account creation';
COMMENT ON TABLE public.growth_verification_events IS 'Server-controlled reported-to-ledger verification pipeline';
COMMENT ON TABLE public.growth_rate_cards IS 'Immutable effective-dated Skyline Growth Executive rules';