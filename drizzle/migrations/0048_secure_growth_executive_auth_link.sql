ALTER TABLE public.job_assistants
  ADD CONSTRAINT job_assistants_auth_user_fk
  FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.job_assistants.access_token IS 'DEPRECATED: legacy bearer-link portal retired; use authenticated Growth Executive account';