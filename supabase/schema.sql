-- Required by NextAuth SupabaseAdapter
create table users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  "emailVerified" timestamptz,
  image text
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  "userId" uuid references users(id) on delete cascade,
  type text,
  provider text,
  "providerAccountId" text,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  unique(provider, "providerAccountId")
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  "sessionToken" text unique,
  "userId" uuid references users(id) on delete cascade,
  expires timestamptz
);

create table verification_tokens (
  identifier text,
  token text unique,
  expires timestamptz,
  primary key (identifier, token)
);

-- GammaMeet tables
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

create table meeting_invites (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references meetings(id) on delete cascade,
  email text not null,
  unique(meeting_id, email)
);

-- Indexes
create index on meeting_invites(email);
create index on meetings(start_time desc);
