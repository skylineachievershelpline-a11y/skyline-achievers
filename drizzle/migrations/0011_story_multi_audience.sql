ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS audience_beginners boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience_level_ids uuid[] NOT NULL DEFAULT '{}';

-- Backfill the new multi-select columns from the older single-audience fields.
UPDATE public.stories SET audience_beginners = true WHERE audience_type = 'beginners';
UPDATE public.stories SET audience_level_ids = ARRAY[audience_level_id]
  WHERE audience_type = 'level' AND audience_level_id IS NOT NULL;

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_audience_type_check;
ALTER TABLE public.stories
  ADD CONSTRAINT stories_audience_type_check
  CHECK (audience_type IN ('everyone', 'beginners', 'level', 'custom'));