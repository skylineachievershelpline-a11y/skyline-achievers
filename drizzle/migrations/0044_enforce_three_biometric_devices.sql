CREATE OR REPLACE FUNCTION public.enforce_biometric_device_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  IF (SELECT count(*) FROM public.biometric_credentials WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 secure devices are allowed.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER biometric_credentials_limit_three
BEFORE INSERT ON public.biometric_credentials
FOR EACH ROW
EXECUTE FUNCTION public.enforce_biometric_device_limit();