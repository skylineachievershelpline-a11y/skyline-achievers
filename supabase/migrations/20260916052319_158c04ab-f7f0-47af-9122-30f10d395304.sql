CREATE TABLE public.daily_inspirations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ayat','hadees')),
  part_of_day TEXT NOT NULL CHECK (part_of_day IN ('morning','evening','night')),
  text_ur TEXT,
  text_en TEXT,
  reference TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.daily_inspirations TO anon, authenticated;
GRANT ALL ON public.daily_inspirations TO service_role;

ALTER TABLE public.daily_inspirations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active inspirations are readable"
ON public.daily_inspirations FOR SELECT
TO anon, authenticated
USING (is_active);

CREATE TRIGGER daily_inspirations_set_updated_at
BEFORE UPDATE ON public.daily_inspirations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.daily_inspirations (kind, part_of_day, text_en, text_ur, reference, sort_order) VALUES
('ayat','morning','Indeed, with hardship comes ease.','بے شک تنگی کے ساتھ آسانی ہے۔','Surah Ash-Sharh 94:6',1),
('ayat','morning','And say: My Lord, increase me in knowledge.','اور کہو: اے میرے رب! میرے علم میں اضافہ فرما۔','Surah Taha 20:114',2),
('ayat','evening','Allah does not burden a soul beyond what it can bear.','اللہ کسی جان پر اس کی طاقت سے زیادہ بوجھ نہیں ڈالتا۔','Surah Al-Baqarah 2:286',1),
('ayat','night','And He is with you wherever you are.','اور وہ تمہارے ساتھ ہے جہاں بھی تم ہو۔','Surah Al-Hadid 57:4',1),
('hadees','morning','The best of people are those most beneficial to others.','لوگوں میں بہترین وہ ہے جو لوگوں کو سب سے زیادہ فائدہ پہنچائے۔','Tabarani',1),
('hadees','evening','Take benefit of five before five: your youth before your old age.','پانچ چیزوں سے پہلے پانچ کو غنیمت جانو: بڑھاپے سے پہلے جوانی۔','Sunan',1),
('hadees','night','Actions are judged by intentions.','اعمال کا دارومدار نیتوں پر ہے۔','Bukhari & Muslim',1);