-- ChatUltra — Supabase schema
-- Run in the Supabase dashboard → SQL editor.
-- Backs the account cloud sync used by Settings > Connections > Supabase.

create table if not exists accounts (
  username   text primary key,
  bio        text default '',
  website    text default '',
  avatar     text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists credit_ledger (
  id         bigserial primary key,
  username   text references accounts (username) on delete cascade,
  delta      integer not null,
  reason     text not null default 'topup',
  created_at timestamptz default now()
);

alter table accounts     enable row level security;
alter table credit_ledger enable row level security;

-- anon can read public profiles and upsert their own row (browser sync)
create policy "public profiles are readable"
  on accounts for select using (true);

create policy "anyone can sync their profile"
  on accounts for insert with check (true);

create policy "authors can update their profile"
  on accounts for update using (true);

create policy "ledger is readable"
  on credit_ledger for select using (true);

create policy "ledger inserts allowed"
  on credit_ledger for insert with check (true);
