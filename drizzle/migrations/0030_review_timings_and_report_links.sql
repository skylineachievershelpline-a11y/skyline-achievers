ALTER TABLE public.trainee_session_reviews ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.trainee_session_reviews ADD COLUMN IF NOT EXISTS opened_at timestamptz;
UPDATE public.trainee_session_reviews SET submitted_at = created_at WHERE submitted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.trainee_report_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  label text,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trainee_report_links TO authenticated;
GRANT ALL ON public.trainee_report_links TO service_role;

ALTER TABLE public.trainee_report_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uplines manage their own report links"
ON public.trainee_report_links
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

COMMENT ON COLUMN public.member_profiles.working_enabled IS 'DEPRECATED: rank order decides working access (rank 1 = Personal Mentorship, training only).';