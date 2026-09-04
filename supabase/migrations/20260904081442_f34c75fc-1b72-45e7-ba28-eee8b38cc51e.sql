CREATE TABLE public.whatsapp_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  join_code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  invite_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX whatsapp_groups_join_code_key ON public.whatsapp_groups (upper(join_code));

GRANT ALL ON public.whatsapp_groups TO service_role;

ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER whatsapp_groups_set_updated_at
BEFORE UPDATE ON public.whatsapp_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();