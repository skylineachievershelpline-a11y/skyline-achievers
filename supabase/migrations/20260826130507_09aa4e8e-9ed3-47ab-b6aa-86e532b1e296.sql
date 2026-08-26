ALTER TABLE public.lectures ADD COLUMN IF NOT EXISTS aspect_ratio TEXT NOT NULL DEFAULT '16:9';
ALTER TABLE public.member_profiles ADD COLUMN IF NOT EXISTS avatar_path TEXT;