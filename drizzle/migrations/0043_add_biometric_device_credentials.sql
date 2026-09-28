CREATE TABLE public.biometric_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_type text NOT NULL DEFAULT 'singleDevice',
  backed_up boolean NOT NULL DEFAULT false,
  device_name text NOT NULL DEFAULT 'This device',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT ALL ON public.biometric_credentials TO service_role;
ALTER TABLE public.biometric_credentials ENABLE ROW LEVEL SECURITY;

CREATE INDEX biometric_credentials_user_idx ON public.biometric_credentials(user_id, created_at DESC);

CREATE TABLE public.biometric_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  challenge text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('register', 'authenticate')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.biometric_challenges TO service_role;
ALTER TABLE public.biometric_challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX biometric_challenges_expiry_idx ON public.biometric_challenges(expires_at);