-- Final Test module
CREATE TABLE public.final_test_rules (
  id text PRIMARY KEY DEFAULT 'default',
  rules_en text,
  rules_ur text,
  voice_path text,
  voice_url text,
  show_result_to_candidate boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.final_test_rules TO service_role;
ALTER TABLE public.final_test_rules ENABLE ROW LEVEL SECURITY;
INSERT INTO public.final_test_rules (id) VALUES ('default');

CREATE TABLE public.final_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL DEFAULT 0,
  question_en text NOT NULL,
  question_ur text,
  voice_path text,
  voice_url text,
  question_type text NOT NULL DEFAULT 'mcq',
  options_en text[] NOT NULL DEFAULT '{}',
  options_ur text[] NOT NULL DEFAULT '{}',
  correct_option integer,
  marks integer NOT NULL DEFAULT 1,
  time_limit_seconds integer NOT NULL DEFAULT 60,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.final_test_questions TO service_role;
ALTER TABLE public.final_test_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.final_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  person_name text NOT NULL,
  mobile text NOT NULL,
  upline_account_id uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  upline_name text NOT NULL,
  language text,
  status text NOT NULL DEFAULT 'pending',
  marks integer,
  result text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.final_tests TO service_role;
ALTER TABLE public.final_tests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.final_test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.final_tests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.final_test_questions(id) ON DELETE CASCADE,
  answer_text text,
  selected_option integer,
  awarded_marks integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, question_id)
);
GRANT ALL ON public.final_test_answers TO service_role;
ALTER TABLE public.final_test_answers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER final_tests_updated_at BEFORE UPDATE ON public.final_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER final_test_questions_updated_at BEFORE UPDATE ON public.final_test_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();