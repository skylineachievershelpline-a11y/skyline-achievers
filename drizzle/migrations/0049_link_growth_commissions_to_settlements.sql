ALTER TABLE public.growth_commissions
  ADD COLUMN IF NOT EXISTS settlement_id uuid REFERENCES public.growth_settlements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS growth_commissions_settlement_idx ON public.growth_commissions(settlement_id, status);

COMMENT ON COLUMN public.growth_commissions.settlement_id IS 'FBO funding settlement that makes this verified commission payable';