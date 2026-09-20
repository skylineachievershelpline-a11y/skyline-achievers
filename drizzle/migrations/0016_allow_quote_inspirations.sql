ALTER TABLE public.daily_inspirations
DROP CONSTRAINT IF EXISTS daily_inspirations_kind_check;

ALTER TABLE public.daily_inspirations
ADD CONSTRAINT daily_inspirations_kind_check
CHECK (kind IN ('ayat', 'hadees', 'quote')) NOT VALID;