ALTER TABLE public.job_assistants
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS job_assistants_auth_user_unique ON public.job_assistants(auth_user_id) WHERE auth_user_id IS NOT NULL;
COMMENT ON COLUMN public.job_assistants.auth_user_id IS 'Lovable Cloud auth identity for the separate Growth Executive account';
COMMENT ON COLUMN public.job_assistants.password_changed_at IS 'Timestamp of the latest Growth Executive password change';