-- Run this in Supabase SQL Editor
-- Drop old adapter tables if you ran the previous schema
drop table if exists verification_tokens;
drop table if exists sessions;
drop table if exists accounts;
drop table if exists users cascade;
drop table if exists meeting_invites;
drop table if exists meetings;

-- Users (simple, JWT-based auth)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  image text,
  created_at timestamptz default now()
);

-- Meetings synced from Google Calendar
create table meetings (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id text unique,
  fireflies_id text,
  title text not null,
  start_time timestamptz,
  end_time timestamptz,
  meet_link text,
  gamma_url text,
  created_at timestamptz default now()
);

-- Who was invited to each meeting
create table meeting_invites (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  email text not null,
  unique(meeting_id, email)
);

-- Indexes
create index on meeting_invites(email);
create index on meetings(start_time desc);

-- Disable RLS so service role can read/write freely
alter table users disable row level security;
alter table meetings disable row level security;
alter table meeting_invites disable row level security;
