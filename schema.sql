create table ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  text text,
  audio_transcript text,
  image_paths text[],
  status text default 'active',
  created_at timestamptz default now(),
  last_visited_at timestamptz default now(),
  reminder_at timestamptz,
  reminder_sent boolean default false,
  goal text,
  target_date date,
  ai_plan jsonb
);

alter table ideas enable row level security;

create policy "own ideas only" on ideas
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
