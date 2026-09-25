ALTER TABLE public.trainee_journey
  ADD COLUMN IF NOT EXISTS interview_marks integer,
  ADD COLUMN IF NOT EXISTS interview_max_marks integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS interview_taken_by text,
  ADD COLUMN IF NOT EXISTS interview_attempts integer NOT NULL DEFAULT 0;