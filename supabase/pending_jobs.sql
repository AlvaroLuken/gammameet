create table if not exists pending_jobs (
  id uuid primary key default gen_random_uuid(),
  transcript_id text unique not null,
  status text default 'pending',
  created_at timestamptz default now()
);
alter table pending_jobs disable row level security;
