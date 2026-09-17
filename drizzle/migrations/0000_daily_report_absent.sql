ALTER TABLE public.member_daily_reports
  ADD COLUMN IF NOT EXISTS is_absent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absent_reason text;