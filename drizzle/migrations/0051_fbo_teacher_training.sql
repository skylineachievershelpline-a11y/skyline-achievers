CREATE TABLE public.fbo_training (
  user_id uuid PRIMARY KEY,
  current_chapter int NOT NULL DEFAULT 1,
  current_lesson int NOT NULL DEFAULT 0,
  current_stage text NOT NULL DEFAULT 'INTRO',
  unlocked_chapter int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  chapters jsonb NOT NULL DEFAULT '{}'::jsonb,
  remediation_count int NOT NULL DEFAULT 0,
  final_passed boolean NOT NULL DEFAULT false,
  admin_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  last_position jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fbo_training TO service_role;
ALTER TABLE public.fbo_training ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fbo_training_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chapter int NOT NULL,
  kind text NOT NULL DEFAULT 'test',
  score int NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fbo_training_attempts_user_idx ON public.fbo_training_attempts (user_id, chapter, created_at DESC);
GRANT ALL ON public.fbo_training_attempts TO service_role;
ALTER TABLE public.fbo_training_attempts ENABLE ROW LEVEL SECURITY;