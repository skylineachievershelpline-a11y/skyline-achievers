ALTER TABLE public.member_daily_reports
  ADD COLUMN IF NOT EXISTS responses integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enrollments integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS two_cc integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mentorship_paid integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

CREATE TABLE IF NOT EXISTS public.leave_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.member_profiles(id) ON DELETE CASCADE,
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

GRANT SELECT, INSERT ON public.leave_applications TO authenticated;
GRANT ALL ON public.leave_applications TO service_role;

ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own leave applications" ON public.leave_applications;
CREATE POLICY "Members read own leave applications"
ON public.leave_applications FOR SELECT TO authenticated
USING (auth.uid() = member_id);

DROP POLICY IF EXISTS "Members create own leave applications" ON public.leave_applications;
CREATE POLICY "Members create own leave applications"
ON public.leave_applications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = member_id);

CREATE INDEX IF NOT EXISTS leave_applications_status_idx ON public.leave_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS leave_applications_member_idx ON public.leave_applications (member_id, from_date DESC);