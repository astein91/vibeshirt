-- Vibeshirt: initial schema for Supabase
-- Run in Supabase SQL Editor or via `supabase db push`

-- Enable moddatetime for auto-updating updated_at
create extension if not exists moddatetime schema extensions;

-- Enums
create type session_status as enum ('DRAFT', 'DESIGNING', 'NORMALIZED', 'READY', 'ORDERED');
create type artifact_type as enum ('UPLOAD', 'GENERATED', 'NORMALIZED', 'MOCKUP');
create type job_type as enum ('GENERATE_ARTWORK', 'NORMALIZE_IMAGE', 'CREATE_PRODUCT');
create type job_status as enum ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- Design sessions
create table design_sessions (
  id uuid primary key default gen_random_uuid(),
  status session_status not null default 'DRAFT',
  user_id uuid references auth.users(id) on delete set null,
  is_public boolean not null default false,
  share_slug text unique,
  vibe_description text,
  artwork_prompt text,
  printify_config jsonb,
  printify_product_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_design_sessions_user_id on design_sessions(user_id);

create trigger handle_updated_at before update on design_sessions
  for each row execute procedure extensions.moddatetime(updated_at);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references design_sessions(id) on delete cascade,
  role text not null,
  author_name text,
  content text not null,
  artifact_id text,
  created_at timestamptz not null default now()
);

create index idx_messages_session_id on messages(session_id);

-- Artifacts
create table artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references design_sessions(id) on delete cascade,
  type artifact_type not null,
  storage_url text not null,
  storage_key text not null,
  metadata jsonb not null default '{}',
  prompt text,
  source_artifact_id text,
  printify_image_id text,
  created_at timestamptz not null default now()
);

create index idx_artifacts_session_id on artifacts(session_id);

-- Jobs
create table jobs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references design_sessions(id) on delete cascade,
  type job_type not null,
  status job_status not null default 'PENDING',
  input jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_jobs_session_id on jobs(session_id);
create index idx_jobs_status on jobs(status);

create trigger handle_jobs_updated_at before update on jobs
  for each row execute procedure extensions.moddatetime(updated_at);

-- Printify catalog cache
create table printify_catalog (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  external_id int not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create unique index idx_printify_catalog_type_external_id on printify_catalog(type, external_id);
create index idx_printify_catalog_type on printify_catalog(type);
