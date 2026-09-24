ALTER TABLE public.trainee_session_reviews
ADD COLUMN score integer;

ALTER TABLE public.trainee_session_reviews
ADD CONSTRAINT trainee_session_reviews_score_range
CHECK (score IS NULL OR score BETWEEN 0 AND 15);

COMMENT ON COLUMN public.trainee_session_reviews.score IS 'Upline-assigned session score; sessions 1-2 allow 15 marks and sessions 3-7 allow 14 marks.';