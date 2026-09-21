ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS session_section_id uuid REFERENCES public.content_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS resources_session_section_id_idx
  ON public.resources (session_section_id);