CREATE OR REPLACE FUNCTION public.is_manager_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_profiles mp
    JOIN public.levels l ON l.id = mp.level_id
    WHERE mp.id = auth.uid() AND mp.status = 'active'
      AND l.name ILIKE '%manager%'
  );
$$;

REVOKE ALL ON FUNCTION public.is_manager_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_manager_member() TO authenticated, service_role;

CREATE TABLE public.reels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  caption text,
  video_source text NOT NULL DEFAULT 'upload',
  video_path text,
  video_url text,
  thumbnail_path text,
  created_by uuid REFERENCES public.member_profiles(id) ON DELETE SET NULL,
  created_by_admin boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.reels TO authenticated;
GRANT ALL ON public.reels TO service_role;

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read published reels" ON public.reels
FOR SELECT TO authenticated
USING (is_published AND public.current_member_level() IS NOT NULL);

CREATE POLICY "Managers create own reels" ON public.reels
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.is_manager_member());

CREATE POLICY "Managers delete own reels" ON public.reels
FOR DELETE TO authenticated
USING (created_by = auth.uid() AND public.is_manager_member());

CREATE TRIGGER trg_reels_updated BEFORE UPDATE ON public.reels
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX reels_created_at_idx ON public.reels (created_at DESC);