ALTER TABLE public.course_payment_methods
  ADD COLUMN IF NOT EXISTS qr_url text;

COMMENT ON COLUMN public.course_payment_methods.qr_url IS 'Optional QR code image URL shown on the branded payment card.';