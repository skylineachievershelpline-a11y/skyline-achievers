DO $$
DECLARE b uuid; p uuid;
BEGIN
  SELECT id INTO b FROM public.levels WHERE slug = 'beginners-training';
  SELECT id INTO p FROM public.levels WHERE slug = 'personal-mentorship';
  IF b IS NULL OR p IS NULL THEN RETURN; END IF;

  UPDATE public.member_profiles SET level_id = p WHERE level_id = b;
  UPDATE public.lectures SET level_id = p WHERE level_id = b;
  UPDATE public.series SET level_id = p WHERE level_id = b;
  UPDATE public.notifications SET audience_level_id = p WHERE audience_level_id = b;
  DELETE FROM public.content_access WHERE level_id = b;
  DELETE FROM public.levels WHERE id = b;

  UPDATE public.levels l
  SET rank_order = r.rn
  FROM (SELECT id, row_number() OVER (ORDER BY rank_order) AS rn FROM public.levels) r
  WHERE l.id = r.id AND l.rank_order <> r.rn;
END $$;