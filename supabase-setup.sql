-- Run this in your Supabase SQL editor
-- Go to: supabase.com > your project > SQL Editor > New query

create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  user_id text not null unique,
  months_data jsonb not null default '{}',
  settings jsonb not null default '{}',
  updated_at timestamp with time zone default now()
);

create index if not exists budgets_user_id_idx on budgets(user_id);

alter table budgets enable row level security;

create policy "Allow all for now" on budgets
  for all using (true);
