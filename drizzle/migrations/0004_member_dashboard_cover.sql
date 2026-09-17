ALTER TABLE public.member_profiles
ADD COLUMN dashboard_cover_path text;

COMMENT ON COLUMN public.member_profiles.dashboard_cover_path IS 'Private member-avatars storage path for the member-selected dashboard cover image.';