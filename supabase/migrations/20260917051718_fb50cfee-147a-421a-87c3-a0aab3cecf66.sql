-- Single shared sequence so member and trainee IDs never collide.
-- Start high enough that '76' + 10 digits stays 12 digits.
CREATE SEQUENCE IF NOT EXISTS public.numeric_id_seq START 1;
SELECT setval('public.numeric_id_seq', GREATEST(
  (SELECT COALESCE(last_value, 1) FROM public.member_id_seq),
  (SELECT COALESCE(last_value, 1) FROM public.trainee_id_seq)
));

CREATE OR REPLACE FUNCTION public.generate_member_id()
RETURNS text
LANGUAGE sql
AS $$
  SELECT '76' || lpad(nextval('public.numeric_id_seq')::text, 10, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_trainee_id()
RETURNS text
LANGUAGE sql
AS $$
  SELECT '76' || lpad(nextval('public.numeric_id_seq')::text, 10, '0');
$$;