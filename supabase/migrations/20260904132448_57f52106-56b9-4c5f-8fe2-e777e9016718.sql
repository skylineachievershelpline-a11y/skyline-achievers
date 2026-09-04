INSERT INTO public.levels (name, slug, description, rank_order, is_published) VALUES
  ('Personal Mentorship', 'personal-mentorship', 'One-on-one mentorship foundations for new members.', 1, true),
  ('Assistant Supervisor Training', 'assistant-supervisor-training', 'Step up to assistant supervisor responsibilities.', 2, true),
  ('Supervisor Training', 'supervisor-training', 'Core supervisor skills and team leadership.', 3, true),
  ('Assistant Manager Training', 'assistant-manager-training', 'Prepare for assistant manager duties.', 4, true),
  ('Manager Training', 'manager-training', 'Full management training and advanced leadership.', 5, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, rank_order = EXCLUDED.rank_order, is_published = true;