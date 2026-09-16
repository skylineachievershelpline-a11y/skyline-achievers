GRANT SELECT ON public.landing_quotes TO anon, authenticated;
GRANT ALL ON public.landing_quotes TO service_role;
GRANT SELECT ON public.landing_intro TO anon, authenticated;
GRANT ALL ON public.landing_intro TO service_role;
GRANT SELECT, INSERT ON public.landing_reviews TO anon, authenticated;
GRANT ALL ON public.landing_reviews TO service_role;