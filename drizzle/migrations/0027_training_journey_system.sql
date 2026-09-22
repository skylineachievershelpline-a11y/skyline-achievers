-- Beginner sessions get a journey position and a kind
ALTER TABLE public.beginner_sessions
  ADD COLUMN IF NOT EXISTS day_number integer,
  ADD COLUMN IF NOT EXISTS session_number integer,
  ADD COLUMN IF NOT EXISTS session_kind text NOT NULL DEFAULT 'basic';

-- One journey row per trainee
CREATE TABLE IF NOT EXISTS public.trainee_journey (
  trainee_id uuid PRIMARY KEY REFERENCES public.trainees(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'sessions',
  interview_guide_watched_at timestamptz,
  interview_result text,
  interview_reviewed_at timestamptz,
  interview_note text,
  webinar_watched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trainee_journey TO authenticated;
GRANT ALL ON public.trainee_journey TO service_role;
ALTER TABLE public.trainee_journey ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainee reads own journey" ON public.trainee_journey
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());

-- Upline-scheduled session timings
CREATE TABLE IF NOT EXISTS public.trainee_session_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.beginner_sessions(id) ON DELETE SET NULL,
  session_number integer NOT NULL,
  day_number integer NOT NULL,
  scheduled_at timestamptz NOT NULL,
  created_by uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trainee_id, session_number)
);

GRANT SELECT ON public.trainee_session_schedule TO authenticated;
GRANT ALL ON public.trainee_session_schedule TO service_role;
ALTER TABLE public.trainee_session_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainee reads own schedule" ON public.trainee_session_schedule
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());
CREATE INDEX IF NOT EXISTS trainee_schedule_trainee_idx ON public.trainee_session_schedule (trainee_id);

-- Session reviews submitted by the trainee, approved by the upline
CREATE TABLE IF NOT EXISTS public.trainee_session_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL REFERENCES public.trainees(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.beginner_sessions(id) ON DELETE SET NULL,
  session_number integer NOT NULL,
  body text,
  image_path text,
  voice_path text,
  status text NOT NULL DEFAULT 'pending',
  upline_note text,
  upline_voice_path text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trainee_session_reviews TO authenticated;
GRANT ALL ON public.trainee_session_reviews TO service_role;
ALTER TABLE public.trainee_session_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trainee reads own reviews" ON public.trainee_session_reviews
  FOR SELECT TO authenticated USING (trainee_id = auth.uid());
CREATE INDEX IF NOT EXISTS trainee_reviews_trainee_idx ON public.trainee_session_reviews (trainee_id, session_number);

-- Payment ledger: mentorship + 2CC, verified only by admin
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id uuid NOT NULL,
  payer_kind text NOT NULL DEFAULT 'trainee',
  payer_name text NOT NULL,
  payer_code text,
  upline_id uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'mentorship',
  claimed_amount_pkr numeric NOT NULL DEFAULT 0,
  verified_amount_pkr numeric NOT NULL DEFAULT 0,
  proof_path text,
  phone text,
  email text,
  age integer,
  note text,
  admin_note text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_submissions TO authenticated;
GRANT ALL ON public.payment_submissions TO service_role;
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payer reads own submissions" ON public.payment_submissions
  FOR SELECT TO authenticated USING (payer_id = auth.uid());
CREATE INDEX IF NOT EXISTS payment_submissions_payer_idx ON public.payment_submissions (payer_id, purpose);
CREATE INDEX IF NOT EXISTS payment_submissions_status_idx ON public.payment_submissions (status);

-- Configurable policy values
INSERT INTO public.platform_settings (key, value)
VALUES ('journey_policy', jsonb_build_object(
  'mentorshipFeePkr', 50000,
  'mentorshipDays', 5,
  'ccTargetFullPayment', 150000,
  'ccTargetPartial', 200000,
  'mentorshipSeats', 3,
  'defaultFirstTime', '20:00',
  'defaultSecondTime', '16:00'
))
ON CONFLICT (key) DO NOTHING;