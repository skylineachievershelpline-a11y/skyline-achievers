CREATE TABLE public.member_daily_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid NOT NULL,
  report_date date NOT NULL,
  leads_count integer NOT NULL DEFAULT 0,
  rate_per_lead integer NOT NULL DEFAULT 35,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, report_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_daily_reports TO authenticated;
GRANT ALL ON public.member_daily_reports TO service_role;

ALTER TABLE public.member_daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own daily reports" ON public.member_daily_reports
  FOR SELECT TO authenticated USING (auth.uid() = member_id);
CREATE POLICY "Members insert own daily reports" ON public.member_daily_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Members update own daily reports" ON public.member_daily_reports
  FOR UPDATE TO authenticated USING (auth.uid() = member_id) WITH CHECK (auth.uid() = member_id);

CREATE INDEX member_daily_reports_member_date_idx ON public.member_daily_reports (member_id, report_date DESC);

CREATE TRIGGER member_daily_reports_set_updated_at
  BEFORE UPDATE ON public.member_daily_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();