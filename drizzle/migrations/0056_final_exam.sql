ALTER TABLE public.final_test_questions ADD COLUMN IF NOT EXISTS reference_answer text;

CREATE TABLE public.final_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL,
  attempt_no integer NOT NULL DEFAULT 1,
  occupation text NOT NULL,
  occupation_detail text,
  slot_one timestamptz NOT NULL,
  slot_two timestamptz NOT NULL,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'requested',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  mcq_score integer NOT NULL DEFAULT 0,
  mcq_max integer NOT NULL DEFAULT 0,
  written_marks jsonb NOT NULL DEFAULT '{}'::jsonb,
  written_max integer NOT NULL DEFAULT 0,
  percent numeric,
  result text,
  started_at timestamptz,
  submitted_at timestamptz,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX final_exam_attempts_trainee_idx ON public.final_exam_attempts (trainee_id, attempt_no);
GRANT ALL ON public.final_exam_attempts TO service_role;
ALTER TABLE public.final_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER final_exam_attempts_updated BEFORE UPDATE ON public.final_exam_attempts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT ALL ON public.final_test_questions TO service_role;