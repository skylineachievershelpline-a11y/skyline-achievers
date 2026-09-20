ALTER TABLE public.member_profiles
ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE public.daily_inspirations
ADD COLUMN IF NOT EXISTS schedule_type TEXT NOT NULL DEFAULT 'daily';

ALTER TABLE public.daily_inspirations
ADD COLUMN IF NOT EXISTS weekday SMALLINT;

ALTER TABLE public.daily_inspirations
ADD CONSTRAINT daily_inspirations_schedule_type_check
CHECK (schedule_type IN ('daily', 'weekly')) NOT VALID;

ALTER TABLE public.daily_inspirations
ADD CONSTRAINT daily_inspirations_weekday_check
CHECK (weekday IS NULL OR weekday BETWEEN 0 AND 6) NOT VALID;