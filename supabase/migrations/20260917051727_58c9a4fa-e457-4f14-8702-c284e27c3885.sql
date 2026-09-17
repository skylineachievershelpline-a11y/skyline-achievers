CREATE OR REPLACE FUNCTION public.generate_member_id()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT '76' || lpad(nextval('public.numeric_id_seq')::text, 10, '0');
$$;

CREATE OR REPLACE FUNCTION public.generate_trainee_id()
RETURNS text
LANGUAGE sql
SET search_path = public
AS $$
  SELECT '76' || lpad(nextval('public.numeric_id_seq')::text, 10, '0');
$$;