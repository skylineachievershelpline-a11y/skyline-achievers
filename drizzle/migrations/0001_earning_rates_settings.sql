CREATE TABLE public.earning_rates (
  id TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  lead_investment_pkr NUMERIC NOT NULL DEFAULT 35 CHECK (lead_investment_pkr >= 0),
  join_earning_pkr NUMERIC NOT NULL DEFAULT 245 CHECK (join_earning_pkr >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.earning_rates TO authenticated;
GRANT ALL ON public.earning_rates TO service_role;

ALTER TABLE public.earning_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read rates"
ON public.earning_rates
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.earning_rates (id) VALUES ('default');