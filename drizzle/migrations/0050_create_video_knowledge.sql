create table if not exists public.video_knowledge (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('session','landing_intro','lecture','custom')),
  source_id text,
  title text not null,
  video_label text,
  video_url text,
  youtube_id text,
  language text,
  transcript text,
  timeline jsonb not null default '[]'::jsonb,
  summary text,
  key_points text,
  status text not null default 'pending' check (status in ('pending','ready','failed')),
  last_error text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists video_knowledge_source_idx
  on public.video_knowledge (source_kind, coalesce(source_id, id::text));

grant all on public.video_knowledge to service_role;

alter table public.video_knowledge enable row level security;

drop policy if exists "video knowledge is service role only" on public.video_knowledge;
create policy "video knowledge is service role only"
  on public.video_knowledge for all
  to service_role
  using (true) with check (true);

drop trigger if exists video_knowledge_updated_at on public.video_knowledge;
create trigger video_knowledge_updated_at
  before update on public.video_knowledge
  for each row execute function public.set_updated_at();