ALTER TABLE public.trainee_journey
  ADD COLUMN IF NOT EXISTS interview_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS interview_availability_note text,
  ADD COLUMN IF NOT EXISTS interview_scheduled_at timestamptz;